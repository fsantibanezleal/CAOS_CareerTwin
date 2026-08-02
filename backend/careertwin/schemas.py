"""Validated public API contracts shared by deterministic services and agent tools."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, field_validator


class ApiModel(BaseModel):
    """Base response model supporting construction from SQLAlchemy entities."""

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=1024)


class UserRead(ApiModel):
    id: str
    email: EmailStr
    display_name: str
    is_active: bool
    is_superuser: bool
    locale: str
    theme: str
    must_change_password: bool


class SessionRead(BaseModel):
    user: UserRead
    csrf_token: str
    expires_at: datetime


class AdminUserCreate(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=1, max_length=160)
    temporary_password: str = Field(min_length=12, max_length=1024)
    is_superuser: bool = False
    locale: Literal["en", "es"] = "en"


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=8, max_length=1024)
    new_password: str = Field(min_length=12, max_length=1024)


class AccountPreferences(BaseModel):
    locale: Literal["en", "es"]
    theme: Literal["light", "dark"]


class ProfileUpdate(BaseModel):
    headline: str = Field(default="", max_length=240)
    summary: str = Field(default="", max_length=20_000)
    location: str = Field(default="", max_length=240)
    seniority: str = Field(default="", max_length=80)
    years_experience: float = Field(default=0, ge=0, le=80)
    availability: str = Field(default="", max_length=120)
    preferences: dict[str, Any] = Field(default_factory=dict)
    links: list[dict[str, Any]] = Field(default_factory=list, max_length=30)
    revision: int = Field(ge=1)


class ProfileRead(ProfileUpdate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    workspace_id: str
    updated_at: datetime


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    taxonomy_uri: str | None = Field(default=None, max_length=1000)
    level: float = Field(default=0.5, ge=0, le=1)
    years: float = Field(default=0, ge=0, le=80)
    confidence: float = Field(default=0.5, ge=0, le=1)
    category: str = Field(default="technical", max_length=80)
    evidence_ids: list[str] = Field(default_factory=list, max_length=100)


class SkillRead(ApiModel):
    id: str
    name: str
    normalized_name: str
    taxonomy_uri: str | None
    level: float
    years: float
    confidence: float
    category: str
    evidence_count: int = 0


class ExperienceCreate(BaseModel):
    organization: str = Field(min_length=1, max_length=240)
    role: str = Field(min_length=1, max_length=240)
    start_date: str = Field(default="", max_length=10)
    end_date: str | None = Field(default=None, max_length=10)
    current: bool = False
    summary: str = Field(default="", max_length=20_000)
    achievements: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    skills: list[str] = Field(default_factory=list, max_length=100)


class EducationCreate(BaseModel):
    institution: str = Field(min_length=1, max_length=240)
    credential: str = Field(min_length=1, max_length=240)
    field: str = Field(default="", max_length=240)
    start_date: str = Field(default="", max_length=10)
    end_date: str | None = Field(default=None, max_length=10)
    details: str = Field(default="", max_length=10_000)


class SourceRead(ApiModel):
    id: str
    kind: str
    label: str
    status: str
    media_type: str | None
    sha256: str | None
    source_url: str | None
    source_metadata: dict[str, Any]
    error: str | None
    created_at: datetime


class ClaimProposal(BaseModel):
    claim_type: str = Field(min_length=1, max_length=80)
    statement: str = Field(min_length=1, max_length=20_000)
    normalized_value: dict[str, Any] = Field(default_factory=dict)
    source_locator: dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(default=0.5, ge=0, le=1)
    source_id: str | None = None


class ClaimRead(ApiModel):
    id: str
    source_id: str | None
    claim_type: str
    statement: str
    normalized_value: dict[str, Any]
    source_locator: dict[str, Any]
    confidence: float
    state: str
    decision_note: str | None
    created_at: datetime


class ClaimDecision(BaseModel):
    decision: Literal["confirmed", "rejected"]
    note: str = Field(default="", max_length=2000)


class RequirementInput(BaseModel):
    category: str = Field(default="skill", max_length=80)
    label: str = Field(min_length=1, max_length=300)
    normalized_name: str | None = Field(default=None, max_length=200)
    taxonomy_uri: str | None = Field(default=None, max_length=1000)
    importance: Literal["required", "preferred", "eligibility"] = "required"
    weight: float = Field(default=1, ge=0, le=10)
    minimum_level: float | None = Field(default=None, ge=0, le=1)
    source_locator: dict[str, Any] = Field(default_factory=dict)

    @field_validator("normalized_name", mode="before")
    @classmethod
    def empty_name_is_none(cls, value: object) -> object:
        return None if value == "" else value


class RequirementRead(RequirementInput):
    model_config = ConfigDict(from_attributes=True)
    id: str
    normalized_name: str


class OpportunityCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    employer: str = Field(default="", max_length=300)
    description: str = Field(default="", max_length=100_000)
    source_url: HttpUrl | None = None
    source_kind: Literal["manual", "paste", "file", "url"] = "manual"
    industry: str = Field(default="", max_length=160)
    area: str = Field(default="", max_length=160)
    seniority: str = Field(default="", max_length=80)
    location: str = Field(default="", max_length=240)
    remote_mode: Literal["unspecified", "onsite", "hybrid", "remote"] = "unspecified"
    compensation: dict[str, Any] = Field(default_factory=dict)
    published_at: datetime | None = None
    deadline_at: datetime | None = None
    status: Literal["watching", "active", "expired", "archived"] = "watching"
    requirements: list[RequirementInput] = Field(default_factory=list, max_length=300)


class OpportunityRead(ApiModel):
    id: str
    title: str
    employer: str
    description: str
    source_url: str | None
    source_kind: str
    industry: str
    area: str
    seniority: str
    location: str
    remote_mode: str
    compensation: dict[str, Any]
    published_at: datetime | None
    deadline_at: datetime | None
    status: str
    version: int
    structured_data: dict[str, Any]
    requirements: list[RequirementRead]
    created_at: datetime
    updated_at: datetime


class OpportunityUrlCapture(BaseModel):
    url: HttpUrl


class TargetSetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)
    opportunity_ids: list[str] = Field(default_factory=list, max_length=500)
    strategy: dict[str, Any] = Field(default_factory=dict)


class TargetSetRead(TargetSetCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


class RequirementAssessment(BaseModel):
    requirement_id: str
    label: str
    importance: str
    status: Literal["met", "partial", "missing", "unknown", "conflict"]
    score: float | None
    evidence_ids: list[str] = Field(default_factory=list)
    explanation: str


class MatchRead(ApiModel):
    id: str
    opportunity_id: str
    policy_version: str
    input_digest: str
    score: float | None
    lower_bound: float
    upper_bound: float
    coverage: float
    eligibility: str
    components: dict[str, Any]
    assessments: list[dict[str, Any]]
    created_at: datetime


class RecommendationRead(ApiModel):
    id: str
    opportunity_id: str | None
    kind: str
    title: str
    rationale: str
    requirement_ids: list[str]
    impact: float
    effort: float
    priority: float
    status: str
    prerequisites: list[str]
    steps: list[dict[str, Any]]
    progress: float


class RecommendationUpdate(BaseModel):
    effort: float | None = Field(default=None, ge=0, le=1)
    status: Literal["suggested", "planned", "doing", "completed", "dismissed"] | None = None
    prerequisites: list[str] | None = Field(default=None, max_length=100)
    steps: list[dict[str, Any]] | None = Field(default=None, max_length=100)
    progress: float | None = Field(default=None, ge=0, le=1)


class ArtifactCreate(BaseModel):
    kind: Literal["resume", "cover_letter", "interview_brief", "follow_up"]
    title: str = Field(min_length=1, max_length=300)
    opportunity_id: str | None = None
    evidence_ids: list[str] = Field(default_factory=list, max_length=200)


class ArtifactRead(ApiModel):
    id: str
    opportunity_id: str | None
    kind: str
    title: str
    version: int
    content: str
    evidence_ids: list[str]
    status: str
    generator: str
    created_at: datetime
    updated_at: datetime


class AccomplishmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    situation: str = Field(default="", max_length=20_000)
    task: str = Field(default="", max_length=20_000)
    action: str = Field(default="", max_length=20_000)
    result: str = Field(default="", max_length=20_000)
    evidence_ids: list[str] = Field(default_factory=list, max_length=200)
    skills: list[str] = Field(default_factory=list, max_length=100)
    metrics: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    status: Literal["draft", "confirmed", "archived"] = "draft"


class AccomplishmentRead(AccomplishmentCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


class ResumeVariantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    opportunity_id: str | None = None
    summary: str = Field(default="", max_length=20_000)
    section_order: list[str] = Field(
        default_factory=lambda: ["summary", "experience", "skills", "education"]
    )
    evidence_ids: list[str] = Field(default_factory=list, max_length=300)
    accomplishment_ids: list[str] = Field(default_factory=list, max_length=200)


class ResumeVariantRead(ApiModel):
    id: str
    name: str
    version: int
    opportunity_id: str | None
    summary: str
    section_order: list[str]
    evidence_ids: list[str]
    accomplishment_ids: list[str]
    content: str
    status: str
    created_at: datetime
    updated_at: datetime


class EmailThreadRead(ApiModel):
    id: str
    opportunity_id: str | None
    application_id: str | None
    external_thread_id: str
    subject: str
    participants: list[dict[str, str]]
    messages: list[dict[str, Any]]
    last_message_at: datetime | None
    retention_until: datetime | None
    created_at: datetime


class BrowserCapture(BaseModel):
    url: HttpUrl
    title: str = Field(default="", max_length=500)
    content: str = Field(min_length=1, max_length=500_000)
    captured_at: datetime


class ConnectionRead(ApiModel):
    id: str
    provider: str
    account_subject: str
    status: str
    scopes: list[str]
    selected_resource: str | None
    last_synced_at: datetime | None
    connection_metadata: dict[str, Any]
    created_at: datetime


class CalendarSyncRequest(BaseModel):
    calendar_id: str | None = Field(default=None, max_length=500)
    days_back: int = Field(default=30, ge=0, le=365)
    days_forward: int = Field(default=180, ge=1, le=730)


class ConnectionAuthorizeRequest(BaseModel):
    services: list[Literal["calendar", "email"]] = Field(min_length=1, max_length=2)
    redirect_after: Literal["/pipeline", "/profile", "/opportunities", "/today"] = "/pipeline"


class EmailSyncRequest(BaseModel):
    days_back: int = Field(default=180, ge=1, le=730)
    max_threads: int = Field(default=100, ge=1, le=200)
    create_follow_up_tasks: bool = True


class BrowserCredentialCreate(BaseModel):
    label: str = Field(default="Browser extension", min_length=1, max_length=200)
    expires_in_days: int = Field(default=180, ge=1, le=365)


class BrowserCredentialIssued(BaseModel):
    id: str
    label: str
    token: str
    expires_at: datetime


class BrowserCredentialRead(ApiModel):
    id: str
    label: str
    last_used_at: datetime | None
    expires_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class ApplicationCreate(BaseModel):
    opportunity_id: str
    channel: str = Field(default="direct", max_length=80)
    notes: str = Field(default="", max_length=20_000)


class StageChange(BaseModel):
    stage: Literal[
        "saved",
        "preparing",
        "applied",
        "screening",
        "interview",
        "offer",
        "accepted",
        "withdrawn",
        "rejected",
    ]
    note: str = Field(default="", max_length=5000)


class ApplicationRead(ApiModel):
    id: str
    opportunity_id: str
    stage: str
    channel: str
    notes: str
    applied_at: datetime | None
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TaskCreate(BaseModel):
    application_id: str | None = None
    kind: Literal["task", "deadline", "meeting", "reminder"] = "task"
    title: str = Field(min_length=1, max_length=300)
    notes: str = Field(default="", max_length=10_000)
    starts_at: datetime | None = None
    due_at: datetime | None = None
    reminder_minutes: int | None = Field(default=None, ge=0, le=43_200)
    contact: dict[str, Any] = Field(default_factory=dict)
    contact_id: str | None = None


class TaskRead(TaskCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    completed_at: datetime | None


class ContactCreate(BaseModel):
    application_id: str | None = None
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr | None = None
    organization: str = Field(default="", max_length=240)
    role: str = Field(default="", max_length=160)
    notes: str = Field(default="", max_length=10_000)


class ContactRead(ApiModel):
    id: str
    application_id: str | None
    name: str
    email: str
    organization: str
    role: str
    notes: str
    created_at: datetime
    updated_at: datetime


class GithubSnapshotRequest(BaseModel):
    token: str = Field(min_length=20, max_length=512, repr=False)
    repositories: list[str] = Field(default_factory=list, max_length=50)


class GithubSnapshot(BaseModel):
    login: str
    repositories: list[dict[str, Any]]
    rate_limit: dict[str, Any]
    proposed_claims: list[ClaimProposal]


class ChatRequest(BaseModel):
    conversation_id: str | None = None
    message: str = Field(min_length=1, max_length=20_000)
    provider: str | None = Field(default=None, max_length=60)
    opportunity_id: str | None = None


class AgentRunRead(ApiModel):
    id: str
    conversation_id: str
    status: str
    specialist: str | None
    provider: str
    input_digest: str
    state: dict[str, Any]
    error_code: str | None
    parent_run_id: str | None
    attempt: int
    cancel_requested_at: datetime | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    content: str
    specialist: str
    provider: str
    citations: list[dict[str, Any]]
    proposed_change_id: str | None = None
    usage: dict[str, Any] = Field(default_factory=dict)
    run_id: str


class ProposedChangeDecision(BaseModel):
    decision: Literal["approved", "rejected"]


class DashboardSummary(BaseModel):
    profile_completeness: float
    confirmed_evidence: int
    review_pending: int
    active_opportunities: int
    applications_by_stage: dict[str, int]
    upcoming_tasks: list[TaskRead]
    global_alignment: float | None
    global_alignment_coverage: float
