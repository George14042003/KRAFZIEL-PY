from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.routers.candidates import find_candidate_by_email
from app.security import require_candidate

router = APIRouter(tags=["candidate-portal"])


@router.get("/me/portal", response_model=schemas.CandidatePortalResponse)
def get_my_portal(
    current_user: models.User = Depends(require_candidate),
    db: Session = Depends(get_db),
):
    candidate = find_candidate_by_email(
        db,
        current_user.email,
        None,
        joinedload(models.Candidate.interviews),
        joinedload(models.Candidate.offers),
    )
    if candidate is None:
        return schemas.CandidatePortalResponse(candidate=None)
    return schemas.CandidatePortalResponse(
        candidate=schemas.CandidatePortalOut.model_validate(candidate)
    )
