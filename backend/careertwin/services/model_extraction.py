"""Typed local-model extraction followed by a deterministic evidence critic."""

from __future__ import annotations

import json
import re
from typing import Any, Literal

import httpx
from pydantic import BaseModel, Field

from careertwin.agent.prompts import OPPORTUNITY_EXTRACTION, PROFILE_EXTRACTION
from careertwin.config import Settings
from careertwin.services.ingestion import propose_profile_claims
from careertwin.services.normalization import normalize_label, token_set
from careertwin.services.opportunity_ingestion import propose_requirements

PROTECTED_TERMS = {
    "age",
    "gender",
    "ethnicity",
    "religion",
    "disability",
    "pregnant",
    "marital status",
    "sexual orientation",
    "political affiliation",
    "edad",
    "género",
    "etnia",
    "religión",
    "discapacidad",
    "embarazo",
    "estado civil",
    "orientación sexual",
}


class ExtractedClaim(BaseModel):
    """One model-proposed claim that still requires deterministic criticism and user review."""

    claim_type: Literal[
        "skill",
        "experience",
        "education",
        "achievement",
        "certification",
        "language",
        "profile",
    ]
    statement: str = Field(min_length=3, max_length=500)
    source_quote: str = Field(min_length=3, max_length=1_000)
    normalized_value: dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(ge=0, le=1)


class ProfileExtraction(BaseModel):
    claims: list[ExtractedClaim] = Field(default_factory=list, max_length=80)


class ExtractedRequirement(BaseModel):
    category: Literal[
        "skill",
        "experience",
        "education",
        "location",
        "authorization",
        "language",
        "seniority",
        "industry",
        "deadline",
        "compensation",
    ]
    label: str = Field(min_length=2, max_length=300)
    source_quote: str = Field(min_length=2, max_length=1_000)
    importance: Literal["required", "preferred", "eligibility"] = "required"
    weight: float = Field(default=1, ge=0, le=10)
    minimum_level: float | None = Field(default=None, ge=0, le=1)


class OpportunityExtraction(BaseModel):
    requirements: list[ExtractedRequirement] = Field(default_factory=list, max_length=100)


def _structured_completion(
    settings: Settings,
    system: str,
    schema: dict[str, Any],
    payload: dict[str, Any],
) -> str:
    if not settings.ollama_base_url:
        raise ValueError("Local extraction provider is not configured")
    response = httpx.post(
        f"{settings.ollama_base_url.rstrip('/')}/api/chat",
        json={
            "model": settings.ollama_model,
            "stream": False,
            "think": False,
            "format": schema,
            "messages": [
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": json.dumps(payload, ensure_ascii=False),
                },
            ],
            "options": {
                "temperature": 0,
                "num_ctx": settings.llm_context_window,
                "num_predict": settings.llm_max_output_tokens,
            },
            "keep_alive": "5m",
        },
        timeout=settings.llm_request_timeout_seconds,
    )
    response.raise_for_status()
    content = response.json().get("message", {}).get("content")
    if not isinstance(content, str) or not content.strip():
        raise ValueError("Local extraction provider returned no structured output")
    return content


def _chunks(text: str, maximum: int = 6_000, limit: int = 16) -> list[str]:
    paragraphs = [
        paragraph.strip() for paragraph in re.split(r"\n\s*\n", text) if paragraph.strip()
    ]
    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        if current and len(current) + len(paragraph) + 2 > maximum:
            chunks.append(current)
            current = ""
            if len(chunks) >= limit:
                break
        current = f"{current}\n\n{paragraph}".strip()
    if current and len(chunks) < limit:
        chunks.append(current[:maximum])
    return chunks or [text[:maximum]]


def _locator(text: str, quote: str) -> dict[str, int] | None:
    start = text.casefold().find(quote.casefold())
    if start < 0:
        return None
    line_start = text.count("\n", 0, start) + 1
    line_end = line_start + quote.count("\n")
    return {"line_start": line_start, "line_end": line_end}


def _supported(statement: str, quote: str) -> bool:
    statement_tokens = token_set(statement)
    quote_tokens = token_set(quote)
    if not statement_tokens:
        return False
    return len(statement_tokens & quote_tokens) / len(statement_tokens) >= 0.35


def extract_profile_claims(
    text: str, source_id: str, settings: Settings
) -> list[dict[str, object]]:
    """Return typed, quotation-supported profile proposals; never canonical writes."""
    if settings.app_env == "test":
        return propose_profile_claims(text, source_id)
    accepted: list[dict[str, object]] = []
    seen: set[str] = set()
    schema = ProfileExtraction.model_json_schema()
    for index, chunk in enumerate(_chunks(text)):
        output = _structured_completion(
            settings,
            PROFILE_EXTRACTION.system,
            schema,
            {
                "prompt_id": PROFILE_EXTRACTION.identifier,
                "prompt_version": PROFILE_EXTRACTION.version,
                "chunk": index + 1,
                "source_data": chunk,
                "output_schema": schema,
            },
        )
        batch = ProfileExtraction.model_validate_json(output)
        for item in batch.claims:
            locator = _locator(text, item.source_quote)
            normalized = normalize_label(item.statement)
            folded = f"{item.statement} {item.source_quote}".casefold()
            if (
                not locator
                or normalized in seen
                or any(term in folded for term in PROTECTED_TERMS)
                or not _supported(item.statement, item.source_quote)
            ):
                continue
            seen.add(normalized)
            accepted.append(
                {
                    "source_id": source_id,
                    "claim_type": item.claim_type,
                    "statement": item.statement.strip(),
                    "normalized_value": item.normalized_value,
                    "source_locator": {**locator, "quote": item.source_quote},
                    "confidence": min(item.confidence, 0.95),
                }
            )
            if len(accepted) >= 100:
                return accepted
    return accepted


def extract_opportunity_requirements(text: str, settings: Settings) -> list[dict[str, Any]]:
    """Return typed, quotation-supported requirement proposals from a job posting."""
    if settings.app_env == "test":
        return propose_requirements(text)
    schema = OpportunityExtraction.model_json_schema()
    accepted: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, chunk in enumerate(_chunks(text, limit=14)):
        output = _structured_completion(
            settings,
            OPPORTUNITY_EXTRACTION.system,
            schema,
            {
                "prompt_id": OPPORTUNITY_EXTRACTION.identifier,
                "prompt_version": OPPORTUNITY_EXTRACTION.version,
                "chunk": index + 1,
                "source_data": chunk,
                "output_schema": schema,
            },
        )
        batch = OpportunityExtraction.model_validate_json(output)
        for item in batch.requirements:
            locator = _locator(text, item.source_quote)
            normalized = normalize_label(item.label)
            folded = f"{item.label} {item.source_quote}".casefold()
            if (
                not locator
                or normalized in seen
                or any(term in folded for term in PROTECTED_TERMS)
                or not _supported(item.label, item.source_quote)
            ):
                continue
            seen.add(normalized)
            accepted.append(
                {
                    "category": item.category,
                    "label": item.label.strip(),
                    "normalized_name": normalized,
                    "taxonomy_uri": None,
                    "importance": item.importance,
                    "weight": item.weight,
                    "minimum_level": item.minimum_level,
                    "source_locator": {**locator, "quote": item.source_quote},
                }
            )
            if len(accepted) >= 100:
                return accepted
    return accepted
