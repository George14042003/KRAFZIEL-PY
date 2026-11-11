"""add new application status values

Revision ID: 468861fd775b
Revises: ae18ee6e6651
Create Date: 2026-09-22 15:10:37.939953

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '468861fd775b'
down_revision = 'ae18ee6e6651'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'INTERVIEWING'")
        op.execute("ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'OFFERED'")
        op.execute("ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'HIRED'")


def downgrade() -> None:
    # Postgres does not support removing enum values; skipped intentionally.
    pass
