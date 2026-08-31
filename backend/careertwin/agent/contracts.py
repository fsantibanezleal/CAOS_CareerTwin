"""Typed agent input and output contracts."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class EvidenceReference(BaseModel):
    evidence_id: str
    label: str


class ChangeOperation(BaseModel):
    op: Literal["add", "replace", "remove"]
    path: str = Field(pattern=r"^/[a-zA-Z0-9_/-]+$")
    value: Any | None = None


class AgentDraft(BaseModel):
    """User-visible answer plus citations and optional uncommitted change proposal."""

    # Keep a provider-independent runtime bound without coupling the public schema
    # to one vendor's structured-output grammar.
    answer: str = Field(min_length=1)
    specialist: Literal[
        "profile",
        "opportunity",
        "matching",
        "improvement",
        "pipeline",
        "guide",
    ]
    citations: list[EvidenceReference] = Field(default_factory=list, max_length=40)
    proposed_operations: list[ChangeOperation] = Field(default_factory=list, max_length=50)

    @field_validator("answer")
    @classmethod
    def bound_visible_answer(cls, value: str) -> str:
        """Reject oversized visible output without emitting an incompatible grammar."""
        if len(value) > 20_000:
            raise ValueError("Agent answers may contain at most 20000 characters")
        return value

    @model_validator(mode="after")
    def require_citations_for_changes(self) -> AgentDraft:
        if self.proposed_operations and not self.citations:
            raise ValueError("Agent change proposals require at least one evidence citation")
        return self


class AgentContext(BaseModel):
    question: str
    opportunity_id: str | None = None
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    match: dict[str, Any] | None = None
    locale: Literal["en", "es"] = "en"
