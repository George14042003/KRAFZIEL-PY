"""rename employee role to employer

Revision ID: ae3c8c1ca741
Revises: 23313113f8f5
Create Date: 2026-09-28 15:01:05.794667

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ae3c8c1ca741'
down_revision = '23313113f8f5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_role RENAME VALUE 'EMPLOYEE' TO 'EMPLOYER'")


def downgrade() -> None:
    op.execute("ALTER TYPE user_role RENAME VALUE 'EMPLOYER' TO 'EMPLOYEE'")
