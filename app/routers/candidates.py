import os
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app import ai, models, schemas
from app.database import get_db
from app.email import (
    FRONTEND_URL,
    send_availability_request_email,
    send_interview_invite_email,
)
from app.security import require_employer

MEDIA_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "media")
IDENTITY_SNAPSHOTS_DIR = os.path.join(MEDIA_ROOT, "identity_snapshots")

router = APIRouter(tags=["candidates"])

# The client pings /interviews/{id}/heartbeat every 5s while a bot interview
# attempt is in progress. Anything longer than this between two heartbeats
# (or between the last heartbeat and a submit/terminate call) means the
# client stopped reporting in for long enough that it isn't just network
# jitter — treated as tampering or an abandoned session either way.
MAX_HEARTBEAT_GAP_SECONDS = 15

# Auto-screening: a completed bot interview is scored 0-100 (mean of the AI's
# 1-10 dimension scores x 10). Below the cutoff the candidate is auto-rejected;
# at or above it they're shortlisted for a human to review.
AUTO_REJECT_CUTOFF = 33

_OPEN_APPLICATION_STATUSES = (
    models.JobApplicationStatus.SUBMITTED,
    models.JobApplicationStatus.UNDER_REVIEW,
    models.JobApplicationStatus.INTERVIEWING,
)
_FINAL_CANDIDATE_STATUSES = (
    models.CandidateStatus.OFFERED,
    models.CandidateStatus.HIRED,
)


def _screening_score(evaluation: dict) -> int | None:
    scores = [
        v
        for k, v in evaluation.items()
        if k != "overall" and isinstance(v, (int, float)) and not isinstance(v, bool)
    ]
    if not scores:
        overall = evaluation.get("overall")
        return round(overall * 10) if isinstance(overall, (int, float)) else None
    return round(sum(scores) / len(scores) * 10)


def _apply_auto_screening(db: Session, candidate: models.Candidate, evaluation: dict) -> None:
    score = _screening_score(evaluation)
    if score is None:
        return
    passed = score >= AUTO_REJECT_CUTOFF
    evaluation["score"] = score
    evaluation["auto_decision"] = "shortlisted" if passed else "rejected"
    evaluation["cutoff"] = AUTO_REJECT_CUTOFF

    if candidate.status in _FINAL_CANDIDATE_STATUSES:
        return
    candidate.status = (
        models.CandidateStatus.REVIEWED if passed else models.CandidateStatus.REJECTED
    )
    new_status = (
        models.JobApplicationStatus.SHORTLISTED if passed else models.JobApplicationStatus.REJECTED
    )
    for application in candidate.job_applications:
        if application.status in _OPEN_APPLICATION_STATUSES:
            application.status = new_status


def find_candidate_by_email(
    db: Session, email: str, organization_id: str | None = None, *options
) -> models.Candidate | None:
    """Look up a candidate pool record by email. Each organization keeps its
    own separate Candidate row for the same person (see Candidate model
    docstring) — pass organization_id to scope the lookup to one company;
    omit it to get that person's most-recently-touched record across every
    organization they've ever engaged with (used by the candidate's own
    unified portal view)."""
    query = db.query(models.Candidate).options(*options).filter(
        func.lower(models.Candidate.applicant_email) == email.lower()
    )
    if organization_id is not None:
        query = query.filter(models.Candidate.organization_id == organization_id)
    return query.order_by(models.Candidate.created_at.desc()).first()


def find_candidate_ids_by_email(db: Session, email: str) -> list:
    """All of this person's candidate pool record IDs, across every
    organization — used where a candidate's own view must aggregate their
    applications/interviews from every company they've engaged with."""
    rows = (
        db.query(models.Candidate.id)
        .filter(func.lower(models.Candidate.applicant_email) == email.lower())
        .all()
    )
    return [r[0] for r in rows]


def _join_url_for(interview: models.Interview) -> str | None:
    if interview.interview_type == models.InterviewType.VIDEO:
        return f"{FRONTEND_URL}/call/{interview.id}"
    if interview.interview_type == models.InterviewType.BOT:
        return f"{FRONTEND_URL}/bot-interview/{interview.id}"
    return None


def _send_availability_request(candidate: models.Candidate, interview: models.Interview) -> None:
    """The candidate must confirm they're actually available for this slot
    before it's locked in — this is sent at scheduling time instead of the
    join link. The join link only goes out once they accept
    (see accept_interview_availability)."""
    if not candidate.applicant_email:
        return
    respond_url = f"{FRONTEND_URL}/interview-response/{interview.id}"
    send_availability_request_email(
        to=candidate.applicant_email,
        candidate_name=candidate.applicant_name,
        interview_type=interview.interview_type.value,
        scheduled_at=interview.scheduled_at,
        interviewer_name=interview.interviewer_name,
        respond_url=respond_url,
    )


def _send_interview_invite(candidate: models.Candidate, interview: models.Interview) -> None:
    """Sent once the candidate has confirmed availability — this carries the
    actual join link (if the interview type has one)."""
    if not candidate.applicant_email:
        return
    send_interview_invite_email(
        to=candidate.applicant_email,
        candidate_name=candidate.applicant_name,
        interview_type=interview.interview_type.value,
        scheduled_at=interview.scheduled_at,
        interviewer_name=interview.interviewer_name,
        join_url=_join_url_for(interview),
    )


def _candidate_out(candidate: models.Candidate) -> schemas.CandidateOut:
    candidate.interview_count = len(candidate.interviews)  # type: ignore[attr-defined]
    candidate.offer_count = len(candidate.offers)  # type: ignore[attr-defined]
    candidate.created_by_name = candidate.creator.full_name if candidate.creator else None  # type: ignore[attr-defined]
    candidate.created_by_email = candidate.creator.email if candidate.creator else None  # type: ignore[attr-defined]
    return schemas.CandidateOut.model_validate(candidate)


def _get_candidate(
    db: Session, candidate_id: str, organization_id: str | None = None
) -> models.Candidate:
    query = (
        db.query(models.Candidate)
        .options(
            joinedload(models.Candidate.interviews),
            joinedload(models.Candidate.offers),
            joinedload(models.Candidate.creator),
        )
        .filter(models.Candidate.id == candidate_id)
    )
    if organization_id is not None:
        query = query.filter(models.Candidate.organization_id == organization_id)
    candidate = query.first()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found.")
    return candidate


def _get_offer(db: Session, offer_id: str, organization_id: str | None = None) -> models.Offer:
    query = db.query(models.Offer).filter(models.Offer.id == offer_id)
    if organization_id is not None:
        query = query.join(models.Candidate).filter(
            models.Candidate.organization_id == organization_id
        )
    offer = query.first()
    if offer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found.")
    return offer


def _get_interview(
    db: Session, interview_id: str, organization_id: str | None = None
) -> models.Interview:
    query = db.query(models.Interview).filter(models.Interview.id == interview_id)
    if organization_id is not None:
        query = query.join(models.Candidate).filter(
            models.Candidate.organization_id == organization_id
        )
    interview = query.first()
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found.")
    return interview


# --- Candidates (shared pool, visible to every employer) --------------------


@router.post(
    "/candidates", response_model=schemas.CandidateOut, status_code=status.HTTP_201_CREATED
)
def create_candidate(
    payload: schemas.CandidateCreate,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    candidate = models.Candidate(
        **payload.model_dump(), created_by=employer.id, organization_id=employer.organization_id
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    candidate.interviews = []
    candidate.offers = []
    candidate.creator = employer
    return _candidate_out(candidate)


@router.get("/candidates", response_model=list[schemas.CandidateOut])
def list_candidates(
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    candidates = (
        db.query(models.Candidate)
        .options(
            joinedload(models.Candidate.interviews),
            joinedload(models.Candidate.offers),
            joinedload(models.Candidate.creator),
        )
        .filter(models.Candidate.organization_id == employer.organization_id)
        .order_by(models.Candidate.created_at.desc())
        .all()
    )
    return [_candidate_out(candidate) for candidate in candidates]


@router.get("/candidates/{candidate_id}", response_model=schemas.CandidateOut)
def get_candidate(
    candidate_id: str,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    return _candidate_out(_get_candidate(db, candidate_id, employer.organization_id))


@router.patch("/candidates/{candidate_id}", response_model=schemas.CandidateOut)
def update_candidate(
    candidate_id: str,
    payload: schemas.CandidateUpdate,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    candidate = _get_candidate(db, candidate_id, employer.organization_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(candidate, field, value)
    db.commit()
    db.refresh(candidate)
    return _candidate_out(candidate)


@router.delete("/candidates/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_candidate(
    candidate_id: str,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    candidate = _get_candidate(db, candidate_id, employer.organization_id)
    if candidate.created_by is not None and candidate.created_by != employer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the employer who added this candidate can remove them.",
        )
    db.delete(candidate)
    db.commit()


# --- Interviews (shared across the employer team) ----------------------


@router.post(
    "/candidates/{candidate_id}/interviews",
    response_model=schemas.InterviewOut,
    status_code=status.HTTP_201_CREATED,
)
def create_interview(
    candidate_id: str,
    payload: schemas.InterviewCreate,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    candidate = _get_candidate(db, candidate_id, employer.organization_id)
    interview = models.Interview(
        **payload.model_dump(), candidate_id=candidate.id, created_by=employer.id
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)
    _send_availability_request(candidate, interview)
    return interview


@router.get("/candidates/{candidate_id}/interviews", response_model=list[schemas.InterviewOut])
def list_interviews_for_candidate(
    candidate_id: str,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    candidate = _get_candidate(db, candidate_id, employer.organization_id)
    return (
        db.query(models.Interview)
        .filter(models.Interview.candidate_id == candidate.id)
        .order_by(models.Interview.scheduled_at.asc())
        .all()
    )


@router.get("/interviews", response_model=list[schemas.InterviewOut])
def list_interviews(
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Interview)
        .join(models.Candidate)
        .filter(models.Candidate.organization_id == employer.organization_id)
        .order_by(models.Interview.scheduled_at.asc())
        .all()
    )


@router.get("/interviews/{interview_id}", response_model=schemas.InterviewOut)
def get_interview(
    interview_id: str,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    return _get_interview(db, interview_id, employer.organization_id)


@router.patch("/interviews/{interview_id}", response_model=schemas.InterviewOut)
def update_interview(
    interview_id: str,
    payload: schemas.InterviewUpdate,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    interview = _get_interview(db, interview_id, employer.organization_id)
    updates = payload.model_dump(exclude_unset=True)
    reschedule_notice = "scheduled_at" in updates or "interview_type" in updates
    for field, value in updates.items():
        setattr(interview, field, value)
    if reschedule_notice:
        # A changed time/type means the candidate's earlier confirmation no
        # longer applies — they must confirm again before this is joinable.
        interview.availability_status = models.AvailabilityStatus.PENDING
    db.commit()
    db.refresh(interview)
    if reschedule_notice:
        candidate = _get_candidate(db, interview.candidate_id, employer.organization_id)
        _send_availability_request(candidate, interview)
    return interview


@router.delete("/interviews/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interview(
    interview_id: str,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    interview = _get_interview(db, interview_id, employer.organization_id)
    db.delete(interview)
    db.commit()


# --- Availability confirmation, consent, and identity snapshot (public,
# no login — candidate-facing). Same trust model as the rest of this section:
# the interview's own UUID is the access key. --------------------------------


@router.get("/interviews/{interview_id}/availability", response_model=schemas.AvailabilityOut)
def get_interview_availability(interview_id: str, db: Session = Depends(get_db)):
    interview = _get_interview(db, interview_id)
    candidate = _get_candidate(db, interview.candidate_id)
    return schemas.AvailabilityOut(
        candidate_name=candidate.applicant_name,
        interview_type=interview.interview_type,
        scheduled_at=interview.scheduled_at,
        duration_minutes=interview.duration_minutes,
        interviewer_name=interview.interviewer_name,
        availability_status=interview.availability_status,
    )


@router.post("/interviews/{interview_id}/availability/accept", response_model=schemas.AvailabilityOut)
def accept_interview_availability(interview_id: str, db: Session = Depends(get_db)):
    interview = _get_interview(db, interview_id)
    candidate = _get_candidate(db, interview.candidate_id)
    interview.availability_status = models.AvailabilityStatus.ACCEPTED
    db.commit()
    db.refresh(interview)
    _send_interview_invite(candidate, interview)
    return schemas.AvailabilityOut(
        candidate_name=candidate.applicant_name,
        interview_type=interview.interview_type,
        scheduled_at=interview.scheduled_at,
        duration_minutes=interview.duration_minutes,
        interviewer_name=interview.interviewer_name,
        availability_status=interview.availability_status,
    )


@router.post("/interviews/{interview_id}/availability/decline", response_model=schemas.AvailabilityOut)
def decline_interview_availability(interview_id: str, db: Session = Depends(get_db)):
    interview = _get_interview(db, interview_id)
    candidate = _get_candidate(db, interview.candidate_id)
    interview.availability_status = models.AvailabilityStatus.DECLINED
    db.commit()
    db.refresh(interview)
    return schemas.AvailabilityOut(
        candidate_name=candidate.applicant_name,
        interview_type=interview.interview_type,
        scheduled_at=interview.scheduled_at,
        duration_minutes=interview.duration_minutes,
        interviewer_name=interview.interviewer_name,
        availability_status=interview.availability_status,
    )


@router.post("/interviews/{interview_id}/consent", response_model=schemas.InterviewOut)
def accept_interview_consent(
    interview_id: str,
    payload: schemas.ConsentAcceptRequest,
    db: Session = Depends(get_db),
):
    if not (
        payload.recording_and_ai_evaluation
        and payload.proctoring_and_identity_snapshot
        and payload.data_storage_and_retention
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All consent sections must be accepted to continue.",
        )
    interview = _get_interview(db, interview_id)
    interview.consent_accepted = True
    interview.consent_given_at = datetime.utcnow()
    db.commit()
    db.refresh(interview)
    return interview


@router.post("/interviews/{interview_id}/identity-snapshot")
async def upload_identity_snapshot(
    interview_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """A single webcam snapshot captured the moment the candidate joins,
    kept as an audit record of who actually showed up. Not automated face
    matching — just evidence the employer can review afterward."""
    interview = _get_interview(db, interview_id)

    os.makedirs(IDENTITY_SNAPSHOTS_DIR, exist_ok=True)
    filename = f"{interview_id}_{uuid.uuid4().hex[:8]}.jpg"
    dest_path = os.path.join(IDENTITY_SNAPSHOTS_DIR, filename)

    size = 0
    max_bytes = 5 * 1024 * 1024  # 5MB is generous for a single JPEG frame
    with open(dest_path, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > max_bytes:
                out.close()
                os.remove(dest_path)
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Snapshot too large.")
            out.write(chunk)

    url = f"/media/identity_snapshots/{filename}"
    interview.identity_snapshot_url = url
    db.commit()
    return {"url": url}


# --- Bot interview attempt (public, no login — candidate-facing) -------------
# The interview's own UUID acts as the unguessable access key, same trust
# model as the public video call room (app/routers/signaling.py).


@router.get("/interviews/{interview_id}/attempt", response_model=schemas.InterviewAttemptOut)
def get_interview_attempt(interview_id: str, db: Session = Depends(get_db)):
    interview = _get_interview(db, interview_id)
    if interview.interview_type != models.InterviewType.BOT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This is not a bot interview."
        )
    candidate = _get_candidate(db, interview.candidate_id)

    if not interview.questions:
        latest_application = (
            db.query(models.JobApplication)
            .options(joinedload(models.JobApplication.job))
            .filter(models.JobApplication.candidate_id == candidate.id)
            .order_by(models.JobApplication.created_at.desc())
            .first()
        )
        job = latest_application.job if latest_application else None
        resume_text = ai.fetch_resume_text(candidate.resume_url)
        interview.questions = ai.generate_interview_questions(
            candidate_name=candidate.applicant_name,
            job_title=job.title if job else None,
            job_description=job.description if job else None,
            resume_text=resume_text,
        )
        db.commit()
        db.refresh(interview)

    return schemas.InterviewAttemptOut(
        candidate_name=candidate.applicant_name,
        interview_type=interview.interview_type,
        status=interview.status,
        scheduled_at=interview.scheduled_at,
        duration_minutes=interview.duration_minutes,
        questions=interview.questions or ai.DEFAULT_QUESTIONS,
        availability_status=interview.availability_status,
        consent_accepted=interview.consent_accepted,
    )


@router.post("/interviews/{interview_id}/attempt", response_model=schemas.InterviewAttemptOut)
def submit_interview_attempt(
    interview_id: str,
    payload: schemas.InterviewAttemptSubmit,
    db: Session = Depends(get_db),
):
    interview = _get_interview(db, interview_id)
    if interview.interview_type != models.InterviewType.BOT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This is not a bot interview."
        )
    if interview.status != models.InterviewStatus.SCHEDULED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This interview has already been completed.",
        )
    if interview.availability_status != models.AvailabilityStatus.ACCEPTED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please confirm your availability for this interview first.",
        )
    if not interview.consent_accepted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please accept the consent form before submitting.",
        )

    qa_pairs = [{"question": a.question, "answer": a.answer} for a in payload.answers]
    transcript = "Nextenti Bot Interview Transcript\n\n" + "\n\n".join(
        f"{i + 1}. Q: {p['question']}\n   A: {p['answer']}" for i, p in enumerate(qa_pairs)
    )

    # Server-side half of proctoring: even if the client's own violation
    # detection got tampered with (see /heartbeat below), a submission that
    # arrives after its heartbeats went stale for too long is cancelled
    # instead of completed, and skipped for AI evaluation.
    if interview.last_heartbeat_at and (
        datetime.utcnow() - interview.last_heartbeat_at > timedelta(seconds=MAX_HEARTBEAT_GAP_SECONDS)
    ):
        interview.status = models.InterviewStatus.CANCELLED
        interview.notes = transcript + "\n\n[TERMINATED by server: heartbeat gap exceeded before submission]"
        db.commit()
        db.refresh(interview)
        candidate = _get_candidate(db, interview.candidate_id)
        return schemas.InterviewAttemptOut(
            candidate_name=candidate.applicant_name,
            interview_type=interview.interview_type,
            status=interview.status,
            scheduled_at=interview.scheduled_at,
            duration_minutes=interview.duration_minutes,
            questions=interview.questions or [],
            availability_status=interview.availability_status,
            consent_accepted=interview.consent_accepted,
        )

    interview.status = models.InterviewStatus.COMPLETED
    interview.notes = transcript
    if payload.duration_minutes:
        interview.duration_minutes = payload.duration_minutes
    db.commit()

    speaking_metrics = (
        [m.model_dump() for m in payload.speaking_metrics] if payload.speaking_metrics else None
    )
    evaluation = ai.evaluate_soft_skills(qa_pairs, mode=payload.mode, speaking_metrics=speaking_metrics)
    if evaluation:
        _apply_auto_screening(db, _get_candidate(db, interview.candidate_id), evaluation)
        interview.ai_evaluation = evaluation
        db.commit()

    db.refresh(interview)
    candidate = _get_candidate(db, interview.candidate_id)
    return schemas.InterviewAttemptOut(
        candidate_name=candidate.applicant_name,
        interview_type=interview.interview_type,
        status=interview.status,
        scheduled_at=interview.scheduled_at,
        duration_minutes=interview.duration_minutes,
        questions=interview.questions or [],
        availability_status=interview.availability_status,
        consent_accepted=interview.consent_accepted,
    )


@router.post("/interviews/{interview_id}/terminate", response_model=schemas.InterviewAttemptOut)
def terminate_interview_attempt(
    interview_id: str,
    payload: schemas.InterviewTerminateRequest,
    db: Session = Depends(get_db),
):
    """Called by the client-side proctoring monitor (tab switch, camera/face lost, or
    screen-share stopped) to immediately end an in-progress bot interview. Whatever
    answers were already given are saved, but the interview is marked cancelled rather
    than completed, and is not sent for AI evaluation."""
    interview = _get_interview(db, interview_id)
    if interview.interview_type != models.InterviewType.BOT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This is not a bot interview."
        )
    if interview.status != models.InterviewStatus.SCHEDULED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This interview has already ended.",
        )

    qa_pairs = [{"question": a.question, "answer": a.answer} for a in payload.answers]
    transcript = "Nextenti Bot Interview Transcript (ended early)\n\n" + (
        "\n\n".join(f"{i + 1}. Q: {p['question']}\n   A: {p['answer']}" for i, p in enumerate(qa_pairs))
        or "(no answers were given before the interview ended)"
    )
    transcript += f"\n\n[TERMINATED by proctoring: {payload.reason}]"

    interview.status = models.InterviewStatus.CANCELLED
    interview.notes = transcript
    db.commit()
    db.refresh(interview)

    candidate = _get_candidate(db, interview.candidate_id)
    return schemas.InterviewAttemptOut(
        candidate_name=candidate.applicant_name,
        interview_type=interview.interview_type,
        status=interview.status,
        scheduled_at=interview.scheduled_at,
        duration_minutes=interview.duration_minutes,
        questions=interview.questions or [],
        availability_status=interview.availability_status,
        consent_accepted=interview.consent_accepted,
    )


@router.post("/interviews/{interview_id}/heartbeat", response_model=schemas.InterviewHeartbeatOut)
def heartbeat_interview_attempt(interview_id: str, db: Session = Depends(get_db)):
    """Pinged every few seconds by the candidate's browser while a bot interview
    attempt is in progress. This is the server-side half of proctoring: the
    tab-switch/face/screen-share checks all live in the browser and could in
    theory be tampered with, but a heartbeat gap this large gets caught here
    regardless of what the client reports (or stops reporting)."""
    interview = _get_interview(db, interview_id)
    if interview.interview_type != models.InterviewType.BOT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This is not a bot interview."
        )
    if interview.status != models.InterviewStatus.SCHEDULED:
        return schemas.InterviewHeartbeatOut(status=interview.status, terminated=False)

    now = datetime.utcnow()
    if interview.last_heartbeat_at and now - interview.last_heartbeat_at > timedelta(
        seconds=MAX_HEARTBEAT_GAP_SECONDS
    ):
        interview.status = models.InterviewStatus.CANCELLED
        interview.notes = (
            f"{interview.notes}\n\n" if interview.notes else ""
        ) + "[TERMINATED by server: heartbeat gap exceeded — the client stopped reporting in for too long]"
        db.commit()
        db.refresh(interview)
        return schemas.InterviewHeartbeatOut(status=interview.status, terminated=True)

    interview.last_heartbeat_at = now
    db.commit()
    return schemas.InterviewHeartbeatOut(status=interview.status, terminated=False)


# --- Offers (shared across the employer team) --------------------------------


@router.post(
    "/candidates/{candidate_id}/offers",
    response_model=schemas.OfferOut,
    status_code=status.HTTP_201_CREATED,
)
def create_offer(
    candidate_id: str,
    payload: schemas.OfferCreate,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    candidate = _get_candidate(db, candidate_id, employer.organization_id)
    offer = models.Offer(**payload.model_dump(), candidate_id=candidate.id, created_by=employer.id)
    db.add(offer)
    db.commit()
    db.refresh(offer)
    return offer


@router.get("/candidates/{candidate_id}/offers", response_model=list[schemas.OfferOut])
def list_offers_for_candidate(
    candidate_id: str,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    candidate = _get_candidate(db, candidate_id, employer.organization_id)
    return (
        db.query(models.Offer)
        .filter(models.Offer.candidate_id == candidate.id)
        .order_by(models.Offer.created_at.desc())
        .all()
    )


@router.get("/offers", response_model=list[schemas.OfferOut])
def list_offers(
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Offer)
        .join(models.Candidate)
        .filter(models.Candidate.organization_id == employer.organization_id)
        .order_by(models.Offer.created_at.desc())
        .all()
    )


@router.get("/offers/{offer_id}", response_model=schemas.OfferOut)
def get_offer(
    offer_id: str,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    return _get_offer(db, offer_id, employer.organization_id)


@router.patch("/offers/{offer_id}", response_model=schemas.OfferOut)
def update_offer(
    offer_id: str,
    payload: schemas.OfferUpdate,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    offer = _get_offer(db, offer_id, employer.organization_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(offer, field, value)
    db.commit()
    db.refresh(offer)
    return offer


@router.delete("/offers/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_offer(
    offer_id: str,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    offer = _get_offer(db, offer_id, employer.organization_id)
    db.delete(offer)
    db.commit()
