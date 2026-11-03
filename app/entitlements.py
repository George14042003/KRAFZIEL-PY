"""Plan limits: what an organization's subscription allows it to create or schedule."""

import os
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.catalog import MODES, is_live, load_catalog


def limits_enforced() -> bool:
    """Plan limits are off until ENFORCE_PLAN_LIMITS=true, so nobody is capped before launch."""
    return os.getenv("ENFORCE_PLAN_LIMITS", "").strip().lower() in ("1", "true", "yes", "on")


def _live_subscription(db: Session, organization_id, cat: dict):
    sub = db.query(models.Subscription).filter_by(organization_id=organization_id).first()
    if is_live(sub) and sub.plan_key in cat["plans"]:
        return sub
    return None


def org_limits_enforced(db: Session, organization_id) -> bool:
    """Limits apply to an organization once it has a live plan (demo or real), or everywhere when the global flag is on."""
    return limits_enforced() or _live_subscription(db, organization_id, load_catalog(db)) is not None


def current_entitlements(db: Session, organization_id) -> dict:
    """A live subscription always applies its own plan's limits. Without one, the Free plan's limits apply when
    ENFORCE_PLAN_LIMITS is on, otherwise the organization is on "Early access" with everything unlimited."""
    cat = load_catalog(db)
    sub = _live_subscription(db, organization_id, cat)
    if sub is None and not limits_enforced():
        return {"plan_key": "free", "mode": "both", "plan_name": "Early access", "jobs": None, "candidates": None, "bot": None, "video": None}
    plan_key = sub.plan_key if sub else "free"
    mode = sub.interview_mode if sub and sub.interview_mode in MODES else "both"
    plan = cat["plans"][plan_key]
    offer = plan["offers"][mode]
    return {
        "plan_key": plan_key,
        "mode": mode,
        "plan_name": plan["name"],
        "jobs": plan["limits"]["jobs"],
        "candidates": plan["limits"]["candidates"],
        "bot": offer["bot"],
        "video": offer["video"],
    }


def _blocked(message: str) -> HTTPException:
    return HTTPException(status.HTTP_402_PAYMENT_REQUIRED, f"{message} Upgrade or change your plan on the Subscriptions page to continue.")


def enforce_job_limit(db: Session, organization_id) -> None:
    limit = current_entitlements(db, organization_id)
    if limit["jobs"] is None:
        return
    _lock_organization(db, organization_id)
    active = (
        db.query(models.Job)
        .filter(
            models.Job.organization_id == organization_id,
            models.Job.status.in_([models.JobStatus.DRAFT, models.JobStatus.OPEN]),
        )
        .count()
    )
    if active >= limit["jobs"]:
        raise _blocked(f"Your {limit['plan_name']} plan allows {limit['jobs']} active job posting(s).")


def _lock_organization(db: Session, organization_id) -> None:
    """Serialise count-then-insert for one organization (held until the request's commit) so concurrent
    requests cannot all pass the same limit check."""
    db.query(models.Organization).filter(models.Organization.id == organization_id).with_for_update().first()


def enforce_candidate_limit(db: Session, organization_id) -> None:
    limit = current_entitlements(db, organization_id)
    if limit["candidates"] is None:
        return
    _lock_organization(db, organization_id)
    total = db.query(models.Candidate).filter(models.Candidate.organization_id == organization_id).count()
    if total >= limit["candidates"]:
        raise _blocked(f"Your {limit['plan_name']} plan allows {limit['candidates']} candidates in the pool.")


def enforce_interview_limit(db: Session, organization_id, interview_type: Optional[models.InterviewType]) -> None:
    """Bot and video interviews are metered per calendar month; other types (phone, onsite, ...) are not."""
    if interview_type == models.InterviewType.BOT:
        key, label = "bot", "bot"
    elif interview_type == models.InterviewType.VIDEO:
        key, label = "video", "video"
    else:
        return
    limit = current_entitlements(db, organization_id)
    allowed = limit[key]
    if allowed is None:
        return
    _lock_organization(db, organization_id)
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    used = (
        db.query(models.Interview)
        .join(models.Candidate, models.Interview.candidate_id == models.Candidate.id)
        .filter(
            models.Candidate.organization_id == organization_id,
            models.Interview.interview_type == interview_type,
            models.Interview.status != models.InterviewStatus.CANCELLED,
            models.Interview.created_at >= month_start,
        )
        .count()
    )
    if used >= allowed:
        if allowed == 0:
            raise _blocked(f"Your {limit['plan_name']} plan does not include {label} interviews.")
        raise _blocked(f"You have used all {allowed} {label} interviews included in your {limit['plan_name']} plan this month.")


def usage_summary(db: Session, organization_id) -> dict:
    """Used-so-far counters, shown next to the limits on the Billing page."""
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)

    def interviews(kind: models.InterviewType) -> int:
        return (
            db.query(models.Interview)
            .join(models.Candidate, models.Interview.candidate_id == models.Candidate.id)
            .filter(
                models.Candidate.organization_id == organization_id,
                models.Interview.interview_type == kind,
                models.Interview.status != models.InterviewStatus.CANCELLED,
                models.Interview.created_at >= month_start,
            )
            .count()
        )

    return {
        "jobs": db.query(models.Job)
        .filter(
            models.Job.organization_id == organization_id,
            models.Job.status.in_([models.JobStatus.DRAFT, models.JobStatus.OPEN]),
        )
        .count(),
        "candidates": db.query(models.Candidate).filter(models.Candidate.organization_id == organization_id).count(),
        "bot_interviews": interviews(models.InterviewType.BOT),
        "video_interviews": interviews(models.InterviewType.VIDEO),
    }
