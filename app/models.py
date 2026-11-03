import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import object_session, relationship

from app.database import Base


class CandidateStatus(str, enum.Enum):
    PENDING = "pending"
    REVIEWED = "reviewed"
    INTERVIEWING = "interviewing"
    OFFERED = "offered"
    HIRED = "hired"
    REJECTED = "rejected"


class UserRole(str, enum.Enum):
    CANDIDATE = "candidate"
    EMPLOYER = "employer"
    SUPER_ADMIN = "super_admin"


class OrganizationStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class OfferStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    WITHDRAWN = "withdrawn"


class InterviewType(str, enum.Enum):
    PHONE = "phone"
    VIDEO = "video"
    ONSITE = "onsite"
    TECHNICAL = "technical"
    FINAL = "final"
    BOT = "bot"


class InterviewStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"
    NO_SHOW = "no_show"


class AvailabilityStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class EmploymentType(str, enum.Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERNSHIP = "internship"


class JobStatus(str, enum.Enum):
    DRAFT = "draft"
    OPEN = "open"
    CLOSED = "closed"
    FILLED = "filled"


class JobApplicationStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    SHORTLISTED = "shortlisted"
    INTERVIEWING = "interviewing"
    OFFERED = "offered"
    HIRED = "hired"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    status = Column(
        Enum(OrganizationStatus, name="organization_status"),
        default=OrganizationStatus.ACTIVE,
        nullable=False,
    )
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    creator = relationship("User", foreign_keys=[created_by])


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRole, name="user_role"), nullable=False)
    is_verified = Column(Boolean, nullable=False, default=False, server_default=text("true"))
    # Only meaningful for EMPLOYER users — each employer belongs to exactly one
    # organization. CANDIDATE users are intentionally NOT scoped to a single
    # organization here: the same person can apply to jobs at many different
    # companies, and each company gets its own separate Candidate pool record
    # for them (see Candidate.organization_id) — organization_id on the login
    # identity itself would break that. SUPER_ADMIN users also leave this null.
    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    organization = relationship("Organization", foreign_keys=[organization_id])


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # A candidate pool record belongs to exactly one organization. The same
    # person (same email) applying to multiple companies gets a SEPARATE
    # Candidate row per organization — mirrors how a real applicant tracking
    # system keeps each company's view of a candidate independent.
    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    applicant_name = Column(String, nullable=False)
    applicant_email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    source = Column(String, nullable=True)
    resume_url = Column(String, nullable=True)
    status = Column(
        Enum(CandidateStatus, name="application_status"),
        default=CandidateStatus.PENDING,
        nullable=False,
    )
    notes = Column(Text, nullable=True)
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    offers = relationship("Offer", back_populates="candidate", cascade="all, delete-orphan")
    interviews = relationship(
        "Interview", back_populates="candidate", cascade="all, delete-orphan"
    )
    job_applications = relationship(
        "JobApplication", back_populates="candidate", cascade="all, delete-orphan"
    )
    organization = relationship("Organization", foreign_keys=[organization_id])
    creator = relationship("User", foreign_keys=[created_by])

    @property
    def has_account(self) -> bool:
        """Whether this person has a verified candidate login. Interview links need one,
        matched on this email, so employers see it before scheduling."""
        preset = self.__dict__.get("_has_account_preset")
        if preset is not None:
            return preset
        session = object_session(self)
        if session is None:
            return False
        return (
            session.query(User.id)
            .filter(
                func.lower(User.email) == self.applicant_email.strip().lower(),
                User.role == UserRole.CANDIDATE,
                User.is_verified.is_(True),
            )
            .first()
            is not None
        )


class Offer(Base):
    __tablename__ = "offers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False
    )
    salary = Column(Integer, nullable=False)
    currency = Column(String, default="USD", nullable=False)
    start_date = Column(Date, nullable=True)
    expires_at = Column(Date, nullable=True)
    status = Column(
        Enum(OfferStatus, name="offer_status"), default=OfferStatus.PENDING, nullable=False
    )
    notes = Column(Text, nullable=True)
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    candidate = relationship("Candidate", back_populates="offers")


class Interview(Base):
    __tablename__ = "interviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False
    )
    scheduled_at = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=30, nullable=False)
    interview_type = Column(
        Enum(InterviewType, name="interview_type"), default=InterviewType.PHONE, nullable=False
    )
    status = Column(
        Enum(InterviewStatus, name="interview_status"),
        default=InterviewStatus.SCHEDULED,
        nullable=False,
    )
    interviewer_name = Column(String, nullable=False)
    interviewer_email = Column(String, nullable=True)
    location_or_link = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    questions = Column(JSONB, nullable=True)
    ai_evaluation = Column(JSONB, nullable=True)
    recording_urls = Column(JSONB, nullable=True)
    # Server-side proctoring for bot interviews: the client pings a heartbeat
    # endpoint every few seconds while the attempt is in progress. A gap larger
    # than the allowed tolerance (checked both on the next heartbeat and at
    # submission time) means the client stopped reporting in — e.g. because
    # someone tampered with the client-side violation detection while leaving
    # everything else running — and the attempt is cancelled server-side
    # regardless of what the client claims.
    last_heartbeat_at = Column(DateTime, nullable=True)
    # The candidate must explicitly accept (or decline) the proposed slot via
    # the emailed confirmation link before the interview becomes joinable —
    # closes the gap where an interview gets scheduled but the candidate was
    # never actually confirmed as available for it.
    availability_status = Column(
        Enum(AvailabilityStatus, name="availability_status"),
        default=AvailabilityStatus.PENDING,
        nullable=False,
    )
    # When the candidate clicked accept/decline in the emailed link. Drives the
    # employer's in-app "candidate responded" notification.
    availability_responded_at = Column(DateTime, nullable=True)
    # Legal/consent gate: the candidate must accept the recording/AI-evaluation/
    # proctoring/data-retention consent form before joining (bot or live video).
    consent_accepted = Column(Boolean, default=False, nullable=False)
    consent_given_at = Column(DateTime, nullable=True)
    # A single webcam snapshot captured at the moment the candidate joins,
    # kept as an audit record of who actually showed up — not automated face
    # matching, just evidence the employer can review afterward.
    identity_snapshot_url = Column(String, nullable=True)
    # Employer-only post-call feedback — kept distinct from `notes`, which the
    # bot-interview flow overwrites with the Q&A transcript on submission.
    employer_feedback = Column(Text, nullable=True)
    employer_rating = Column(Integer, nullable=True)
    # "standard" or "god". A "god" interview is conducted by the digital twin
    # (AvatarProfile) of the employer in `avatar_user_id`, and requires the
    # candidate to complete a 5-angle face scan first (stored as audit evidence
    # in `face_scan_urls`: a list of {angle, url}).
    tier = Column(String, nullable=False, default="standard", server_default="standard")
    avatar_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    face_scan_urls = Column(JSONB, nullable=True)
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    candidate = relationship("Candidate", back_populates="interviews")

    @property
    def face_scan_done(self) -> bool:
        return bool(self.face_scan_urls)

    @property
    def candidate_name(self) -> str | None:
        return self.candidate.applicant_name if self.candidate else None

    @property
    def candidate_has_account(self) -> bool:
        return self.candidate.has_account if self.candidate else False


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    department = Column(String, nullable=True)
    location = Column(String, nullable=True)
    employment_type = Column(
        Enum(EmploymentType, name="employment_type"),
        default=EmploymentType.FULL_TIME,
        nullable=False,
    )
    status = Column(Enum(JobStatus, name="job_status"), default=JobStatus.DRAFT, nullable=False)
    salary_min = Column(Integer, nullable=True)
    salary_max = Column(Integer, nullable=True)
    # Minimum years of experience the role asks for; also sets how many look-away warnings the bot interview allows.
    experience_min_years = Column(Integer, nullable=True)
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    applications = relationship(
        "JobApplication", back_populates="job", cascade="all, delete-orphan"
    )
    creator = relationship("User", foreign_keys=[created_by])
    organization = relationship("Organization", foreign_keys=[organization_id])


class JobApplication(Base):
    __tablename__ = "job_applications"
    __table_args__ = (
        UniqueConstraint("job_id", "candidate_id", name="uq_job_applications_job_candidate"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    candidate_id = Column(
        UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False
    )
    status = Column(
        Enum(JobApplicationStatus, name="job_application_status"),
        default=JobApplicationStatus.SUBMITTED,
        nullable=False,
    )
    cover_letter = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    # Application-level resume: the uploaded .doc/.docx is read once and kept as structured data (the file itself is not kept).
    resume_filename = Column(String, nullable=True)
    resume_data = Column(JSONB, nullable=True)
    resume_text = Column(Text, nullable=True)
    portfolio_url = Column(String, nullable=True)
    portfolio_data = Column(JSONB, nullable=True)
    created_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    job = relationship("Job", back_populates="applications")
    candidate = relationship("Candidate", back_populates="job_applications")
    creator = relationship("User", foreign_keys=[created_by])


class AvatarProfile(Base):
    """An employer's stylized 3D "digital twin" for God level interviews. Holds
    only derived appearance parameters (colours, proportions), never photos."""

    __tablename__ = "avatar_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    params = Column(JSONB, nullable=False)
    consent_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class Notification(Base):
    """In-app notification for one employer user. Created per recipient (not per
    organization) so each team member keeps their own read/unread state."""

    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    interview_id = Column(
        UUID(as_uuid=True), ForeignKey("interviews.id", ondelete="CASCADE"), nullable=True
    )
    # e.g. "interview_accepted", "interview_declined", "interview_completed"
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    # Frontend path to open when the notification is clicked.
    link = Column(String, nullable=True)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    TRIALING = "trialing"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    INCOMPLETE = "incomplete"


class Subscription(Base):
    """One billing subscription per organization. The free Starter plan has no row."""

    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    plan_key = Column(String, nullable=False)  # starter | growth | enterprise
    interview_mode = Column(String, nullable=False, default="both", server_default="both")  # bot | video | both
    billing_interval = Column(String, nullable=False, default="month")  # month | year
    status = Column(
        Enum(SubscriptionStatus, name="subscription_status"),
        default=SubscriptionStatus.INCOMPLETE,
        nullable=False,
    )
    stripe_customer_id = Column(String, nullable=True, index=True)
    stripe_subscription_id = Column(String, nullable=True, unique=True)
    current_period_end = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", foreign_keys=[organization_id])


class Payment(Base):
    """One row per invoice charged by the gateway (paid or failed)."""

    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subscription_id = Column(
        UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True
    )
    stripe_invoice_id = Column(String, nullable=False, unique=True)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String, nullable=False, default="inr")
    status = Column(String, nullable=False)  # paid | failed
    description = Column(String, nullable=True)
    invoice_url = Column(String, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class PaymentWebhookEvent(Base):
    """Gateway events already handled, so a redelivered webhook is a no-op."""

    __tablename__ = "payment_webhook_events"

    id = Column(String, primary_key=True)  # Stripe event id
    type = Column(String, nullable=False)
    received_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class BillingCatalog(Base):
    """Super-admin override of the subscription price template (single row, id = 1)."""

    __tablename__ = "billing_catalog"

    id = Column(Integer, primary_key=True)
    data = Column(JSONB, nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
