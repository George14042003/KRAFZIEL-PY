from datetime import date, datetime
from typing import Annotated, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, StringConstraints, field_validator

from app.models import (
    AvailabilityStatus,
    CandidateStatus,
    EmploymentType,
    InterviewStatus,
    InterviewType,
    JobApplicationStatus,
    JobStatus,
    OfferStatus,
    OrganizationStatus,
    UserRole,
)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1)


class EmployerRegisterRequest(RegisterRequest):
    organization_name: str = Field(min_length=1, max_length=200)


class LoginRequest(BaseModel):
    role: UserRole
    email: EmailStr
    password: str
    remember: bool = False


class GoogleAuthRequest(BaseModel):
    role: UserRole
    access_token: str

    @field_validator("role")
    @classmethod
    def _no_privileged_role(cls, v: UserRole) -> UserRole:
        if v not in (UserRole.CANDIDATE, UserRole.EMPLOYER):
            raise ValueError("Google sign-in is only available for candidate and employer accounts.")
        return v


class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: UserRole
    is_verified: bool
    organization_id: Optional[UUID] = None

    class Config:
        from_attributes = True


class OrganizationOut(BaseModel):
    id: UUID
    name: str
    status: OrganizationStatus
    created_at: datetime
    updated_at: datetime
    employer_count: int = 0
    candidate_count: int = 0
    job_count: int = 0

    class Config:
        from_attributes = True


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    admin_email: EmailStr
    admin_full_name: str = Field(min_length=1)
    admin_password: str = Field(min_length=8)


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    status: Optional[OrganizationStatus] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class VerifyEmailRequest(BaseModel):
    token: str


class EmailOnlyRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class MessageResponse(BaseModel):
    detail: str


class PublicStatsOut(BaseModel):
    organizations_count: int
    candidates_count: int
    interviews_completed_count: int
    jobs_posted_count: int


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(min_length=1)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class CandidateCreate(BaseModel):
    applicant_name: str = Field(min_length=1)
    applicant_email: EmailStr
    phone: Optional[str] = None
    source: Optional[str] = None
    resume_url: Optional[str] = None
    notes: Optional[str] = None
    status: CandidateStatus = CandidateStatus.PENDING


class CandidateUpdate(BaseModel):
    applicant_name: Optional[str] = Field(default=None, min_length=1)
    applicant_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    resume_url: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[CandidateStatus] = None


class CandidateOut(BaseModel):
    id: UUID
    applicant_name: str
    applicant_email: EmailStr
    phone: Optional[str]
    source: Optional[str]
    resume_url: Optional[str]
    notes: Optional[str]
    status: CandidateStatus
    created_at: datetime
    updated_at: datetime
    interview_count: int = 0
    offer_count: int = 0
    created_by_name: Optional[str] = None
    created_by_email: Optional[str] = None
    has_account: bool = False

    class Config:
        from_attributes = True


class InterviewPortalOut(BaseModel):
    id: UUID
    scheduled_at: datetime
    duration_minutes: int
    interview_type: InterviewType
    status: InterviewStatus
    interviewer_name: str
    location_or_link: Optional[str]
    ai_evaluation: Optional[dict] = None
    recording_urls: Optional[List[str]] = None

    class Config:
        from_attributes = True


class OfferPortalOut(BaseModel):
    id: UUID
    salary: int
    currency: str
    start_date: Optional[date]
    expires_at: Optional[date]
    status: OfferStatus

    class Config:
        from_attributes = True


class CandidatePortalOut(BaseModel):
    id: UUID
    applicant_name: str
    applicant_email: EmailStr
    phone: Optional[str]
    source: Optional[str]
    status: CandidateStatus
    created_at: datetime
    interviews: list[InterviewPortalOut] = []
    offers: list[OfferPortalOut] = []

    class Config:
        from_attributes = True


class CandidatePortalResponse(BaseModel):
    candidate: Optional[CandidatePortalOut] = None


class OfferCreate(BaseModel):
    salary: int = Field(ge=0)
    currency: str = Field(default="USD", min_length=1, max_length=8)
    start_date: Optional[date] = None
    expires_at: Optional[date] = None
    status: OfferStatus = OfferStatus.PENDING
    notes: Optional[str] = None


class OfferUpdate(BaseModel):
    salary: Optional[int] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, min_length=1, max_length=8)
    start_date: Optional[date] = None
    expires_at: Optional[date] = None
    status: Optional[OfferStatus] = None
    notes: Optional[str] = None


class OfferOut(BaseModel):
    id: UUID
    candidate_id: UUID
    salary: int
    currency: str
    start_date: Optional[date]
    expires_at: Optional[date]
    status: OfferStatus
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Digital twin (God level interviews); mirrors the frontend's avatarTypes.ts ---

HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
FaceFactor = Annotated[float, Field(ge=0.75, le=1.25)]
InterviewTier = Literal["standard", "god"]


class AvatarFace(BaseModel):
    width: FaceFactor
    height: FaceFactor
    jaw: FaceFactor
    eyeSpacing: FaceFactor
    mouthWidth: FaceFactor
    noseWidth: FaceFactor
    browHeight: FaceFactor


AVATAR_MESH_LENGTH = 468 * 3


class AvatarParams(BaseModel):
    version: Literal[1]
    skin: HexColor
    hair: HexColor
    eyes: HexColor
    shirt: HexColor
    hairStyle: Literal["bald", "buzz", "short", "medium", "long", "bun"]
    facialHair: Literal["none", "stubble", "beard"]
    glasses: bool
    face: AvatarFace
    # The scanned face's 468 landmarks as a flat [x, y, z, ...] list (cheek width = 1.0).
    mesh: Optional[List[float]] = None

    @field_validator("mesh")
    @classmethod
    def _check_mesh(cls, v):
        if v is None:
            return v
        if len(v) != AVATAR_MESH_LENGTH or any(abs(n) > 3 for n in v):
            raise ValueError("mesh must be 468 landmarks (1404 numbers) within [-3, 3]")
        return v


class AvatarProfileOut(BaseModel):
    params: Optional[AvatarParams] = None
    consent_at: Optional[datetime] = None


class AvatarProfileIn(BaseModel):
    params: AvatarParams
    consent: bool


class FaceScanShot(BaseModel):
    angle: str
    url: str


class InterviewCreate(BaseModel):
    tier: InterviewTier = "standard"
    scheduled_at: datetime
    duration_minutes: int = Field(default=30, ge=5, le=480)
    interview_type: InterviewType = InterviewType.PHONE
    status: InterviewStatus = InterviewStatus.SCHEDULED
    interviewer_name: str = Field(min_length=1)
    interviewer_email: Optional[EmailStr] = None
    location_or_link: Optional[str] = None
    notes: Optional[str] = None


class InterviewUpdate(BaseModel):
    tier: Optional[InterviewTier] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(default=None, ge=5, le=480)
    interview_type: Optional[InterviewType] = None
    status: Optional[InterviewStatus] = None
    interviewer_name: Optional[str] = Field(default=None, min_length=1)
    interviewer_email: Optional[EmailStr] = None
    location_or_link: Optional[str] = None
    notes: Optional[str] = None
    employer_feedback: Optional[str] = None
    employer_rating: Optional[int] = Field(default=None, ge=1, le=5)


class InterviewOut(BaseModel):
    id: UUID
    candidate_id: UUID
    scheduled_at: datetime
    duration_minutes: int
    interview_type: InterviewType
    status: InterviewStatus
    interviewer_name: str
    interviewer_email: Optional[EmailStr]
    location_or_link: Optional[str]
    notes: Optional[str]
    questions: Optional[List[str]] = None
    ai_evaluation: Optional[dict] = None
    recording_urls: Optional[List[str]] = None
    availability_status: AvailabilityStatus
    availability_responded_at: Optional[datetime] = None
    candidate_name: Optional[str] = None
    candidate_has_account: bool = False
    consent_accepted: bool
    consent_given_at: Optional[datetime] = None
    identity_snapshot_url: Optional[str] = None
    tier: InterviewTier = "standard"
    face_scan_urls: Optional[List[FaceScanShot]] = None
    face_scan_done: bool = False
    employer_feedback: Optional[str] = None
    employer_rating: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CallTranscriptTurn(BaseModel):
    speaker: Literal["candidate", "employer"]
    text: str = Field(max_length=4000)


class CallEvaluationRequest(BaseModel):
    transcript: List[CallTranscriptTurn] = Field(max_length=1000)


class AvailabilityOut(BaseModel):
    candidate_name: str
    interview_type: InterviewType
    scheduled_at: datetime
    duration_minutes: int
    interviewer_name: str
    availability_status: AvailabilityStatus


class ConsentAcceptRequest(BaseModel):
    recording_and_ai_evaluation: bool
    proctoring_and_identity_snapshot: bool
    data_storage_and_retention: bool


class InterviewAttemptOut(BaseModel):
    candidate_name: str
    interview_type: InterviewType
    status: InterviewStatus
    scheduled_at: datetime
    duration_minutes: int
    questions: List[str] = []
    availability_status: AvailabilityStatus = AvailabilityStatus.PENDING
    consent_accepted: bool = False
    tier: InterviewTier = "standard"
    interviewer_name: Optional[str] = None
    avatar: Optional[AvatarParams] = None
    face_scan_done: bool = False
    # Look-away warnings allowed before the interview ends, from the role's experience level.
    max_warnings: int = 2
    experience_level: str = "unspecified"


class QAPair(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    answer: str = Field(min_length=1, max_length=10000)


class SpeakingMetric(BaseModel):
    duration_seconds: float = Field(default=0, ge=0)
    word_count: int = Field(default=0, ge=0)
    filler_word_count: int = Field(default=0, ge=0)


class InterviewAttemptSubmit(BaseModel):
    answers: List[QAPair] = Field(min_length=1)
    duration_minutes: Optional[int] = Field(default=None, ge=1, le=480)
    mode: str = Field(default="text", pattern="^(text|voice)$")
    speaking_metrics: Optional[List[SpeakingMetric]] = None
    warnings: int = Field(default=0, ge=0, le=50)


class InterviewTerminateRequest(BaseModel):
    reason: str = Field(min_length=1)
    answers: List[QAPair] = []


class InterviewHeartbeatOut(BaseModel):
    status: InterviewStatus
    terminated: bool


class JobCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    department: Optional[str] = None
    location: Optional[str] = None
    employment_type: EmploymentType = EmploymentType.FULL_TIME
    status: JobStatus = JobStatus.DRAFT
    salary_min: Optional[int] = Field(default=None, ge=0)
    salary_max: Optional[int] = Field(default=None, ge=0)
    experience_min_years: Optional[int] = Field(default=None, ge=0, le=50)


class JobUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = Field(default=None, min_length=1)
    department: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[EmploymentType] = None
    status: Optional[JobStatus] = None
    salary_min: Optional[int] = Field(default=None, ge=0)
    salary_max: Optional[int] = Field(default=None, ge=0)
    experience_min_years: Optional[int] = Field(default=None, ge=0, le=50)


class JobOut(BaseModel):
    id: UUID
    title: str
    description: str
    department: Optional[str]
    location: Optional[str]
    employment_type: EmploymentType
    status: JobStatus
    salary_min: Optional[int]
    salary_max: Optional[int]
    experience_min_years: Optional[int] = None
    application_count: int = 0
    created_by_name: Optional[str] = None
    created_by_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CandidateSummaryOut(BaseModel):
    id: UUID
    applicant_name: str
    applicant_email: EmailStr
    phone: Optional[str]
    resume_url: Optional[str]
    source: Optional[str]
    status: CandidateStatus

    class Config:
        from_attributes = True


class JobApplicationCreate(BaseModel):
    candidate_id: UUID


class JobApplicationUpdate(BaseModel):
    status: Optional[JobApplicationStatus] = None
    notes: Optional[str] = None


class JobApplicationOut(BaseModel):
    id: UUID
    job_id: UUID
    job_title: str
    status: JobApplicationStatus
    cover_letter: Optional[str]
    notes: Optional[str]
    resume_filename: Optional[str] = None
    resume_data: Optional[dict] = None
    portfolio_url: Optional[str] = None
    portfolio_data: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    candidate: CandidateSummaryOut

    class Config:
        from_attributes = True


class JobBoardOut(BaseModel):
    id: UUID
    title: str
    description: str
    department: Optional[str]
    location: Optional[str]
    employment_type: EmploymentType
    salary_min: Optional[int]
    salary_max: Optional[int]
    experience_min_years: Optional[int] = None
    created_at: datetime
    already_applied: bool
    my_application_status: Optional[JobApplicationStatus] = None

    class Config:
        from_attributes = True


class JobApplyRequest(BaseModel):
    resume_url: Optional[str] = None
    phone: Optional[str] = None
    cover_letter: Optional[str] = None


class JobSummaryOut(BaseModel):
    id: UUID
    title: str
    department: Optional[str]
    location: Optional[str]
    employment_type: EmploymentType
    status: JobStatus
    salary_min: Optional[int]
    salary_max: Optional[int]
    experience_min_years: Optional[int] = None

    class Config:
        from_attributes = True


class MyApplicationOut(BaseModel):
    id: UUID
    status: JobApplicationStatus
    cover_letter: Optional[str]
    resume_filename: Optional[str] = None
    portfolio_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    job: JobSummaryOut

    class Config:
        from_attributes = True


class NotificationOut(BaseModel):
    id: UUID
    type: str
    title: str
    body: str
    link: Optional[str] = None
    interview_id: Optional[UUID] = None
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListOut(BaseModel):
    unread_count: int
    items: List[NotificationOut]
