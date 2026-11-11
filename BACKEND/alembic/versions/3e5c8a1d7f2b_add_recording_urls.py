"""add recording_urls to interviews

Revision ID: 3e5c8a1d7f2b
Revises: 7c1a9e2f4b6d
Create Date: 2026-09-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '3e5c8a1d7f2b'
down_revision = '7c1a9e2f4b6d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('interviews', sa.Column('recording_urls', postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('interviews', 'recording_urls')
