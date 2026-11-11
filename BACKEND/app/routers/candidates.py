import os
import uuid
from urllib.parse import quote
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app import ai, models, portfolio, proctor_policy, resume_parser, schemas
from app.database import SessionLocal, get_db
from app.media_access import sign_media_url
from app.email import (
    FRONTEND_URL,
    send_availability_request_email,
    send_interview_invite_email,
    send_signup_invite_email,
)
from app.entitlements import enforce_candidate_limit, enforce_interview_limit
from app.notifications import notify_employers
from app.security import parse_uuid_or_404, require_employer, require_interview_candidate

MEDIA_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "media")
IDENTITY_SNAPSHOTS_DIR = os.path.join(MEDIA_ROOT, "identity_snapshots")
FACE_SCANS_DIR = os.path.join(MEDIA_ROOT, "face_scans")

# Four-corner verification: the candidate looks at a centre dot, then each screen corner in turn.
FACE_SCAN_ANGLES = ("center", "top_left", "top_right", "bottom_right", "bottom_left")
FACE_SCAN_MAX_BYTES = 600 * 1024
FACE_SCAN_TYPES = ("image/jpeg", "image/png", "image/webp")


def _looks_like_image(data: bytes) -> bool:
    """Cheap magic-byte check: the multipart Content-Type is client-supplied, so it proves nothing."""
    return (
        data.startswith(bytes([0xFF, 0xD8, 0xFF]))
        or data.startswith(bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
        or (data[:4] == b"RIFF" and data[8:12] == b"WEBP")
    )


def _remove_media(url: str | None, directory: str) -> None:
    """Delete a previously stored upload when it is replaced, so repeat uploads do not pile up on disk."""
    if not url:
        return
    path = os.path.join(directory, os.path.basename(url))
    try:
        if os.path.isfile(path):
            os.remove(path)
    except OSError:
        pass

router = APIRouter(tags=["candidates"])

# The client pings /interviews/{id}/heartbeat every few seconds while a bot interview is in progress. The ping is only
# recorded: a slow connection, a reload or a sleeping laptop must never cost a candidate their interview.

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


def _preload_has_account(db: Session, candidates) -> None:
    """Resolve has_account for a whole list with one query instead of one per candidate."""
    candidates = [c for c in candidates if c is not None]
    emails = {c.applicant_email.strip().lower() for c in candidates}
    found: set[str] = set()
    if emails:
        found = {
            email
            for (email,) in db.query(func.lower(models.User.email))
            .filter(
                func.lower(models.User.email).in_(emails),
                models.User.role == models.UserRole.CANDIDATE,
                models.User.is_verified.is_(True),
            )
            .all()
        }
    for c in candidates:
        c.__dict__["_has_account_preset"] = c.applicant_email.strip().lower() in found


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
    # The bot interview belongs to the application it was generated for (the latest), so one score must not
    # decide the candidate's applications to other jobs.
    applications = sorted(
        candidate.job_applications, key=lambda a: a.created_at or datetime.min, reverse=True
    )
    if applications and applications[0].status in _OPEN_APPLICATION_STATUSES:
        applications[0].status = new_status


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


def _signup_url(candidate: models.Candidate) -> str:
    return f"{FRONTEND_URL}/signup?role=candidate&email={quote(candidate.applicant_email)}"


def _deliver(background_tasks: BackgroundTasks | None, send, **kwargs) -> None:
    """Send an email after the response when a BackgroundTasks is given (SMTP is slow and must not pin the
    request's DB connection); all arguments are plain values read before queuing."""
    if background_tasks is None:
        send(**kwargs)
    else:
        background_tasks.add_task(send, **kwargs)


def _send_availability_request(
    candidate: models.Candidate, interview: models.Interview, background_tasks: BackgroundTasks | None = None
) -> None:
    """The candidate must confirm they're actually available for this slot
    before it's locked in — this is sent at scheduling time instead of the
    join link. The join link only goes out once they accept
    (see accept_interview_availability)."""
    if not candidate.applicant_email:
        return
    respond_url = f"{FRONTEND_URL}/interview-response/{interview.id}"
    _deliver(
        background_tasks,
        send_availability_request_email,
        to=candidate.applicant_email,
        candidate_name=candidate.applicant_name,
        interview_type=interview.interview_type.value,
        scheduled_at=interview.scheduled_at,
        interviewer_name=interview.interviewer_name,
        respond_url=respond_url,
        signup_url=None if candidate.has_account else _signup_url(candidate),
    )


def _send_interview_invite(
    candidate: models.Candidate, interview: models.Interview, background_tasks: BackgroundTasks | None = None
) -> None:
    """Sent once the candidate has confirmed availability — this carries the
    actual join link (if the interview type has one)."""
    if not candidate.applicant_email:
        return
    _deliver(
        background_tasks,
        send_interview_invite_email,
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
        .filter(models.Candidate.id == parse_uuid_or_404(candidate_id, "Candidate"))
    )
    if organization_id is not None:
        query = query.filter(models.Candidate.organization_id == organization_id)
    candidate = query.first()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found.")
    return candidate


def _get_offer(db: Session, offer_id: str, organization_id: str | None = None) -> models.Offer:
    query = db.query(models.Offer).filter(models.Offer.id == parse_uuid_or_404(offer_id, "Offer"))
    if organization_id is not None:
        query = query.join(models.Candidate).filter(
            models.Candidate.organization_id == organization_id
        )
    offer = query.first()
    if offer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offer not found.")
    return offer


def _latest_application(db: Session, candidate_id) -> models.JobApplication | None:
    return (
        db.query(models.JobApplication)
        .options(joinedload(models.JobApplication.job))
        .filter(models.JobApplication.candidate_id == candidate_id)
        .order_by(models.JobApplication.created_at.desc())
        .first()
    )


def _proctor_fields(db: Session, interview: models.Interview) -> dict:
    """How many look-away warnings this interview allows: from the role's experience level, or the candidate's
    own experience on their resume when the role doesn't say."""
    application = _latest_application(db, interview.candidate_id)
    job_years = application.job.experience_min_years if application and application.job else None
    resume_years = None
    if application and isinstance(application.resume_data, dict):
        resume_years = application.resume_data.get("total_experience_years")
    policy = proctor_policy.warning_policy(job_years, resume_years)
    return {"max_warnings": policy["max_warnings"], "experience_level": policy["experience_level"]}


def _god_fields(db: Session, interview: models.Interview) -> dict:
    """Extras of the candidate attempt payload: tier/avatar placeholders, whether the face scan is done,
    and the look-away warning allowance."""
    return {
        "tier": "standard",
        "interviewer_name": interview.interviewer_name,
        "avatar": None,
        "face_scan_done": interview.face_scan_done,
        **_proctor_fields(db, interview),
    }


def _get_interview(
    db: Session, interview_id: str, organization_id: str | None = None
) -> models.Interview:
    query = db.query(models.Interview).filter(models.Interview.id == parse_uuid_or_404(interview_id, "Interview"))
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
    enforce_candidate_limit(db, employer.organization_id)
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
    _preload_has_account(db, candidates)
    return [_candidate_out(candidate) for candidate in candidates]


@router.post("/candidates/{candidate_id}/invite-signup", response_model=schemas.MessageResponse)
def invite_candidate_to_sign_up(
    candidate_id: str,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    candidate = _get_candidate(db, candidate_id, employer.organization_id)
    if candidate.has_account:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This candidate already has an account."
        )
    company = candidate.organization.name if candidate.organization else "Your recruiter"
    send_signup_invite_email(
        to=candidate.applicant_email,
        candidate_name=candidate.applicant_name,
        company_name=company,
        signup_url=_signup_url(candidate),
    )
    return schemas.MessageResponse(detail=f"Sign-up invitation sent to {candidate.applicant_email}.")


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
    background_tasks: BackgroundTasks,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    candidate = _get_candidate(db, candidate_id, employer.organization_id)
    enforce_interview_limit(db, employer.organization_id, payload.interview_type)
    interview = models.Interview(
        **payload.model_dump(exclude={"tier"}),
        candidate_id=candidate.id,
        created_by=employer.id,
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)
    _send_availability_request(candidate, interview, background_tasks)
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
    interviews = (
        db.query(models.Interview)
        .join(models.Candidate)
        .options(joinedload(models.Interview.candidate))
        .filter(models.Candidate.organization_id == employer.organization_id)
        .order_by(models.Interview.scheduled_at.asc())
        .all()
    )
    _preload_has_account(db, {i.candidate_id: i.candidate for i in interviews}.values())
    return interviews


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
    background_tasks: BackgroundTasks,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    interview = _get_interview(db, interview_id, employer.organization_id)
    updates = payload.model_dump(exclude_unset=True)
    updates.pop("tier", None)
    new_type = updates.get("interview_type", interview.interview_type)
    new_status = updates.get("status", interview.status)
    if new_status != models.InterviewStatus.CANCELLED and (
        new_type != interview.interview_type or interview.status == models.InterviewStatus.CANCELLED
    ):
        # Becoming a metered bot/video interview (or un-cancelling one) uses quota just like creating it.
        enforce_interview_limit(db, employer.organization_id, new_type)
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
        _send_availability_request(candidate, interview, background_tasks)
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
def get_interview_availability(
    interview_id: str,
    db: Session = Depends(get_db),
    _access: models.Interview = Depends(require_interview_candidate),
):
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
def accept_interview_availability(
    interview_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _access: models.Interview = Depends(require_interview_candidate),
):
    interview = _get_interview(db, interview_id)
    candidate = _get_candidate(db, interview.candidate_id)
    if interview.status != models.InterviewStatus.SCHEDULED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This interview can no longer be accepted.",
        )
    # Replaying the link must not re-send the invite email or re-notify the employer.
    if interview.availability_status != models.AvailabilityStatus.ACCEPTED:
        interview.availability_status = models.AvailabilityStatus.ACCEPTED
        interview.availability_responded_at = datetime.utcnow()
        notify_employers(
            db,
            organization_id=candidate.organization_id,
            type="interview_accepted",
            title="Interview accepted",
            body=(
                f"{candidate.applicant_name} accepted the {interview.interview_type.value} interview on "
                f"{interview.scheduled_at:%a, %b %d at %I:%M %p}. You can now join it."
            ),
            link=f"/employer/candidates/{candidate.id}",
            interview_id=interview.id,
        )
        db.commit()
        db.refresh(interview)
        _send_interview_invite(candidate, interview, background_tasks)
    return schemas.AvailabilityOut(
        candidate_name=candidate.applicant_name,
        interview_type=interview.interview_type,
        scheduled_at=interview.scheduled_at,
        duration_minutes=interview.duration_minutes,
        interviewer_name=interview.interviewer_name,
        availability_status=interview.availability_status,
    )


@router.post("/interviews/{interview_id}/availability/decline", response_model=schemas.AvailabilityOut)
def decline_interview_availability(
    interview_id: str,
    db: Session = Depends(get_db),
    _access: models.Interview = Depends(require_interview_candidate),
):
    interview = _get_interview(db, interview_id)
    candidate = _get_candidate(db, interview.candidate_id)
    if interview.status != models.InterviewStatus.SCHEDULED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This interview can no longer be declined.",
        )
    if interview.availability_status != models.AvailabilityStatus.DECLINED:
        interview.availability_status = models.AvailabilityStatus.DECLINED
        interview.availability_responded_at = datetime.utcnow()
        notify_employers(
            db,
            organization_id=candidate.organization_id,
            type="interview_declined",
            title="Interview declined",
            body=(
                f"{candidate.applicant_name} declined the {interview.interview_type.value} interview on "
                f"{interview.scheduled_at:%a, %b %d at %I:%M %p}. Reschedule to offer a new time."
            ),
            link=f"/employer/candidates/{candidate.id}",
            interview_id=interview.id,
        )
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
    _access: models.Interview = Depends(require_interview_candidate),
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
    _access: models.Interview = Depends(require_interview_candidate),
):
    """A single webcam snapshot captured the moment the candidate joins,
    kept as an audit record of who actually showed up. Not automated face
    matching — just evidence the employer can review afterward."""
    interview = _get_interview(db, interview_id)
    if interview.status != models.InterviewStatus.SCHEDULED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This interview is no longer open.")
    first = await file.read(1024 * 1024)
    if not _looks_like_image(first):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The snapshot must be an image.")

    os.makedirs(IDENTITY_SNAPSHOTS_DIR, exist_ok=True)
    filename = f"{interview_id}_{uuid.uuid4().hex[:8]}.jpg"
    dest_path = os.path.join(IDENTITY_SNAPSHOTS_DIR, filename)

    size = 0
    max_bytes = 5 * 1024 * 1024  # 5MB is generous for a single JPEG frame
    with open(dest_path, "wb") as out:
        chunk = first
        while chunk:
            size += len(chunk)
            if size > max_bytes:
                out.close()
                os.remove(dest_path)
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Snapshot too large.")
            out.write(chunk)
            chunk = await file.read(1024 * 1024)

    url = f"/media/identity_snapshots/{filename}"
    _remove_media(interview.identity_snapshot_url, IDENTITY_SNAPSHOTS_DIR)
    interview.identity_snapshot_url = url
    db.commit()
    return {"url": sign_media_url(url)}


@router.post("/interviews/{interview_id}/face-scan")
async def upload_face_scan(
    interview_id: str,
    shots: list[UploadFile] = File(...),
    angles: str = Form(...),
    db: Session = Depends(get_db),
    _access: models.Interview = Depends(require_interview_candidate),
):
    """The four-corner verification: one frame per step (centre + the four screen corners), kept as
    audit evidence for the employer. The scan only counts once every step is present."""
    interview = _get_interview(db, interview_id)
    if interview.status != models.InterviewStatus.SCHEDULED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This interview is no longer open.")

    names = [a.strip() for a in angles.split(",")]
    if len(names) != len(shots) or sorted(names) != sorted(FACE_SCAN_ANGLES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The face scan must include the centre and all four corners.",
        )

    os.makedirs(FACE_SCANS_DIR, exist_ok=True)
    batch = uuid.uuid4().hex[:8]
    saved: list[tuple[str, str]] = []  # (angle, path) so a failure part-way leaves nothing behind
    try:
        for angle, shot in zip(names, shots):
            if shot.content_type not in FACE_SCAN_TYPES:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Face scan frames must be images.")
            data = await shot.read(FACE_SCAN_MAX_BYTES + 1)
            if not _looks_like_image(data):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Face scan frames must be images.")
            if len(data) > FACE_SCAN_MAX_BYTES:
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="A face scan frame is too large.")
            filename = f"{interview_id}_{batch}_{angle}.jpg"
            path = os.path.join(FACE_SCANS_DIR, filename)
            with open(path, "wb") as out:
                out.write(data)
            saved.append((angle, path))
    except HTTPException:
        for _angle, path in saved:
            if os.path.exists(path):
                os.remove(path)
        raise

    urls = [{"angle": angle, "url": f"/media/face_scans/{os.path.basename(path)}"} for angle, path in saved]
    for old in interview.face_scan_urls or []:
        _remove_media(old.get("url") if isinstance(old, dict) else None, FACE_SCANS_DIR)
    interview.face_scan_urls = urls
    # A fresh verification starts a fresh session: the heartbeat gap is only measured within one session,
    # so a reload or reopened tab is not cancelled for the time spent coming back through setup.
    interview.last_heartbeat_at = None
    db.commit()
    return {"face_scan_urls": [{"angle": u["angle"], "url": sign_media_url(u["url"])} for u in urls]}


# --- Bot interview attempt (public, no login — candidate-facing) -------------
# The interview's own UUID acts as the unguessable access key, same trust
# model as the public video call room (app/routers/signaling.py).


@router.get("/interviews/{interview_id}/attempt", response_model=schemas.InterviewAttemptOut)
def get_interview_attempt(
    interview_id: str,
    db: Session = Depends(get_db),
    _access: models.Interview = Depends(require_interview_candidate),
):
    interview = _get_interview(db, interview_id)
    if interview.interview_type != models.InterviewType.BOT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This is not a bot interview."
        )
    candidate = _get_candidate(db, interview.candidate_id)

    if not interview.questions and interview.status == models.InterviewStatus.SCHEDULED:
        latest_application = _latest_application(db, candidate.id)
        job = latest_application.job if latest_application else None
        # Read everything the prompt needs, then release the pooled connection before the slow AI/network calls
        # (they can queue on the AI semaphore for a long time).
        candidate_name = candidate.applicant_name
        resume_url = candidate.resume_url
        job_title = job.title if job else None
        job_description = job.description if job else None
        experience_years = job.experience_min_years if job else None
        # Prefer what the candidate submitted with this application (parsed resume + portfolio); fall back to a
        # resume link on the candidate record.
        resume_text = resume_parser.resume_context(
            latest_application.resume_data if latest_application else None,
            latest_application.resume_text if latest_application else None,
        )
        portfolio_text = portfolio.question_context(latest_application.portfolio_data if latest_application else None)
        db.close()
        resume_text = resume_text or ai.fetch_resume_text(resume_url)
        questions = ai.generate_interview_questions(
            candidate_name=candidate_name,
            job_title=job_title,
            job_description=job_description,
            resume_text=resume_text,
            portfolio_text=portfolio_text,
            experience_years=experience_years,
        )
        interview = _get_interview(db, interview_id)
        candidate = _get_candidate(db, interview.candidate_id)
        if not interview.questions:
            interview.questions = questions
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
        **_god_fields(db, interview),
    )


def _score_bot_interview(
    interview_id, qa_pairs: list[dict], mode: str, speaking_metrics: list[dict] | None, warnings: int = 0
) -> None:
    """Background half of a bot-interview submission: AI scoring, auto-screening and the employer
    notification. Owns its DB session (the request's is closed by the time this runs)."""
    try:
        evaluation = ai.evaluate_soft_skills(qa_pairs, mode=mode, speaking_metrics=speaking_metrics)
        with SessionLocal() as db:
            interview = db.get(models.Interview, interview_id)
            if interview is None:
                return
            screened_candidate = _get_candidate(db, interview.candidate_id)
            if evaluation:
                _apply_auto_screening(db, screened_candidate, evaluation)
                evaluation["proctoring"] = {"look_away_warnings": warnings, **_proctor_fields(db, interview)}
                interview.ai_evaluation = evaluation
            if evaluation and "score" in evaluation:
                outcome = f"scored {evaluation['score']}/100 and was auto-{evaluation['auto_decision']}"
            elif evaluation:
                outcome = "was evaluated by AI"
            else:
                outcome = "finished (no AI score available)"
            notify_employers(
                db,
                organization_id=screened_candidate.organization_id,
                type="interview_completed",
                title="Bot interview completed",
                body=f"{screened_candidate.applicant_name} completed the bot interview and {outcome}.",
                link=f"/employer/candidates/{screened_candidate.id}",
                interview_id=interview.id,
            )
            db.commit()
    except Exception as exc:  # a background failure must never surface as a crashed worker
        print(f"[scoring] Failed to score interview {interview_id}: {exc}")


@router.post("/interviews/{interview_id}/attempt", response_model=schemas.InterviewAttemptOut)
def submit_interview_attempt(
    interview_id: str,
    payload: schemas.InterviewAttemptSubmit,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _access: models.Interview = Depends(require_interview_candidate),
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
    asked = [str(q).strip() for q in (interview.questions or ai.DEFAULT_QUESTIONS)]
    if len(payload.answers) > len(asked) or any(a.question.strip() not in asked for a in payload.answers):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The answers do not match the interview questions.",
        )
    qa_pairs = [{"question": a.question, "answer": a.answer} for a in payload.answers]
    transcript = "Elzuron Bot Interview Transcript\n\n" + "\n\n".join(
        f"{i + 1}. Q: {p['question']}\n   A: {p['answer']}" for i, p in enumerate(qa_pairs)
    )

    # Claim the submission atomically so a double submit cannot enqueue two evaluations.
    claim = {"status": models.InterviewStatus.COMPLETED, "notes": transcript}
    if payload.duration_minutes:
        claim["duration_minutes"] = payload.duration_minutes
    claimed = (
        db.query(models.Interview)
        .filter(models.Interview.id == interview.id, models.Interview.status == models.InterviewStatus.SCHEDULED)
        .update(claim, synchronize_session=False)
    )
    db.commit()
    if not claimed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This interview has already been completed.")

    speaking_metrics = (
        [m.model_dump() for m in payload.speaking_metrics] if payload.speaking_metrics else None
    )
    # Scoring is slow (an AI call, queued behind other interviews finishing at the same time), so it
    # runs after the response: the candidate is not left waiting on it and no request/connection is
    # held open meanwhile. The scorecard and the employer notification appear when it completes.
    background_tasks.add_task(
        _score_bot_interview, interview.id, qa_pairs, payload.mode, speaking_metrics, payload.warnings
    )

    db.refresh(interview)
    candidate = _get_candidate(db, interview.candidate_id)
    result = schemas.InterviewAttemptOut(
        candidate_name=candidate.applicant_name,
        interview_type=interview.interview_type,
        status=interview.status,
        scheduled_at=interview.scheduled_at,
        duration_minutes=interview.duration_minutes,
        questions=interview.questions or [],
        availability_status=interview.availability_status,
        consent_accepted=interview.consent_accepted,
        **_god_fields(db, interview),
    )
    # The request's session would otherwise stay checked out until the background scoring above
    # finishes (FastAPI closes it afterwards), pinning one pool connection per queued interview.
    db.close()
    return result


@router.post("/interviews/{interview_id}/terminate", response_model=schemas.InterviewAttemptOut)
def terminate_interview_attempt(
    interview_id: str,
    payload: schemas.InterviewTerminateRequest,
    db: Session = Depends(get_db),
    _access: models.Interview = Depends(require_interview_candidate),
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
    transcript = "Elzuron Bot Interview Transcript (ended early)\n\n" + (
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
        **_god_fields(db, interview),
    )


@router.post("/interviews/{interview_id}/heartbeat", response_model=schemas.InterviewHeartbeatOut)
def heartbeat_interview_attempt(
    interview_id: str,
    db: Session = Depends(get_db),
    _access: models.Interview = Depends(require_interview_candidate),
):
    """Pinged every few seconds by the candidate's browser while a bot interview is in progress.
    It only records that the candidate is still there; it never ends the interview."""
    interview = _get_interview(db, interview_id)
    if interview.interview_type != models.InterviewType.BOT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This is not a bot interview."
        )
    if interview.status != models.InterviewStatus.SCHEDULED:
        return schemas.InterviewHeartbeatOut(status=interview.status, terminated=False)

    now = datetime.utcnow()
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
