"""Add full-product taxonomy, career artifact, connector, email and trace contracts."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

from careertwin.models import JsonType

revision = "20260802_0003"
down_revision = "20260802_0002"
branch_labels = None
depends_on = None

TENANT_TABLES = (
    "accomplishments",
    "resume_variants",
    "external_connections",
    "oauth_authorizations",
    "email_threads",
    "agent_traces",
)


def _enable_rls(table: str) -> None:
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


def _enable_browser_credential_rls() -> None:
    """Permit a tightly scoped internal lookup before the extension workspace is known."""
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute('ALTER TABLE "browser_capture_credentials" ENABLE ROW LEVEL SECURITY')
    op.execute('ALTER TABLE "browser_capture_credentials" FORCE ROW LEVEL SECURITY')
    op.execute(
        'CREATE POLICY tenant_isolation ON "browser_capture_credentials" '
        "USING (workspace_id = current_setting('app.workspace_id', true) "
        "OR current_setting('app.is_admin', true) = 'true') "
        "WITH CHECK (workspace_id = current_setting('app.workspace_id', true) "
        "OR current_setting('app.is_admin', true) = 'true')"
    )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    full_product_tables = {
        "taxonomy_imports",
        "taxonomy_embeddings",
        "taxonomy_relations",
        *TENANT_TABLES,
        "browser_capture_credentials",
    }
    # The historical base migration intentionally uses current SQLAlchemy metadata. On a clean
    # install it therefore creates newly introduced tables before additive migrations run, while
    # an existing alpha.4 deployment still needs every DDL statement below. Support both paths.
    if all(inspector.has_table(table) for table in full_product_tables):
        if bind.dialect.name == "postgresql":
            op.execute(
                "CREATE INDEX IF NOT EXISTS ix_taxonomy_embeddings_hnsw "
                "ON taxonomy_embeddings USING hnsw (embedding vector_cosine_ops)"
            )
        for table in TENANT_TABLES:
            _enable_rls(table)
        _enable_browser_credential_rls()
        return
    op.create_table(
        "taxonomy_imports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("taxonomy", sa.String(30), nullable=False),
        sa.Column("release", sa.String(40), nullable=False),
        sa.Column("language", sa.String(8), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("archive_sha256", sa.String(64), nullable=False),
        sa.Column("concept_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("relation_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("taxonomy", "release", "language", "archive_sha256"),
    )
    op.create_index(
        "ix_taxonomy_import_release",
        "taxonomy_imports",
        ["taxonomy", "release", "language"],
    )
    op.create_table(
        "taxonomy_embeddings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("concept_id", sa.String(36), nullable=False),
        sa.Column("taxonomy", sa.String(30), nullable=False),
        sa.Column("release", sa.String(40), nullable=False),
        sa.Column("language", sa.String(8), nullable=False),
        sa.Column("model", sa.String(160), nullable=False),
        sa.Column("model_revision", sa.String(160), nullable=False),
        sa.Column("embedding", Vector(768).with_variant(sa.JSON(), "sqlite"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["concept_id"], ["taxonomy_concepts.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("concept_id", "model", "model_revision"),
    )
    op.create_index("ix_taxonomy_embeddings_concept_id", "taxonomy_embeddings", ["concept_id"])
    op.create_index(
        "ix_taxonomy_embedding_scope",
        "taxonomy_embeddings",
        ["taxonomy", "release", "language"],
    )
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            "CREATE INDEX ix_taxonomy_embeddings_hnsw ON taxonomy_embeddings "
            "USING hnsw (embedding vector_cosine_ops)"
        )
    op.create_table(
        "taxonomy_relations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("taxonomy", sa.String(30), nullable=False),
        sa.Column("release", sa.String(40), nullable=False),
        sa.Column("source_uri", sa.Text(), nullable=False),
        sa.Column("target_uri", sa.Text(), nullable=False),
        sa.Column("relation", sa.String(80), nullable=False),
        sa.Column("provenance", JsonType, nullable=False),
        sa.UniqueConstraint("taxonomy", "release", "source_uri", "target_uri", "relation"),
    )
    op.create_index(
        "ix_taxonomy_relation_source",
        "taxonomy_relations",
        ["taxonomy", "release", "source_uri"],
    )
    op.create_index(
        "ix_taxonomy_relation_target",
        "taxonomy_relations",
        ["taxonomy", "release", "target_uri"],
    )

    op.create_table(
        "accomplishments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("situation", sa.Text(), nullable=False, server_default=""),
        sa.Column("task", sa.Text(), nullable=False, server_default=""),
        sa.Column("action", sa.Text(), nullable=False, server_default=""),
        sa.Column("result", sa.Text(), nullable=False, server_default=""),
        sa.Column("evidence_ids", JsonType, nullable=False),
        sa.Column("skills", JsonType, nullable=False),
        sa.Column("metrics", JsonType, nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_accomplishments_workspace_id", "accomplishments", ["workspace_id"])

    op.create_table(
        "resume_variants",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("opportunity_id", sa.String(36), nullable=True),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("section_order", JsonType, nullable=False),
        sa.Column("evidence_ids", JsonType, nullable=False),
        sa.Column("accomplishment_ids", JsonType, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["opportunity_id"], ["opportunities.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("workspace_id", "name", "version"),
    )
    op.create_index("ix_resume_variants_workspace_id", "resume_variants", ["workspace_id"])
    op.create_index("ix_resume_variants_opportunity_id", "resume_variants", ["opportunity_id"])

    op.create_table(
        "external_connections",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("account_subject", sa.String(320), nullable=False, server_default="default"),
        sa.Column("status", sa.String(30), nullable=False, server_default="connected"),
        sa.Column("scopes", JsonType, nullable=False),
        sa.Column("encrypted_credentials", sa.Text(), nullable=False),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("selected_resource", sa.String(500), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("connection_metadata", JsonType, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("workspace_id", "provider", "account_subject"),
    )
    op.create_index("ix_external_connections_workspace_id", "external_connections", ["workspace_id"])
    op.create_index("ix_external_connections_provider", "external_connections", ["provider"])

    op.create_table(
        "oauth_authorizations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("state_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("encrypted_verifier", sa.Text(), nullable=False),
        sa.Column("redirect_after", sa.String(500), nullable=False, server_default="/pipeline"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_oauth_authorizations_workspace_id", "oauth_authorizations", ["workspace_id"])
    op.create_index("ix_oauth_authorizations_state_hash", "oauth_authorizations", ["state_hash"], unique=True)
    op.create_index("ix_oauth_authorizations_expires_at", "oauth_authorizations", ["expires_at"])

    op.create_table(
        "email_threads",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("opportunity_id", sa.String(36), nullable=True),
        sa.Column("application_id", sa.String(36), nullable=True),
        sa.Column("source_digest", sa.String(64), nullable=False),
        sa.Column("external_thread_id", sa.String(500), nullable=False, server_default=""),
        sa.Column("subject", sa.String(500), nullable=False, server_default=""),
        sa.Column("participants", JsonType, nullable=False),
        sa.Column("messages", JsonType, nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("retention_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["opportunity_id"], ["opportunities.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("workspace_id", "source_digest"),
    )
    op.create_index("ix_email_threads_workspace_id", "email_threads", ["workspace_id"])
    op.create_index("ix_email_threads_opportunity_id", "email_threads", ["opportunity_id"])
    op.create_index("ix_email_threads_application_id", "email_threads", ["application_id"])
    op.create_index("ix_email_threads_source_digest", "email_threads", ["source_digest"])
    op.create_index("ix_email_threads_retention_until", "email_threads", ["retention_until"])

    op.create_table(
        "browser_capture_credentials",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("label", sa.String(200), nullable=False, server_default="Browser extension"),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_browser_capture_credentials_workspace_id",
        "browser_capture_credentials",
        ["workspace_id"],
    )
    op.create_index(
        "ix_browser_capture_credentials_token_hash",
        "browser_capture_credentials",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "ix_browser_capture_credentials_expires_at",
        "browser_capture_credentials",
        ["expires_at"],
    )

    op.create_table(
        "agent_traces",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), nullable=False),
        sa.Column("run_id", sa.String(36), nullable=False, unique=True),
        sa.Column("trace_id", sa.String(64), nullable=False, unique=True),
        sa.Column("provider", sa.String(60), nullable=False),
        sa.Column("specialist", sa.String(80), nullable=False, server_default="unknown"),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("input_digest", sa.String(64), nullable=False),
        sa.Column("evidence_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("citation_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("attempt", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("external_exported", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["agent_runs.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_agent_traces_workspace_id", "agent_traces", ["workspace_id"])
    op.create_index("ix_agent_traces_run_id", "agent_traces", ["run_id"], unique=True)

    for table in TENANT_TABLES:
        _enable_rls(table)
    _enable_browser_credential_rls()


def downgrade() -> None:
    op.drop_table("browser_capture_credentials")
    for table in reversed(TENANT_TABLES):
        op.drop_table(table)
    op.drop_index("ix_taxonomy_relation_target", table_name="taxonomy_relations")
    op.drop_index("ix_taxonomy_relation_source", table_name="taxonomy_relations")
    op.drop_table("taxonomy_relations")
    op.drop_index("ix_taxonomy_embedding_scope", table_name="taxonomy_embeddings")
    op.drop_index("ix_taxonomy_embeddings_concept_id", table_name="taxonomy_embeddings")
    op.drop_table("taxonomy_embeddings")
    op.drop_index("ix_taxonomy_import_release", table_name="taxonomy_imports")
    op.drop_table("taxonomy_imports")
