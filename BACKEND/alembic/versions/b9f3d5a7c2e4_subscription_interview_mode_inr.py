"""add interview_mode to subscriptions and default payments to INR

Revision ID: b9f3d5a7c2e4
Revises: a8e2c4f6b1d3
Create Date: 2026-11-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'b9f3d5a7c2e4'
down_revision = 'a8e2c4f6b1d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("subscriptions", sa.Column("interview_mode", sa.String(), nullable=False, server_default="both"))
    op.alter_column("payments", "currency", server_default="inr")


def downgrade() -> None:
    op.alter_column("payments", "currency", server_default="usd")
    op.drop_column("subscriptions", "interview_mode")
