"""add ai questions and evaluation to interviews

Revision ID: 7c1a9e2f4b6d
Revises: 4996cfc46b37
Create Date: 2026-09-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '7c1a9e2f4b6d'
down_revision = '4996cfc46b37'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('interviews', sa.Column('questions', postgresql.JSONB(), nullable=True))
    op.add_column('interviews', sa.Column('ai_evaluation', postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('interviews', 'ai_evaluation')
    op.drop_column('interviews', 'questions')
