"""Private career targets and transparent compensation arithmetic, not financial advice."""

from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


class MarketReference(BaseModel):
    """Dated, attributed comparable; never an employer's promised salary."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    label: str = Field(min_length=1, max_length=200)
    source_url: HttpUrl
    checked_on: date
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    basis: Literal["gross", "net", "unspecified"] = "unspecified"
    period: Literal["month", "year", "unspecified"] = "unspecified"
    low: float | None = Field(default=None, ge=0, le=1e12)
    high: float | None = Field(default=None, ge=0, le=1e12)
    note: str = Field(default="", max_length=3000)

    @model_validator(mode="after")
    def safe_source(self) -> MarketReference:
        if (
            self.source_url.scheme != "https"
            or self.source_url.username
            or self.source_url.password
        ):
            raise ValueError("Use a public HTTPS source without credentials")
        if self.low is not None and self.high is not None and self.low > self.high:
            raise ValueError("Market range is reversed")
        return self


class CareerStrategy(BaseModel):
    """Seeker-owned preferences; targets are aspirations, not claims of titles already held."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)
    current_role: str = Field(default="", max_length=240)
    target_titles: list[str] = Field(default_factory=list, max_length=20)
    location: str = Field(default="", max_length=160)
    modalities: list[Literal["hybrid", "onsite", "remote"]] = Field(
        default_factory=list, max_length=3
    )
    currency: str = Field(default="CLP", pattern=r"^[A-Z]{3}$")
    basis: Literal["gross", "net", "unspecified"] = "unspecified"
    period: Literal["month", "year"] = "month"
    current_fixed: float | None = Field(default=None, gt=0, le=1e12)
    minimum_move: float | None = Field(default=None, gt=0, le=1e12)
    desired_uplift_percent: float = Field(default=0, ge=0, le=200)
    transition_cost: float = Field(default=0, ge=0, le=1e12)
    positioning: str = Field(default="", max_length=8000)
    evidence_priorities: list[str] = Field(default_factory=list, max_length=20)
    market_references: list[MarketReference] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def bounded_text(self) -> CareerStrategy:
        for values in (self.target_titles, self.evidence_priorities):
            if any(
                not item.strip() or len(item) > 500 or any(ord(char) < 32 for char in item)
                for item in values
            ):
                raise ValueError(
                    "Use nonempty single-line titles/priorities, maximum 500 characters"
                )
        if len(set(self.target_titles)) != len(self.target_titles) or len(
            set(self.modalities)
        ) != len(self.modalities):
            raise ValueError("Duplicate targets or modalities")
        return self


class SalaryOffer(BaseModel):
    """Comparable declared fixed-pay values; a market benchmark is never an employer offer."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    basis: Literal["gross", "net", "unspecified"] = "unspecified"
    period: Literal["month", "year", "unspecified"] = "unspecified"
    low: float | None = Field(default=None, ge=0, le=1e12)
    high: float | None = Field(default=None, ge=0, le=1e12)
    kind: Literal["employer", "benchmark"] = "employer"

    @model_validator(mode="after")
    def ordered(self) -> SalaryOffer:
        if self.low is not None and self.high is not None and self.low > self.high:
            raise ValueError("Offer range is reversed")
        return self


def move_comparison(strategy: CareerStrategy, offer: SalaryOffer | None = None) -> dict[str, Any]:
    """Evaluate a user-defined threshold only on comparable fixed pay; never infer net/gross or FX."""
    threshold = strategy.minimum_move
    if strategy.current_fixed is not None:
        calculated = (
            strategy.current_fixed * (1 + strategy.desired_uplift_percent / 100)
            + strategy.transition_cost
        )
        threshold = max(threshold or 0, calculated)
    missing = []
    if strategy.current_fixed is None:
        missing.append(
            "Current fixed compensation is missing; an increase from the current role is not established."
        )
    if threshold is None:
        missing.append("Set current pay or an explicit minimum move before comparison.")
    result: dict[str, Any] = {
        "threshold": round(threshold, 2) if threshold is not None else None,
        "currency": strategy.currency,
        "period": strategy.period,
        "basis": strategy.basis,
        "status": "not_compared",
        "notes": missing,
        "uplift_low_percent": None,
        "uplift_high_percent": None,
        "offer_low": None,
        "offer_high": None,
    }
    if offer is None:
        return result
    if (
        threshold is None
        or strategy.basis == "unspecified"
        or offer.basis == "unspecified"
        or offer.period == "unspecified"
    ):
        result["status"] = "missing_inputs"
        result["notes"].append(
            "Currency, gross/net basis and salary period must be explicit; no conversion is assumed."
        )
        return result
    if strategy.currency != offer.currency or strategy.basis != offer.basis:
        result["status"] = "incompatible"
        result["notes"].append(
            "Currency or gross/net basis differs; no exchange-rate or tax conversion is applied."
        )
        return result
    factor = (12 if strategy.period == "year" else 1) / (12 if offer.period == "year" else 1)
    low = offer.low * factor if offer.low is not None else None
    high = offer.high * factor if offer.high is not None else None
    result["offer_low"], result["offer_high"] = low, high
    if strategy.current_fixed is not None:
        for key, value in (("uplift_low_percent", low), ("uplift_high_percent", high)):
            if value is not None:
                result[key] = round((value / strategy.current_fixed - 1) * 100, 2)
    if offer.kind == "benchmark":
        result["status"] = "benchmark_only"
        result["notes"].append("This is market research, not an actual offer or a justified move.")
    elif low is not None and low >= threshold:
        result["status"] = "meets_threshold"
    elif high is not None and high < threshold:
        result["status"] = "below_threshold"
    elif low is not None and high is not None:
        result["status"] = "overlaps_threshold"
    else:
        result["status"] = "missing_inputs"
    result["notes"].append(
        "Compare bonus, benefits, contract, scope, commute and risk separately; fixed-pay alignment is not a recommendation to resign."
    )
    return result
