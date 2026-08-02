"""Add profile interchange, target sets, durable agent controls and contact planning."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

from careertwin.models import JsonType

revision = "20260802_0002"
down_revision = "20260801_0001"
branch_labels = None
depends_on = None


NEW_TENANT_TABLES = ("opportunity_snapshots", "target_sets", "contacts")


def _enable_rls(table: str) -> None:
    """Apply the canonical deny-by-default workspace policy to a new PostgreSQL table."""
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
    op.execute(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY')
    op.execute(
        f'CREATE POLICY tenant_isolation ON "{table}" '
        "USING (workspace_id = current_setting('app.workspace_id', true)) "
        "WITH CHECK (workspace_id = current_setting('app.workspace_id', true) "
        "OR current_setting('app.is_admin', true) = 'true')"
    )


def upgrade() -> None:
    """Create the completion-contract tables and additive columns."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("opportunity_snapshots"):
        op.create_table(
            "opportunity_snapshots",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("workspace_id", sa.String(length=36), nullable=False),
            sa.Column("opportunity_id", sa.String(length=36), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("snapshot", JsonType, nullable=False),
            sa.Column("source_sha256", sa.String(length=64), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["opportunity_id"], ["opportunities.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("opportunity_id", "version"),
        )
        op.create_index(
            "ix_opportunity_snapshots_workspace_id", "opportunity_snapshots", ["workspace_id"]
        )
        op.create_index(
            "ix_opportunity_snapshots_opportunity_id", "opportunity_snapshots", ["opportunity_id"]
        )

    if not inspector.has_table("target_sets"):
        op.create_table(
            "target_sets",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("workspace_id", sa.String(length=36), nullable=False),
            sa.Column("name", sa.String(length=200), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("opportunity_ids", JsonType, nullable=False),
            sa.Column("strategy", JsonType, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("workspace_id", "name"),
        )
        op.create_index("ix_target_sets_workspace_id", "target_sets", ["workspace_id"])

    if not inspector.has_table("contacts"):
        op.create_table(
            "contacts",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("workspace_id", sa.String(length=36), nullable=False),
            sa.Column("application_id", sa.String(length=36), nullable=True),
            sa.Column("name", sa.String(length=200), nullable=False),
            sa.Column("email", sa.String(length=320), nullable=False, server_default=""),
            sa.Column("organization", sa.String(length=240), nullable=False, server_default=""),
            sa.Column("role", sa.String(length=160), nullable=False, server_default=""),
            sa.Column("notes", sa.Text(), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_contacts_workspace_id", "contacts", ["workspace_id"])
        op.create_index("ix_contacts_application_id", "contacts", ["application_id"])
        op.create_index("ix_contacts_workspace_name", "contacts", ["workspace_id", "name"])

    def columns(table: str) -> set[str]:
        return {str(column["name"]) for column in sa.inspect(bind).get_columns(table)}

    if "contact_id" not in columns("career_tasks"):
        with op.batch_alter_table("career_tasks") as batch:
            batch.add_column(sa.Column("contact_id", sa.String(length=36), nullable=True))
            batch.create_foreign_key(
                "fk_career_tasks_contact_id_contacts",
                "contacts",
                ["contact_id"],
                ["id"],
                ondelete="SET NULL",
            )
            batch.create_index("ix_career_tasks_contact_id", ["contact_id"])

    if "prerequisites" not in columns("recommendations"):
        with op.batch_alter_table("recommendations") as batch:
            batch.add_column(
                sa.Column("prerequisites", JsonType, nullable=False, server_default="[]")
            )
            batch.add_column(sa.Column("steps", JsonType, nullable=False, server_default="[]"))
            batch.add_column(sa.Column("progress", sa.Float(), nullable=False, server_default="0"))

    if "parent_run_id" not in columns("agent_runs"):
        with op.batch_alter_table("agent_runs") as batch:
            batch.add_column(sa.Column("parent_run_id", sa.String(length=36), nullable=True))
            batch.add_column(sa.Column("attempt", sa.Integer(), nullable=False, server_default="1"))
            batch.add_column(
                sa.Column("cancel_requested_at", sa.DateTime(timezone=True), nullable=True)
            )
            batch.create_foreign_key(
                "fk_agent_runs_parent_run_id_agent_runs",
                "agent_runs",
                ["parent_run_id"],
                ["id"],
                ondelete="SET NULL",
            )
            batch.create_index("ix_agent_runs_parent_run_id", ["parent_run_id"])

    for table in NEW_TENANT_TABLES:
        _enable_rls(table)


def downgrade() -> None:
    """Remove completion-contract data after an operator-approved destructive rollback."""
    with op.batch_alter_table("agent_runs") as batch:
        batch.drop_index("ix_agent_runs_parent_run_id")
        batch.drop_constraint("fk_agent_runs_parent_run_id_agent_runs", type_="foreignkey")
        batch.drop_column("cancel_requested_at")
        batch.drop_column("attempt")
        batch.drop_column("parent_run_id")
    with op.batch_alter_table("recommendations") as batch:
        batch.drop_column("progress")
        batch.drop_column("steps")
        batch.drop_column("prerequisites")
    with op.batch_alter_table("career_tasks") as batch:
        batch.drop_index("ix_career_tasks_contact_id")
        batch.drop_constraint("fk_career_tasks_contact_id_contacts", type_="foreignkey")
        batch.drop_column("contact_id")
    op.drop_index("ix_contacts_application_id", table_name="contacts")
    op.drop_index("ix_contacts_workspace_name", table_name="contacts")
    op.drop_index("ix_contacts_workspace_id", table_name="contacts")
    op.drop_table("contacts")
    op.drop_index("ix_target_sets_workspace_id", table_name="target_sets")
    op.drop_table("target_sets")
    op.drop_index("ix_opportunity_snapshots_opportunity_id", table_name="opportunity_snapshots")
    op.drop_index("ix_opportunity_snapshots_workspace_id", table_name="opportunity_snapshots")
    op.drop_table("opportunity_snapshots")
