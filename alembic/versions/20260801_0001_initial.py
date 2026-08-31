"""Create the complete CareerTwin relational schema and tenant RLS policies."""

from __future__ import annotations

from alembic import op

from careertwin import models  # noqa: F401
from careertwin.database import Base

revision = "20260801_0001"
down_revision = None
branch_labels = None
depends_on = None

TENANT_TABLES = (
    "professional_profiles",
    "sources",
    "evidence_claims",
    "profile_embeddings",
    "skills",
    "experiences",
    "education",
    "opportunities",
    "requirements",
    "match_runs",
    "recommendations",
    "career_artifacts",
    "applications",
    "stage_events",
    "career_tasks",
    "conversations",
    "agent_messages",
    "proposed_changes",
    "agent_runs",
)


def upgrade() -> None:
    """Create tables, pgvector support and deny-by-default workspace policies."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    Base.metadata.create_all(bind=bind)
    if bind.dialect.name == "postgresql":
        for table in TENANT_TABLES:
            op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')
            op.execute(f'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY')
            op.execute(
                f'CREATE POLICY tenant_isolation ON "{table}" '
                "USING (workspace_id = current_setting('app.workspace_id', true)) "
                "WITH CHECK (workspace_id = current_setting('app.workspace_id', true) "
                "OR current_setting('app.is_admin', true) = 'true')"
            )


def downgrade() -> None:
    """Drop the application schema; operators must back up before invoking this."""
    Base.metadata.drop_all(bind=op.get_bind())
