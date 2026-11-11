"""add interview availability_responded_at

Revision ID: c5d2a8e3f1b7
Revises: b4c1f7a9e2d3
Create Date: 2026-10-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c5d2a8e3f1b7'
down_revision = 'b4c1f7a9e2d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interviews", sa.Column("availability_responded_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("interviews", "availability_responded_at")
