import time

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/public", tags=["public"])

_STATS_TTL_SECONDS = 30
_stats_cache: dict = {"at": 0.0, "value": None}


@router.get("/stats", response_model=schemas.PublicStatsOut)
def get_public_stats(db: Session = Depends(get_db)):
    """Aggregate, non-sensitive platform totals for the marketing homepage's
    animated stats section. Deliberately exposes only counts — no names, no
    per-organization breakdowns, nothing that could leak a tenant's identity
    or size to a competitor."""
    cached = _stats_cache["value"]
    if cached is not None and time.monotonic() - _stats_cache["at"] < _STATS_TTL_SECONDS:
        return cached
    organizations_count = db.query(models.Organization).count()
    candidates_count = db.query(models.Candidate).count()
    interviews_completed_count = (
        db.query(models.Interview)
        .filter(models.Interview.status == models.InterviewStatus.COMPLETED)
        .count()
    )
    jobs_posted_count = db.query(models.Job).count()

    result = schemas.PublicStatsOut(
        organizations_count=organizations_count,
        candidates_count=candidates_count,
        interviews_completed_count=interviews_completed_count,
        jobs_posted_count=jobs_posted_count,
    )
    _stats_cache.update(at=time.monotonic(), value=result)
    return result

