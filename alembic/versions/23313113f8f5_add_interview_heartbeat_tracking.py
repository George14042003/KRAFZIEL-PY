"""add interview heartbeat tracking

Revision ID: 23313113f8f5
Revises: 9f2b4d6e1a3c
Create Date: 2026-09-27 14:36:28.652398

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '23313113f8f5'
down_revision = '9f2b4d6e1a3c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interviews", sa.Column("last_heartbeat_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("interviews", "last_heartbeat_at")
