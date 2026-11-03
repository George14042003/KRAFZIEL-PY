"""job experience requirement + application-level parsed resume and portfolio

Revision ID: d4b2f6a8c0e1
Revises: c3a1e5b7d9f2
Create Date: 2026-11-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'd4b2f6a8c0e1'
down_revision = 'c3a1e5b7d9f2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("experience_min_years", sa.Integer(), nullable=True))
    op.add_column("job_applications", sa.Column("resume_filename", sa.String(), nullable=True))
    op.add_column("job_applications", sa.Column("resume_data", postgresql.JSONB(), nullable=True))
    op.add_column("job_applications", sa.Column("resume_text", sa.Text(), nullable=True))
    op.add_column("job_applications", sa.Column("portfolio_url", sa.String(), nullable=True))
    op.add_column("job_applications", sa.Column("portfolio_data", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("job_applications", "portfolio_data")
    op.drop_column("job_applications", "portfolio_url")
    op.drop_column("job_applications", "resume_text")
    op.drop_column("job_applications", "resume_data")
    op.drop_column("job_applications", "resume_filename")
    op.drop_column("jobs", "experience_min_years")
