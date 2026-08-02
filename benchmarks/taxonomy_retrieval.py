"""Measure lexical, ESCO-graph and local-semantic retrieval on a bilingual gold set."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from statistics import mean
from typing import Any

from careertwin.config import get_settings
from careertwin.database import SessionLocal
from careertwin.services.taxonomy import search_concepts


def _percentile(values: list[float], proportion: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    return ordered[min(len(ordered) - 1, round((len(ordered) - 1) * proportion))]


def evaluate(cases: list[dict[str, Any]], mode: str) -> dict[str, Any]:
    """Evaluate one retrieval ablation without changing taxonomy or user data."""
    reciprocal_ranks: list[float] = []
    recall_one: list[float] = []
    recall_five: list[float] = []
    latencies: list[float] = []
    details: list[dict[str, Any]] = []
    settings = get_settings()
    with SessionLocal() as db:
        for case in cases:
            started = time.perf_counter()
            results = search_concepts(
                db,
                str(case["query"]),
                str(case["language"]),
                str(case["type"]),
                limit=10,
                settings=settings,
                mode=mode,
            )
            latency_ms = (time.perf_counter() - started) * 1_000
            expected = {str(label).casefold() for label in case["expected_labels"]}
            labels = [str(result["preferred_label"]).casefold() for result in results]
            rank = next(
                (index + 1 for index, label in enumerate(labels) if label in expected), None
            )
            reciprocal_ranks.append(1 / rank if rank else 0.0)
            recall_one.append(1.0 if rank == 1 else 0.0)
            recall_five.append(1.0 if rank and rank <= 5 else 0.0)
            latencies.append(latency_ms)
            details.append(
                {
                    "id": case["id"],
                    "rank": rank,
                    "latency_ms": round(latency_ms, 2),
                    "top_labels": [result["preferred_label"] for result in results[:5]],
                }
            )
    return {
        "mode": mode,
        "cases": len(cases),
        "mrr": round(mean(reciprocal_ranks), 4),
        "recall_at_1": round(mean(recall_one), 4),
        "recall_at_5": round(mean(recall_five), 4),
        "latency_ms_p50": round(_percentile(latencies, 0.5), 2),
        "latency_ms_p95": round(_percentile(latencies, 0.95), 2),
        "details": details,
    }


def main() -> None:
    """Run all ablations and persist a provenance-bearing machine-readable report."""
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--cases", type=Path, default=Path(__file__).with_name("taxonomy_retrieval_cases.json")
    )
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--require-nondegradation", action="store_true")
    args = parser.parse_args()
    cases = json.loads(args.cases.read_text(encoding="utf-8"))
    results = [evaluate(cases, mode) for mode in ("lexical", "lexical_graph", "hybrid")]
    report = {
        "schema": "careertwin.taxonomy-retrieval-benchmark.v1",
        "dataset": args.cases.name,
        "settings": {
            "esco_release": "1.2.1",
            "embedding_model": get_settings().ollama_embedding_model,
        },
        "results": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    if args.require_nondegradation and results[-1]["mrr"] < results[0]["mrr"]:
        raise SystemExit("Hybrid retrieval degraded MRR; semantic score promotion is rejected")
    for result in results:
        print(
            f"{result['mode']}: MRR={result['mrr']:.4f} "
            f"R@5={result['recall_at_5']:.4f} p95={result['latency_ms_p95']:.2f}ms"
        )


if __name__ == "__main__":
    main()
