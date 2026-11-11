import os
import secrets

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.rate_limit import AttemptLimiter
from app.email import send_password_reset_email, send_verification_email
from app.security import (
    create_access_token,
    create_purpose_token,
    decode_purpose_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
_DUMMY_HASH = hash_password("timing-equaliser")

# Brakes on guessing: 8 wrong passwords for one account, or 5 reset requests for one email, in 10 minutes.
LOGIN_LIMITER = AttemptLimiter(limit=8, window_seconds=600)
RESET_LIMITER = AttemptLimiter(limit=5, window_seconds=600)


def _too_many(retry_after: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many attempts. Please wait a few minutes and try again.",
        headers={"Retry-After": str(retry_after)},
    )

VERIFY_EMAIL_PURPOSE = "verify_email"
RESET_PASSWORD_PURPOSE = "reset_password"
VERIFY_EMAIL_EXPIRE_MINUTES = 60 * 24
RESET_PASSWORD_EXPIRE_MINUTES = 60


def _send_verification_email(background_tasks: BackgroundTasks, user: models.User) -> None:
    token = create_purpose_token(str(user.id), VERIFY_EMAIL_PURPOSE, VERIFY_EMAIL_EXPIRE_MINUTES)
    background_tasks.add_task(send_verification_email, user.email, user.full_name, token)


def _register(db: Session, payload: schemas.RegisterRequest, role: models.UserRole) -> models.User:
    user = models.User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=role,
        is_verified=False,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    db.refresh(user)
    return user


@router.post(
    "/register/candidate", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED
)
def register_candidate(
    payload: schemas.RegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user = _register(db, payload, models.UserRole.CANDIDATE)
    _send_verification_email(background_tasks, user)
    return user


@router.post(
    "/register/employer", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED
)
def register_employer(
    payload: schemas.EmployerRegisterRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # Public employer signup has no invite step — the signing-up person
    # becomes the first (and, for now, only) member of a brand-new
    # organization. A super admin can see/manage/suspend it afterward.
    organization = models.Organization(name=payload.organization_name)
    db.add(organization)
    db.flush()

    user = models.User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=models.UserRole.EMPLOYER,
        is_verified=False,
        organization_id=organization.id,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    db.refresh(user)
    _send_verification_email(background_tasks, user)
    return user


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    limit_key = f"{getattr(payload.role, 'value', payload.role)}:{payload.email.strip().lower()}"
    retry = LOGIN_LIMITER.retry_after(limit_key)
    if retry:
        raise _too_many(retry)
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if user is None or user.role != payload.role:
        # Same bcrypt cost as a real check so response time doesn't reveal which emails exist.
        verify_password(payload.password, _DUMMY_HASH)
    if (
        user is None
        or user.role != payload.role
        or not verify_password(payload.password, user.hashed_password)
    ):
        LOGIN_LIMITER.record(limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password."
        )
    LOGIN_LIMITER.reset(limit_key)

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before signing in.",
        )

    if user.role == models.UserRole.EMPLOYER and user.organization_id:
        organization = db.get(models.Organization, user.organization_id)
        if organization is not None and organization.status == models.OrganizationStatus.SUSPENDED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This organization's access has been suspended. Contact support.",
            )

    token = create_access_token(
        subject=str(user.id), role=user.role.value, remember=payload.remember
    )
    return schemas.TokenResponse(access_token=token, user=user)


@router.post("/verify-email", response_model=schemas.UserOut)
def verify_email(payload: schemas.VerifyEmailRequest, db: Session = Depends(get_db)):
    user_id = decode_purpose_token(payload.token, VERIFY_EMAIL_PURPOSE)
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This link is invalid.")

    if not user.is_verified:
        user.is_verified = True
        db.commit()
        db.refresh(user)
    return user


@router.post("/resend-verification", response_model=schemas.MessageResponse)
def resend_verification(
    payload: schemas.EmailOnlyRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if user is not None and not user.is_verified:
        _send_verification_email(background_tasks, user)
    return schemas.MessageResponse(
        detail="If that account exists and isn't verified yet, a new email is on its way."
    )


@router.post("/forgot-password", response_model=schemas.MessageResponse)
def forgot_password(
    payload: schemas.EmailOnlyRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    reset_key = payload.email.strip().lower()
    retry = RESET_LIMITER.retry_after(reset_key)
    if retry:
        raise _too_many(retry)
    RESET_LIMITER.record(reset_key)
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if user is not None:
        token = create_purpose_token(
            str(user.id), RESET_PASSWORD_PURPOSE, RESET_PASSWORD_EXPIRE_MINUTES
        )
        background_tasks.add_task(send_password_reset_email, user.email, user.full_name, token)
    return schemas.MessageResponse(detail="If that email is registered, a reset link is on its way.")


@router.post("/reset-password", response_model=schemas.MessageResponse)
def reset_password(payload: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    user_id = decode_purpose_token(payload.token, RESET_PASSWORD_PURPOSE)
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This link is invalid.")

    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return schemas.MessageResponse(detail="Password updated. You can now sign in.")


def _verify_google_access_token(access_token: str) -> dict:
    # Without our own client id we cannot tell a token issued for this app from one issued for any other app,
    # so Google sign-in stays off until GOOGLE_CLIENT_ID is set.
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google sign-in is not set up yet."
        )
    try:
        resp = httpx.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"access_token": access_token},
            timeout=5.0,
        )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not verify Google account."
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired Google token."
        )

    info = resp.json()
    if info.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token was not issued for this app.",
        )
    if not info.get("email") or str(info.get("email_verified")).lower() != "true":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account email is not verified.",
        )
    return info


def _fetch_google_display_name(access_token: str, fallback: str) -> str:
    try:
        resp = httpx.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=5.0,
        )
        if resp.status_code == 200:
            name = resp.json().get("name")
            if name:
                return name
    except httpx.HTTPError:
        pass
    return fallback


@router.post("/google", response_model=schemas.TokenResponse)
def google_auth(payload: schemas.GoogleAuthRequest, db: Session = Depends(get_db)):
    if payload.role not in (models.UserRole.CANDIDATE, models.UserRole.EMPLOYER):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google sign-in is not available for this account type.")
    info = _verify_google_access_token(payload.access_token)
    email = info["email"]

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        full_name = _fetch_google_display_name(payload.access_token, fallback=email.split("@")[0])
        organization_id = None
        if payload.role == models.UserRole.EMPLOYER:
            # Same "self-signup creates a new org" rule as the email/password
            # employer signup — named from their email domain as a placeholder,
            # renamable later from the org settings.
            domain = email.split("@")[-1].split(".")[0]
            organization = models.Organization(name=domain.capitalize() or "New Organization")
            db.add(organization)
            db.flush()
            organization_id = organization.id
        user = models.User(
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name=full_name,
            role=payload.role,
            is_verified=True,
            organization_id=organization_id,
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            # A concurrent first sign-in created the account (and maybe its org); tell the client to retry.
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Please try signing in again.")
        db.refresh(user)
    elif user.role != payload.role:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This email is already registered as a {user.role.value}.",
        )
    elif not user.is_verified:
        # Google proved ownership of the address: take over a pre-registered unverified row so any
        # password set by whoever registered it first stops working.
        user.hashed_password = hash_password(secrets.token_urlsafe(32))
        user.is_verified = True
        db.commit()
        db.refresh(user)

    if user.role == models.UserRole.EMPLOYER and user.organization_id:
        organization = db.get(models.Organization, user.organization_id)
        if organization is not None and organization.status == models.OrganizationStatus.SUSPENDED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This organization's access has been suspended. Contact support.",
            )

    token = create_access_token(subject=str(user.id), role=user.role.value, remember=True)
    return schemas.TokenResponse(access_token=token, user=user)


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=schemas.UserOut)
def update_me(
    payload: schemas.UpdateProfileRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.full_name = payload.full_name
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/change-password", response_model=schemas.MessageResponse)
def change_password(
    payload: schemas.ChangePasswordRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return schemas.MessageResponse(detail="Password updated.")
