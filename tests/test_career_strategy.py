"""Deterministic compensation scenarios, never asserted employer salaries or tax estimates."""

import pytest
from pydantic import ValidationError

from careertwin.services.career_strategy import CareerStrategy, SalaryOffer, move_comparison


def test_move_comparison_requires_compatible_inputs():
    strategy = CareerStrategy(
        current_fixed=100, desired_uplift_percent=25, transition_cost=5, basis="gross"
    )
    assert move_comparison(strategy)["threshold"] == 130
    assert (
        move_comparison(strategy, SalaryOffer(currency="CLP", low=150))["status"]
        == "missing_inputs"
    )
    for currency, basis in [("USD", "gross"), ("CLP", "net")]:
        result = move_comparison(
            strategy, SalaryOffer(currency=currency, basis=basis, period="month", low=150)
        )
        assert result["status"] == "incompatible"
        assert result["uplift_low_percent"] is None
    assert (
        move_comparison(CareerStrategy(), SalaryOffer(currency="CLP"))["status"] == "missing_inputs"
    )
    assert move_comparison(CareerStrategy(minimum_move=130, basis="gross"))["notes"]


def test_threshold_bounds_period_and_benchmark():
    strategy = CareerStrategy(
        current_fixed=100, desired_uplift_percent=25, minimum_move=140, basis="gross"
    )

    def compare(low=None, high=None, kind="employer", period="month"):
        return move_comparison(
            strategy,
            SalaryOffer(
                currency="CLP", basis="gross", period=period, low=low, high=high, kind=kind
            ),
        )

    assert compare(140)["status"] == "meets_threshold"
    assert compare(high=139)["status"] == "below_threshold"
    assert compare(130, 150)["status"] == "overlaps_threshold"
    assert compare()["status"] == "missing_inputs"
    assert compare(200, kind="benchmark")["status"] == "benchmark_only"
    annual = compare(1680, period="year")
    assert annual["status"] == "meets_threshold" and annual["uplift_low_percent"] == 40
    yearly = move_comparison(
        CareerStrategy(basis="gross", period="year", minimum_move=1680),
        SalaryOffer(currency="CLP", basis="gross", period="month", low=140),
    )
    assert yearly["status"] == "meets_threshold"


@pytest.mark.parametrize(
    "fields",
    [
        {"current_fixed": float("nan")},
        {"desired_uplift_percent": 201},
        {"target_titles": [" "]},
        {"target_titles": ["Head", "Head"]},
        {"modalities": ["remote", "remote"]},
        {"evidence_priorities": ["a\nb"]},
    ],
)
def test_strategy_rejects_unsafe_or_ambiguous_values(fields):
    with pytest.raises(ValidationError):
        CareerStrategy(**fields)


def test_market_attribution_and_range_validation():
    for url in ["http://example.org/pay", "https://user:password@example.org/pay"]:
        with pytest.raises(ValidationError):
            CareerStrategy(
                market_references=[
                    {
                        "label": "Guide",
                        "source_url": url,
                        "checked_on": "2026-10-04",
                        "currency": "CLP",
                    }
                ]
            )
    with pytest.raises(ValidationError):
        SalaryOffer(currency="CLP", low=2, high=1)
