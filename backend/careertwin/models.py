"""Relational domain model for tenant-scoped career evidence and job-search operations."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from careertwin.database import Base

JsonType = JSON().with_variant(JSONB(), "postgresql")


def new_id() -> str:
    """Return a sortable-enough opaque identifier without exposing database sequence data."""
    return str(uuid.uuid4())


def utcnow() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(UTC)


class ClaimState(StrEnum):
    PROPOSED = "proposed"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    SUPERSEDED = "superseded"


class SourceStatus(StrEnum):
    PENDING = "pending"
    QUARANTINED = "quarantined"
    READY = "ready"
    FAILED = "failed"


class OpportunityStatus(StrEnum):
    WATCHING = "watching"
    ACTIVE = "active"
    EXPIRED = "expired"
    ARCHIVED = "archived"


class ApplicationStage(StrEnum):
    SAVED = "saved"
    PREPARING = "preparing"
    APPLIED = "applied"
    SCREENING = "screening"
    INTERVIEW = "interview"
    OFFER = "offer"
    ACCEPTED = "accepted"
    WITHDRAWN = "withdrawn"
    REJECTED = "rejected"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class User(Base, TimestampMixin):
    """Invite-only account; superusers still receive exactly one normal seeker workspace."""

    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(160))
    password_hash: Mapped[str] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    locale: Mapped[str] = mapped_column(String(8), default="en")
    theme: Mapped[str] = mapped_column(String(16), default="dark")
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    workspace: Mapped[Workspace] = relationship(
        back_populates="owner", cascade="all, delete-orphan", uselist=False
    )
    sessions: Mapped[list[AuthSession]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Workspace(Base, TimestampMixin):
    """Isolation boundary containing one person's professional data and many opportunities."""

    __tablename__ = "workspaces"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    owner_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(160))
    retention_days: Mapped[int] = mapped_column(Integer, default=365)

    owner: Mapped[User] = relationship(back_populates="workspace")
    profile: Mapped[ProfessionalProfile] = relationship(
        back_populates="workspace", cascade="all, delete-orphan", uselist=False
    )


class AuthSession(Base):
    """Revocable opaque browser session; only keyed hashes are persisted."""

    __tablename__ = "auth_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent_hash: Mapped[str | None] = mapped_column(String(64))
    user: Mapped[User] = relationship(back_populates="sessions")


class ProfessionalProfile(Base, TimestampMixin):
    """Curated seeker narrative; extracted statements live as evidence claims until approved."""

    __tablename__ = "professional_profiles"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), unique=True, index=True
    )
    headline: Mapped[str] = mapped_column(String(240), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(String(240), default="")
    seniority: Mapped[str] = mapped_column(String(80), default="")
    years_experience: Mapped[float] = mapped_column(Float, default=0)
    availability: Mapped[str] = mapped_column(String(120), default="")
    preferences: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    links: Mapped[list[dict[str, Any]]] = mapped_column(JsonType, default=list)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    workspace: Mapped[Workspace] = relationship(back_populates="profile")


class Source(Base, TimestampMixin):
    """Origin of evidence with immutable hash and optional tenant-private blob reference."""

    __tablename__ = "sources"
    __table_args__ = (Index("ix_sources_workspace_status", "workspace_id", "status"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(40))
    label: Mapped[str] = mapped_column(String(300))
    status: Mapped[SourceStatus] = mapped_column(
        Enum(SourceStatus, native_enum=False), default=SourceStatus.PENDING
    )
    media_type: Mapped[str | None] = mapped_column(String(160))
    sha256: Mapped[str | None] = mapped_column(String(64), index=True)
    storage_key: Mapped[str | None] = mapped_column(String(500))
    source_url: Mapped[str | None] = mapped_column(Text)
    extracted_text: Mapped[str | None] = mapped_column(Text)
    source_metadata: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    error: Mapped[str | None] = mapped_column(Text)


class TaxonomyConcept(Base):
    """Pinned multilingual ESCO or optional O*NET concept used for normalized mapping."""

    __tablename__ = "taxonomy_concepts"
    __table_args__ = (
        UniqueConstraint("taxonomy", "release", "uri", "language"),
        Index("ix_taxonomy_search", "taxonomy", "release", "language", "preferred_label"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    taxonomy: Mapped[str] = mapped_column(String(30), default="ESCO")
    release: Mapped[str] = mapped_column(String(40))
    uri: Mapped[str] = mapped_column(Text)
    concept_type: Mapped[str] = mapped_column(String(40))
    language: Mapped[str] = mapped_column(String(8))
    preferred_label: Mapped[str] = mapped_column(String(500), index=True)
    alternative_labels: Mapped[list[str]] = mapped_column(JsonType, default=list)
    description: Mapped[str] = mapped_column(Text, default="")


class EvidenceClaim(Base, TimestampMixin):
    """Atomic, reviewable professional assertion bound to an exact source locator."""

    __tablename__ = "evidence_claims"
    __table_args__ = (
        Index("ix_claims_workspace_state", "workspace_id", "state"),
        Index("ix_claims_workspace_type", "workspace_id", "claim_type"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    source_id: Mapped[str | None] = mapped_column(
        ForeignKey("sources.id", ondelete="SET NULL"), index=True
    )
    claim_type: Mapped[str] = mapped_column(String(80))
    statement: Mapped[str] = mapped_column(Text)
    normalized_value: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    source_locator: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    state: Mapped[ClaimState] = mapped_column(
        Enum(ClaimState, native_enum=False), default=ClaimState.PROPOSED
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decision_note: Mapped[str | None] = mapped_column(Text)


class ProfileEmbedding(Base):
    """Versioned multilingual evidence embedding; never a substitute for source provenance."""

    __tablename__ = "profile_embeddings"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    claim_id: Mapped[str] = mapped_column(
        ForeignKey("evidence_claims.id", ondelete="CASCADE"), unique=True, index=True
    )
    model: Mapped[str] = mapped_column(String(160), default="intfloat/multilingual-e5-small")
    model_revision: Mapped[str] = mapped_column(String(160))
    embedding: Mapped[list[float]] = mapped_column(Vector(384).with_variant(JSON(), "sqlite"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


skill_evidence = Table(
    "skill_evidence",
    Base.metadata,
    Column("skill_id", ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True),
    Column("claim_id", ForeignKey("evidence_claims.id", ondelete="CASCADE"), primary_key=True),
)


class Skill(Base, TimestampMixin):
    """Normalized capability node supported by zero or more confirmed evidence claims."""

    __tablename__ = "skills"
    __table_args__ = (UniqueConstraint("workspace_id", "normalized_name"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    normalized_name: Mapped[str] = mapped_column(String(200), index=True)
    taxonomy_uri: Mapped[str | None] = mapped_column(Text)
    level: Mapped[float] = mapped_column(Float, default=0.5)
    years: Mapped[float] = mapped_column(Float, default=0)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    category: Mapped[str] = mapped_column(String(80), default="technical")
    evidence: Mapped[list[EvidenceClaim]] = relationship(secondary=skill_evidence)


class Experience(Base, TimestampMixin):
    """Curated professional experience with optional evidence claim links."""

    __tablename__ = "experiences"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    organization: Mapped[str] = mapped_column(String(240))
    role: Mapped[str] = mapped_column(String(240))
    start_date: Mapped[str] = mapped_column(String(10), default="")
    end_date: Mapped[str | None] = mapped_column(String(10))
    current: Mapped[bool] = mapped_column(Boolean, default=False)
    summary: Mapped[str] = mapped_column(Text, default="")
    achievements: Mapped[list[dict[str, Any]]] = mapped_column(JsonType, default=list)
    skills: Mapped[list[str]] = mapped_column(JsonType, default=list)


class Education(Base, TimestampMixin):
    """Curated education or credential record."""

    __tablename__ = "education"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    institution: Mapped[str] = mapped_column(String(240))
    credential: Mapped[str] = mapped_column(String(240))
    field: Mapped[str] = mapped_column(String(240), default="")
    start_date: Mapped[str] = mapped_column(String(10), default="")
    end_date: Mapped[str | None] = mapped_column(String(10))
    details: Mapped[str] = mapped_column(Text, default="")


class Opportunity(Base, TimestampMixin):
    """Versioned job opportunity normalized from manual, document or URL input."""

    __tablename__ = "opportunities"
    __table_args__ = (Index("ix_opportunities_workspace_status", "workspace_id", "status"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(300))
    employer: Mapped[str] = mapped_column(String(300), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    source_url: Mapped[str | None] = mapped_column(Text)
    source_kind: Mapped[str] = mapped_column(String(40), default="manual")
    source_sha256: Mapped[str | None] = mapped_column(String(64), index=True)
    industry: Mapped[str] = mapped_column(String(160), default="")
    area: Mapped[str] = mapped_column(String(160), default="")
    seniority: Mapped[str] = mapped_column(String(80), default="")
    location: Mapped[str] = mapped_column(String(240), default="")
    remote_mode: Mapped[str] = mapped_column(String(40), default="unspecified")
    compensation: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[OpportunityStatus] = mapped_column(
        Enum(OpportunityStatus, native_enum=False), default=OpportunityStatus.WATCHING
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    structured_data: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    requirements: Mapped[list[Requirement]] = relationship(
        back_populates="opportunity", cascade="all, delete-orphan"
    )


class Requirement(Base, TimestampMixin):
    """Atomic required or preferred opportunity condition."""

    __tablename__ = "requirements"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    opportunity_id: Mapped[str] = mapped_column(
        ForeignKey("opportunities.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[str] = mapped_column(String(80), default="skill")
    label: Mapped[str] = mapped_column(String(300))
    normalized_name: Mapped[str] = mapped_column(String(200), index=True)
    taxonomy_uri: Mapped[str | None] = mapped_column(Text)
    importance: Mapped[str] = mapped_column(String(20), default="required")
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    minimum_level: Mapped[float | None] = mapped_column(Float)
    source_locator: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    opportunity: Mapped[Opportunity] = relationship(back_populates="requirements")


class MatchRun(Base):
    """Immutable deterministic alignment calculation with explicit uncertainty and coverage."""

    __tablename__ = "match_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    opportunity_id: Mapped[str] = mapped_column(
        ForeignKey("opportunities.id", ondelete="CASCADE"), index=True
    )
    policy_version: Mapped[str] = mapped_column(String(40))
    input_digest: Mapped[str] = mapped_column(String(64), index=True)
    score: Mapped[float | None] = mapped_column(Float)
    lower_bound: Mapped[float] = mapped_column(Float)
    upper_bound: Mapped[float] = mapped_column(Float)
    coverage: Mapped[float] = mapped_column(Float)
    eligibility: Mapped[str] = mapped_column(String(30))
    components: Mapped[dict[str, Any]] = mapped_column(JsonType)
    assessments: Mapped[list[dict[str, Any]]] = mapped_column(JsonType)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Recommendation(Base, TimestampMixin):
    """Transparent improvement action linked to gaps and target requirements."""

    __tablename__ = "recommendations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    opportunity_id: Mapped[str | None] = mapped_column(
        ForeignKey("opportunities.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(60))
    title: Mapped[str] = mapped_column(String(300))
    rationale: Mapped[str] = mapped_column(Text)
    requirement_ids: Mapped[list[str]] = mapped_column(JsonType, default=list)
    impact: Mapped[float] = mapped_column(Float, default=0.5)
    effort: Mapped[float] = mapped_column(Float, default=0.5)
    priority: Mapped[float] = mapped_column(Float, default=0.5)
    status: Mapped[str] = mapped_column(String(30), default="suggested")


class CareerArtifact(Base, TimestampMixin):
    """Versioned evidence-grounded resume, letter, brief or follow-up draft."""

    __tablename__ = "career_artifacts"
    __table_args__ = (UniqueConstraint("workspace_id", "kind", "title", "version"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    opportunity_id: Mapped[str | None] = mapped_column(
        ForeignKey("opportunities.id", ondelete="SET NULL"), index=True
    )
    kind: Mapped[str] = mapped_column(String(60))
    title: Mapped[str] = mapped_column(String(300))
    version: Mapped[int] = mapped_column(Integer, default=1)
    content: Mapped[str] = mapped_column(Text)
    evidence_ids: Mapped[list[str]] = mapped_column(JsonType, default=list)
    status: Mapped[str] = mapped_column(String(30), default="draft")
    generator: Mapped[str] = mapped_column(String(80), default="deterministic")


class AgentRun(Base, TimestampMixin):
    """Durable tenant checkpoint for a bounded agent turn and approval lifecycle."""

    __tablename__ = "agent_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(30), default="queued", index=True)
    specialist: Mapped[str | None] = mapped_column(String(80))
    provider: Mapped[str] = mapped_column(String(60))
    input_digest: Mapped[str] = mapped_column(String(64))
    state: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    error_code: Mapped[str | None] = mapped_column(String(100))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Application(Base, TimestampMixin):
    """Candidate-owned application aggregate and current workflow stage."""

    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("workspace_id", "opportunity_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    opportunity_id: Mapped[str] = mapped_column(
        ForeignKey("opportunities.id", ondelete="CASCADE"), index=True
    )
    stage: Mapped[ApplicationStage] = mapped_column(
        Enum(ApplicationStage, native_enum=False), default=ApplicationStage.SAVED
    )
    channel: Mapped[str] = mapped_column(String(80), default="direct")
    notes: Mapped[str] = mapped_column(Text, default="")
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    events: Mapped[list[StageEvent]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )


class StageEvent(Base):
    """Append-only application stage history entry."""

    __tablename__ = "stage_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    application_id: Mapped[str] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    from_stage: Mapped[str | None] = mapped_column(String(30))
    to_stage: Mapped[str] = mapped_column(String(30))
    note: Mapped[str] = mapped_column(Text, default="")
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    application: Mapped[Application] = relationship(back_populates="events")


class CareerTask(Base, TimestampMixin):
    """Task, deadline, reminder or meeting item shown in the career calendar."""

    __tablename__ = "career_tasks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    application_id: Mapped[str | None] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(40), default="task")
    title: Mapped[str] = mapped_column(String(300))
    notes: Mapped[str] = mapped_column(Text, default="")
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reminder_minutes: Mapped[int | None] = mapped_column(Integer)
    contact: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)


class Conversation(Base, TimestampMixin):
    """Tenant-owned bounded agent conversation."""

    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(240), default="Career conversation")
    messages: Mapped[list[AgentMessage]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class AgentMessage(Base):
    """Stored user-visible message, citations and provider usage without hidden reasoning."""

    __tablename__ = "agent_messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    specialist: Mapped[str | None] = mapped_column(String(80))
    provider: Mapped[str | None] = mapped_column(String(60))
    citations: Mapped[list[dict[str, Any]]] = mapped_column(JsonType, default=list)
    usage: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class ProposedChange(Base, TimestampMixin):
    """Agent-authored change set that cannot mutate canonical state before approval."""

    __tablename__ = "proposed_changes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    conversation_id: Mapped[str | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="SET NULL"), index=True
    )
    target_type: Mapped[str] = mapped_column(String(80))
    target_id: Mapped[str | None] = mapped_column(String(36))
    operations: Mapped[list[dict[str, Any]]] = mapped_column(JsonType)
    evidence_ids: Mapped[list[str]] = mapped_column(JsonType, default=list)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditEvent(Base):
    """Append-only redacted security and canonical-data audit event."""

    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str | None] = mapped_column(String(36), index=True)
    actor_user_id: Mapped[str | None] = mapped_column(String(36), index=True)
    action: Mapped[str] = mapped_column(String(120), index=True)
    resource_type: Mapped[str] = mapped_column(String(80))
    resource_id: Mapped[str | None] = mapped_column(String(36))
    details: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
