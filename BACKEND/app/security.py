import os
import threading
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, joinedload

from app import models
from app.database import get_db

SECRET_KEY = os.environ["SECRET_KEY"]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REMEMBER_TOKEN_EXPIRE_DAYS = int(os.environ.get("REMEMBER_TOKEN_EXPIRE_DAYS", "30"))

bearer_scheme = HTTPBearer()


# bcrypt is deliberately CPU-heavy. A burst of logins (a whole cohort starting at once) would
# otherwise run hundreds of hashes at once on far fewer cores, stalling every other request
# (heartbeats included). Let only about one per core run; the rest wait their turn.
_PASSWORD_SLOTS = threading.BoundedSemaphore(max(2, os.cpu_count() or 4))


def hash_password(password: str) -> str:
    with _PASSWORD_SLOTS:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    with _PASSWORD_SLOTS:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(subject: str, role: str, remember: bool = False) -> str:
    expires_delta = (
        timedelta(days=REMEMBER_TOKEN_EXPIRE_DAYS)
        if remember
        else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_purpose_token(subject: str, purpose: str, expires_minutes: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload = {"sub": subject, "purpose": purpose, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_purpose_token(token: str, expected_purpose: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This link is invalid or has expired."
        )

    if payload.get("purpose") != expected_purpose or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This link is invalid or has expired."
        )
    return payload["sub"]


def user_id_from_access_token(token: str) -> str | None:
    """The user id inside a login (access) token, or None if the token is invalid,
    expired, or isn't an access token. Purpose tokens (email verification, password
    reset) share the signing key, so they must be rejected here — otherwise a
    reset link emailed to someone would double as a login token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    if "purpose" in payload or "role" not in payload:
        return None
    return payload.get("sub")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    user_id = user_id_from_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )

    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    return user


def require_employer(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != models.UserRole.EMPLOYER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only employers can perform this action.",
        )
    if current_user.organization is not None and (
        current_user.organization.status == models.OrganizationStatus.SUSPENDED
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This organization's access has been suspended. Contact support.",
        )
    return current_user


def require_candidate(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != models.UserRole.CANDIDATE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only candidates can perform this action.",
        )
    return current_user


def require_super_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != models.UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a super admin can perform this action.",
        )
    return current_user


def interview_party(interview: models.Interview, user: models.User) -> str | None:
    """Which side of this interview the logged-in user is: the candidate (verified
    account whose email matches the candidate record), an employer in the candidate's
    organization, or neither."""
    candidate = interview.candidate
    if candidate is None:
        return None
    if user.role == models.UserRole.CANDIDATE and (
        candidate.applicant_email.strip().lower() == user.email.strip().lower()
    ):
        return "candidate"
    if user.role == models.UserRole.EMPLOYER and user.organization_id == candidate.organization_id:
        return "employer"
    return None


def parse_uuid_or_404(value, label: str) -> uuid.UUID:
    """Malformed ids are a plain 404, not a database error."""
    try:
        return uuid.UUID(str(value))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found.")


def _load_interview(db: Session, interview_id: str) -> models.Interview:
    try:
        parsed = uuid.UUID(str(interview_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found.")
    interview = (
        db.query(models.Interview)
        .options(joinedload(models.Interview.candidate))
        .filter(models.Interview.id == parsed)
        .first()
    )
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found.")
    return interview


def require_interview_candidate(
    interview_id: str,
    current_user: models.User = Depends(require_candidate),
    db: Session = Depends(get_db),
) -> models.Interview:
    """The logged-in candidate this interview belongs to (matched by verified email)."""
    interview = _load_interview(db, interview_id)
    if interview_party(interview, current_user) != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This interview isn't linked to your account. Log in with the email it was sent to.",
        )
    return interview


def require_interview_participant(
    interview_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.Interview:
    """Either side of the interview: its candidate or an employer at that organization."""
    interview = _load_interview(db, interview_id)
    if interview_party(interview, current_user) is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You aren't a participant in this interview."
        )
    return interview
