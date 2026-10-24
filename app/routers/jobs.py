from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app import models, schemas
from app.database import get_db
from app.email import send_application_received_email
from app.routers.candidates import find_candidate_by_email, find_candidate_ids_by_email
from app.security import require_candidate, require_employer

router = APIRouter(tags=["jobs"])

TERMINAL_APPLICATION_STATUSES = {
    models.JobApplicationStatus.HIRED,
    models.JobApplicationStatus.REJECTED,
    models.JobApplicationStatus.WITHDRAWN,
}


def _job_out(job: models.Job) -> schemas.JobOut:
    job.application_count = len(job.applications)  # type: ignore[attr-defined]
    job.created_by_name = job.creator.full_name if job.creator else None  # type: ignore[attr-defined]
    job.created_by_email = job.creator.email if job.creator else None  # type: ignore[attr-defined]
    return schemas.JobOut.model_validate(job)


def _get_job(db: Session, job_id: str, organization_id: str | None = None) -> models.Job:
    query = (
        db.query(models.Job)
        .options(joinedload(models.Job.applications), joinedload(models.Job.creator))
        .filter(models.Job.id == job_id)
    )
    if organization_id is not None:
        query = query.filter(models.Job.organization_id == organization_id)
    job = query.first()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    return job


def _job_application_out(application: models.JobApplication) -> schemas.JobApplicationOut:
    application.job_title = application.job.title  # type: ignore[attr-defined]
    return schemas.JobApplicationOut.model_validate(application)


def _get_application(
    db: Session, application_id: str, organization_id: str | None = None
) -> models.JobApplication:
    query = (
        db.query(models.JobApplication)
        .options(joinedload(models.JobApplication.job), joinedload(models.JobApplication.candidate))
        .filter(models.JobApplication.id == application_id)
    )
    if organization_id is not None:
        query = query.join(models.Job).filter(models.Job.organization_id == organization_id)
    application = query.first()
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    return application


# --- Employer: job CRUD -------------------------------------------------


@router.post("/jobs", response_model=schemas.JobOut, status_code=status.HTTP_201_CREATED)
def create_job(
    payload: schemas.JobCreate,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    job = models.Job(
        **payload.model_dump(), created_by=employer.id, organization_id=employer.organization_id
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    job.applications = []
    job.creator = employer
    return _job_out(job)


@router.get("/jobs", response_model=list[schemas.JobOut])
def list_jobs(
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    jobs = (
        db.query(models.Job)
        .options(joinedload(models.Job.applications), joinedload(models.Job.creator))
        .filter(models.Job.organization_id == employer.organization_id)
        .order_by(models.Job.created_at.desc())
        .all()
    )
    return [_job_out(job) for job in jobs]


# --- Candidate: job board + my applications (must precede /jobs/{job_id}) --


@router.get("/jobs/board", response_model=list[schemas.JobBoardOut])
def list_open_jobs(
    current_user: models.User = Depends(require_candidate),
    db: Session = Depends(get_db),
):
    jobs = (
        db.query(models.Job)
        .filter(models.Job.status == models.JobStatus.OPEN)
        .order_by(models.Job.created_at.desc())
        .all()
    )

    applied_status_by_job: dict = {}
    candidate_ids = find_candidate_ids_by_email(db, current_user.email)
    if candidate_ids:
        applications = (
            db.query(models.JobApplication)
            .filter(models.JobApplication.candidate_id.in_(candidate_ids))
            .all()
        )
        applied_status_by_job = {app.job_id: app.status for app in applications}

    results = []
    for job in jobs:
        applied_status = applied_status_by_job.get(job.id)
        results.append(
            schemas.JobBoardOut(
                id=job.id,
                title=job.title,
                description=job.description,
                department=job.department,
                location=job.location,
                employment_type=job.employment_type,
                salary_min=job.salary_min,
                salary_max=job.salary_max,
                created_at=job.created_at,
                already_applied=applied_status is not None,
                my_application_status=applied_status,
            )
        )
    return results


@router.get("/jobs/mine", response_model=list[schemas.MyApplicationOut])
def list_my_applications(
    current_user: models.User = Depends(require_candidate),
    db: Session = Depends(get_db),
):
    candidate_ids = find_candidate_ids_by_email(db, current_user.email)
    if not candidate_ids:
        return []
    applications = (
        db.query(models.JobApplication)
        .options(joinedload(models.JobApplication.job))
        .filter(models.JobApplication.candidate_id.in_(candidate_ids))
        .order_by(models.JobApplication.created_at.desc())
        .all()
    )
    return applications


# --- Employer: single job CRUD ------------------------------------------


@router.get("/jobs/{job_id}", response_model=schemas.JobOut)
def get_job(
    job_id: str,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    return _job_out(_get_job(db, job_id, employer.organization_id))


@router.patch("/jobs/{job_id}", response_model=schemas.JobOut)
def update_job(
    job_id: str,
    payload: schemas.JobUpdate,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    job = _get_job(db, job_id, employer.organization_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    return _job_out(job)


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: str,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    job = _get_job(db, job_id, employer.organization_id)
    if job.created_by != employer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the employer who posted this job can remove it.",
        )
    db.delete(job)
    db.commit()


# --- Employer: applicants for a job -------------------------------------


@router.get("/jobs/{job_id}/applications", response_model=list[schemas.JobApplicationOut])
def list_applications_for_job(
    job_id: str,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    _get_job(db, job_id, employer.organization_id)
    applications = (
        db.query(models.JobApplication)
        .options(joinedload(models.JobApplication.job), joinedload(models.JobApplication.candidate))
        .filter(models.JobApplication.job_id == job_id)
        .order_by(models.JobApplication.created_at.desc())
        .all()
    )
    return [_job_application_out(a) for a in applications]


@router.post(
    "/jobs/{job_id}/applications",
    response_model=schemas.JobApplicationOut,
    status_code=status.HTTP_201_CREATED,
)
def link_candidate_to_job(
    job_id: str,
    payload: schemas.JobApplicationCreate,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    job = _get_job(db, job_id, employer.organization_id)
    candidate = (
        db.query(models.Candidate)
        .filter(
            models.Candidate.id == str(payload.candidate_id),
            models.Candidate.organization_id == employer.organization_id,
        )
        .first()
    )
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found.")

    existing = (
        db.query(models.JobApplication)
        .filter_by(job_id=job.id, candidate_id=candidate.id)
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This candidate is already linked to this job.",
        )

    application = models.JobApplication(job_id=job.id, candidate_id=candidate.id, created_by=employer.id)
    db.add(application)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This candidate is already linked to this job.",
        )
    db.refresh(application)
    return _job_application_out(application)


# --- Candidate: apply + withdraw ----------------------------------------


@router.post("/jobs/{job_id}/apply", response_model=schemas.JobApplicationOut, status_code=status.HTTP_201_CREATED)
def apply_to_job(
    job_id: str,
    payload: schemas.JobApplyRequest,
    current_user: models.User = Depends(require_candidate),
    db: Session = Depends(get_db),
):
    job = _get_job(db, job_id)
    if job.status != models.JobStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This job is no longer accepting applications.",
        )

    # Scoped to *this job's* organization — the same person applying to
    # different companies gets a separate Candidate pool record per company.
    candidate = find_candidate_by_email(db, current_user.email, str(job.organization_id))
    if candidate is None:
        candidate = models.Candidate(
            applicant_name=current_user.full_name,
            applicant_email=current_user.email,
            phone=payload.phone,
            resume_url=payload.resume_url,
            source="Job Board",
            organization_id=job.organization_id,
        )
        db.add(candidate)
        db.flush()

    existing = (
        db.query(models.JobApplication)
        .filter_by(job_id=job.id, candidate_id=candidate.id)
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You've already applied to this job.",
        )

    application = models.JobApplication(
        job_id=job.id, candidate_id=candidate.id, cover_letter=payload.cover_letter
    )
    db.add(application)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You've already applied to this job.",
        )
    db.refresh(application)

    send_application_received_email(
        to=candidate.applicant_email, candidate_name=candidate.applicant_name, job_title=job.title
    )
    return _job_application_out(application)


@router.patch("/jobs/mine/{application_id}/withdraw", response_model=schemas.MyApplicationOut)
def withdraw_application(
    application_id: str,
    current_user: models.User = Depends(require_candidate),
    db: Session = Depends(get_db),
):
    candidate_ids = find_candidate_ids_by_email(db, current_user.email)
    application = None
    if candidate_ids:
        application = (
            db.query(models.JobApplication)
            .options(joinedload(models.JobApplication.job))
            .filter(
                models.JobApplication.id == application_id,
                models.JobApplication.candidate_id.in_(candidate_ids),
            )
            .first()
        )
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    if application.status in TERMINAL_APPLICATION_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This application can no longer be withdrawn.",
        )
    application.status = models.JobApplicationStatus.WITHDRAWN
    db.commit()
    db.refresh(application)
    return application


# --- Employer: cross-job applicant management ---------------------------


@router.get("/job-applications", response_model=list[schemas.JobApplicationOut])
def list_all_applications(
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    applications = (
        db.query(models.JobApplication)
        .join(models.Job)
        .options(joinedload(models.JobApplication.job), joinedload(models.JobApplication.candidate))
        .filter(models.Job.organization_id == employer.organization_id)
        .order_by(models.JobApplication.created_at.desc())
        .all()
    )
    return [_job_application_out(a) for a in applications]


@router.get("/job-applications/{application_id}", response_model=schemas.JobApplicationOut)
def get_application(
    application_id: str,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    return _job_application_out(_get_application(db, application_id, employer.organization_id))


@router.patch("/job-applications/{application_id}", response_model=schemas.JobApplicationOut)
def update_application(
    application_id: str,
    payload: schemas.JobApplicationUpdate,
    employer: models.User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    application = _get_application(db, application_id, employer.organization_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(application, field, value)
    db.commit()
    db.refresh(application)
    return _job_application_out(application)
