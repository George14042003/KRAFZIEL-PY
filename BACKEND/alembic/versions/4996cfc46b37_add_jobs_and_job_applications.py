"""add jobs and job applications

Revision ID: 4996cfc46b37
Revises: d3f5a2b1c9e4
Create Date: 2026-09-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '4996cfc46b37'
down_revision = 'd3f5a2b1c9e4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    employment_type_enum = postgresql.ENUM(
        'FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', name='employment_type'
    )
    employment_type_enum.create(op.get_bind(), checkfirst=True)
    job_status_enum = postgresql.ENUM('DRAFT', 'OPEN', 'CLOSED', 'FILLED', name='job_status')
    job_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'jobs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('department', sa.String(), nullable=True),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column(
            'employment_type',
            postgresql.ENUM(
                'FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP',
                name='employment_type', create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            'status',
            postgresql.ENUM('DRAFT', 'OPEN', 'CLOSED', 'FILLED', name='job_status', create_type=False),
            nullable=False,
        ),
        sa.Column('salary_min', sa.Integer(), nullable=True),
        sa.Column('salary_max', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    job_application_status_enum = postgresql.ENUM(
        'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEWING',
        'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN', name='job_application_status',
    )
    job_application_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'job_applications',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('job_id', sa.UUID(), nullable=False),
        sa.Column('candidate_id', sa.UUID(), nullable=False),
        sa.Column(
            'status',
            postgresql.ENUM(
                'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEWING',
                'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN',
                name='job_application_status', create_type=False,
            ),
            nullable=False,
        ),
        sa.Column('cover_letter', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_id', 'candidate_id', name='uq_job_applications_job_candidate'),
    )


def downgrade() -> None:
    op.drop_table('job_applications')
    postgresql.ENUM(name='job_application_status').drop(op.get_bind(), checkfirst=True)
    op.drop_table('jobs')
    postgresql.ENUM(name='job_status').drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name='employment_type').drop(op.get_bind(), checkfirst=True)
