"""add interview integrity fields

Revision ID: 2722b9d593e1
Revises: ae3c8c1ca741
Create Date: 2026-09-29 09:59:24.625251

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2722b9d593e1'
down_revision = 'ae3c8c1ca741'
branch_labels = None
depends_on = None


availability_status_enum = sa.Enum(
    "PENDING", "ACCEPTED", "DECLINED", name="availability_status"
)


def upgrade() -> None:
    availability_status_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "interviews",
        sa.Column(
            "availability_status",
            availability_status_enum,
            nullable=False,
            server_default="PENDING",
        ),
    )
    op.add_column(
        "interviews", sa.Column("consent_accepted", sa.Boolean(), nullable=False, server_default="false")
    )
    op.add_column("interviews", sa.Column("consent_given_at", sa.DateTime(), nullable=True))
    op.add_column("interviews", sa.Column("identity_snapshot_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("interviews", "identity_snapshot_url")
    op.drop_column("interviews", "consent_given_at")
    op.drop_column("interviews", "consent_accepted")
    op.drop_column("interviews", "availability_status")
    availability_status_enum.drop(op.get_bind(), checkfirst=True)
