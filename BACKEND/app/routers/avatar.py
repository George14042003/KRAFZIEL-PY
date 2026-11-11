from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import require_employer

router = APIRouter(prefix="/avatar", tags=["avatar"])


def _profile_out(profile: models.AvatarProfile | None) -> schemas.AvatarProfileOut:
    if profile is None:
        return schemas.AvatarProfileOut()
    return schemas.AvatarProfileOut(params=profile.params, consent_at=profile.consent_at)


@router.get("/me", response_model=schemas.AvatarProfileOut)
def get_my_avatar(
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    profile = db.query(models.AvatarProfile).filter_by(user_id=employer.id).first()
    return _profile_out(profile)


@router.put("/me", response_model=schemas.AvatarProfileOut)
def save_my_avatar(
    payload: schemas.AvatarProfileIn,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    if not payload.consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must consent to creating a digital twin of yourself.",
        )
    params = payload.params.model_dump(mode="json")
    profile = db.query(models.AvatarProfile).filter_by(user_id=employer.id).first()
    if profile is None:
        profile = models.AvatarProfile(
            user_id=employer.id, params=params, consent_at=datetime.utcnow()
        )
        db.add(profile)
    else:
        profile.params = params
        profile.consent_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)
    return _profile_out(profile)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_avatar(
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    db.query(models.AvatarProfile).filter_by(user_id=employer.id).delete()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
