"""replace job postings with standalone candidates and interviews

Revision ID: 39ee2d6451da
Revises: 468861fd775b
Create Date: 2026-09-22 15:23:34.634538

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '39ee2d6451da'
down_revision = '468861fd775b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # applications -> candidates (drop job link, add sourcing fields)
    op.rename_table('applications', 'candidates')
    op.drop_constraint('applications_job_id_fkey', 'candidates', type_='foreignkey')
    op.drop_column('candidates', 'job_id')
    op.add_column('candidates', sa.Column('phone', sa.String(), nullable=True))
    op.add_column('candidates', sa.Column('source', sa.String(), nullable=True))
    op.add_column('candidates', sa.Column('notes', sa.Text(), nullable=True))

    # offers now point directly at candidates
    op.alter_column('offers', 'application_id', new_column_name='candidate_id')

    # jobs are no longer modeled in-app (candidates are sourced externally)
    op.drop_table('jobs')
    postgresql.ENUM(name='job_status').drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name='employment_type').drop(op.get_bind(), checkfirst=True)

    interview_type_enum = postgresql.ENUM(
        'PHONE', 'VIDEO', 'ONSITE', 'TECHNICAL', 'FINAL', name='interview_type', create_type=False
    )
    interview_type_enum.create(op.get_bind(), checkfirst=True)
    interview_status_enum = postgresql.ENUM(
        'SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW',
        name='interview_status', create_type=False,
    )
    interview_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'interviews',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('candidate_id', sa.UUID(), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('interview_type', interview_type_enum, nullable=False),
        sa.Column('status', interview_status_enum, nullable=False),
        sa.Column('interviewer_name', sa.String(), nullable=False),
        sa.Column('interviewer_email', sa.String(), nullable=True),
        sa.Column('location_or_link', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('interviews')
    postgresql.ENUM(name='interview_status').drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name='interview_type').drop(op.get_bind(), checkfirst=True)

    employment_type_enum = postgresql.ENUM(
        'FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', name='employment_type', create_type=False
    )
    employment_type_enum.create(op.get_bind(), checkfirst=True)
    job_status_enum = postgresql.ENUM(
        'DRAFT', 'OPEN', 'CLOSED', 'FILLED', name='job_status', create_type=False
    )
    job_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'jobs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('company', sa.String(), nullable=False),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('department', sa.String(), nullable=True),
        sa.Column('employment_type', employment_type_enum, nullable=False),
        sa.Column('status', job_status_enum, nullable=False),
        sa.Column('salary_min', sa.Integer(), nullable=True),
        sa.Column('salary_max', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.alter_column('offers', 'candidate_id', new_column_name='application_id')

    op.drop_column('candidates', 'notes')
    op.drop_column('candidates', 'source')
    op.drop_column('candidates', 'phone')
    op.add_column('candidates', sa.Column('job_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'applications_job_id_fkey', 'candidates', 'jobs', ['job_id'], ['id'], ondelete='CASCADE'
    )
    op.rename_table('candidates', 'applications')
