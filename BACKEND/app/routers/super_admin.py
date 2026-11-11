from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.email import send_verification_email
from app.security import create_purpose_token, hash_password, require_super_admin

router = APIRouter(prefix="/admin", tags=["super-admin"])

VERIFY_EMAIL_PURPOSE = "verify_email"
VERIFY_EMAIL_EXPIRE_MINUTES = 60 * 24


def _org_out(db: Session, org: models.Organization) -> schemas.OrganizationOut:
    employer_count = (
        db.query(models.User)
        .filter(models.User.organization_id == org.id, models.User.role == models.UserRole.EMPLOYER)
        .count()
    )
    candidate_count = (
        db.query(models.Candidate).filter(models.Candidate.organization_id == org.id).count()
    )
    job_count = db.query(models.Job).filter(models.Job.organization_id == org.id).count()
    org.employer_count = employer_count  # type: ignore[attr-defined]
    org.candidate_count = candidate_count  # type: ignore[attr-defined]
    org.job_count = job_count  # type: ignore[attr-defined]
    return schemas.OrganizationOut.model_validate(org)


def _get_org(db: Session, org_id: str) -> models.Organization:
    org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    return org


@router.get("/organizations", response_model=list[schemas.OrganizationOut])
def list_organizations(
    _admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    orgs = db.query(models.Organization).order_by(models.Organization.created_at.desc()).all()
    return [_org_out(db, org) for org in orgs]


@router.get("/organizations/{org_id}", response_model=schemas.OrganizationOut)
def get_organization(
    org_id: str,
    _admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    return _org_out(db, _get_org(db, org_id))


@router.post(
    "/organizations", response_model=schemas.OrganizationOut, status_code=status.HTTP_201_CREATED
)
def create_organization(
    payload: schemas.OrganizationCreate,
    background_tasks: BackgroundTasks,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Create a new organization along with its first employer (admin) login,
    granting that organization access to Nextenti in one step."""
    org = models.Organization(name=payload.name, created_by=admin.id)
    db.add(org)
    db.flush()

    user = models.User(
        email=payload.admin_email,
        hashed_password=hash_password(payload.admin_password),
        full_name=payload.admin_full_name,
        role=models.UserRole.EMPLOYER,
        is_verified=False,
        organization_id=org.id,
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
    db.refresh(org)
    db.refresh(user)

    token = create_purpose_token(str(user.id), VERIFY_EMAIL_PURPOSE, VERIFY_EMAIL_EXPIRE_MINUTES)
    background_tasks.add_task(send_verification_email, user.email, user.full_name, token)

    return _org_out(db, org)


@router.patch("/organizations/{org_id}", response_model=schemas.OrganizationOut)
def update_organization(
    org_id: str,
    payload: schemas.OrganizationUpdate,
    _admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    org = _get_org(db, org_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    db.commit()
    db.refresh(org)
    return _org_out(db, org)


@router.delete("/organizations/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization(
    org_id: str,
    _admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    org = _get_org(db, org_id)
    db.delete(org)
    db.commit()
