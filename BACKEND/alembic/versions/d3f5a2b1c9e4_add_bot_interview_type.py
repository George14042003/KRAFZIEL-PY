"""add bot interview type

Revision ID: d3f5a2b1c9e4
Revises: 39ee2d6451da
Create Date: 2026-09-22 16:55:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd3f5a2b1c9e4'
down_revision = '39ee2d6451da'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE interview_type ADD VALUE IF NOT EXISTS 'BOT'")


def downgrade() -> None:
    # Postgres does not support removing enum values; skipped intentionally.
    pass
