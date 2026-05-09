"""initial product schema

Revision ID: 20260510_0001
Revises:
Create Date: 2026-05-10 00:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "20260510_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("external_ref", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "workspaces",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
    )

    op.create_table(
        "workspace_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("workspace_id", "user_id"),
    )

    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_projects_workspace_id", "projects", ["workspace_id"])

    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("assignee_id", sa.Integer(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_tasks_project_id", "tasks", ["project_id"])
    op.create_index("ix_tasks_workspace_id", "tasks", ["workspace_id"])

    op.create_table(
        "task_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "task_activity_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "attachments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("owner_type", sa.String(length=40), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("checksum", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_attachments_owner", "attachments", ["owner_type", "owner_id"])


def downgrade() -> None:
    op.drop_table("attachments")
    op.drop_table("task_activity_events")
    op.drop_table("task_comments")
    op.drop_table("tasks")
    op.drop_table("projects")
    op.drop_table("workspace_members")
    op.drop_table("workspaces")
    op.drop_table("users")
