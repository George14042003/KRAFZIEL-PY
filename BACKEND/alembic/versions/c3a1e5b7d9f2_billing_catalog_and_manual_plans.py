"""add billing_catalog table (super-admin editable price template)

Revision ID: c3a1e5b7d9f2
Revises: b9f3d5a7c2e4
Create Date: 2026-11-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'c3a1e5b7d9f2'
down_revision = 'b9f3d5a7c2e4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "billing_catalog",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("billing_catalog")
