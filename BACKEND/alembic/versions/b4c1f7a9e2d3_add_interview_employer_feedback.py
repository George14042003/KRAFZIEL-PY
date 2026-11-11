"""add interview employer feedback fields

Revision ID: b4c1f7a9e2d3
Revises: 2722b9d593e1
Create Date: 2026-09-30 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b4c1f7a9e2d3'
down_revision = '2722b9d593e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("interviews", sa.Column("employer_feedback", sa.Text(), nullable=True))
    op.add_column("interviews", sa.Column("employer_rating", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("interviews", "employer_rating")
    op.drop_column("interviews", "employer_feedback")
