"""add organizations and multi-tenancy scoping

Revision ID: 9f2b4d6e1a3c
Revises: 3e5c8a1d7f2b
Create Date: 2026-09-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '9f2b4d6e1a3c'
down_revision = '3e5c8a1d7f2b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # New role + organization enums
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN'")

    org_status_enum = postgresql.ENUM('ACTIVE', 'SUSPENDED', name='organization_status')
    org_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'organizations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column(
            'status',
            postgresql.ENUM('ACTIVE', 'SUSPENDED', name='organization_status', create_type=False),
            nullable=False,
            server_default='ACTIVE',
        ),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    # A default organization to backfill every pre-existing row into, so
    # nothing that already exists becomes orphaned/invisible once the
    # organization_id columns below become NOT NULL.
    op.execute(
        """
        INSERT INTO organizations (id, name, status, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'ACTIVE', now(), now())
        """
    )

    op.add_column('users', sa.Column('organization_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_users_organization_id', 'users', 'organizations', ['organization_id'], ['id'], ondelete='CASCADE'
    )
    op.execute(
        """
        UPDATE users SET organization_id = '00000000-0000-0000-0000-000000000001'
        WHERE role = 'EMPLOYEE'
        """
    )

    op.add_column('candidates', sa.Column('organization_id', sa.UUID(), nullable=True))
    op.execute("UPDATE candidates SET organization_id = '00000000-0000-0000-0000-000000000001'")
    op.alter_column('candidates', 'organization_id', nullable=False)
    op.create_foreign_key(
        'fk_candidates_organization_id', 'candidates', 'organizations', ['organization_id'], ['id'], ondelete='CASCADE'
    )

    op.add_column('jobs', sa.Column('organization_id', sa.UUID(), nullable=True))
    op.execute("UPDATE jobs SET organization_id = '00000000-0000-0000-0000-000000000001'")
    op.alter_column('jobs', 'organization_id', nullable=False)
    op.create_foreign_key(
        'fk_jobs_organization_id', 'jobs', 'organizations', ['organization_id'], ['id'], ondelete='CASCADE'
    )


def downgrade() -> None:
    op.drop_constraint('fk_jobs_organization_id', 'jobs', type_='foreignkey')
    op.drop_column('jobs', 'organization_id')

    op.drop_constraint('fk_candidates_organization_id', 'candidates', type_='foreignkey')
    op.drop_column('candidates', 'organization_id')

    op.drop_constraint('fk_users_organization_id', 'users', type_='foreignkey')
    op.drop_column('users', 'organization_id')

    op.drop_table('organizations')
    op.execute("DROP TYPE IF EXISTS organization_status")
    # Note: Postgres does not support removing a value from an enum type;
    # 'SUPER_ADMIN' intentionally stays in user_role on downgrade.
