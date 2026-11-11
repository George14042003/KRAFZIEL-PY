"""add god tier: avatar_profiles table and interview tier/avatar/face scan columns

Revision ID: f1b8d4a6c2e9
Revises: e7a3c9d1b5f2
Create Date: 2026-10-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'f1b8d4a6c2e9'
down_revision = 'e7a3c9d1b5f2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "avatar_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("params", postgresql.JSONB(), nullable=False),
        sa.Column("consent_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.add_column(
        "interviews",
        sa.Column("tier", sa.String(), nullable=False, server_default="standard"),
    )
    op.add_column(
        "interviews",
        sa.Column(
            "avatar_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("interviews", sa.Column("face_scan_urls", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("interviews", "face_scan_urls")
    op.drop_column("interviews", "avatar_user_id")
    op.drop_column("interviews", "tier")
    op.drop_table("avatar_profiles")
