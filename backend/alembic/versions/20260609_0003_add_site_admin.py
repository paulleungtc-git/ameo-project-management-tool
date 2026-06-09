"""add site admin flag

Revision ID: 20260609_0003
Revises: 20260510_0002
Create Date: 2026-06-09
"""

from alembic import op
import sqlalchemy as sa


revision = "20260609_0003"
down_revision = "20260510_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_site_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("users", "is_site_admin", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "is_site_admin")
