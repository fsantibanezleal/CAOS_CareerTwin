"""Guards for the metric that decides whether a requirement is met.

These exist because the workbench spent its whole life reporting "Available confirmed
evidence does not resolve this requirement" for "Engineering degree" against a profile
holding a B.Sc. in Electronics Engineering and a Ph.D. in Electrical Engineering. The
requirement was real, the evidence was real, and the metric could not connect them:
token Jaccard divides by the union of both token sets, so a short label compared against
a full education record peaked at 0.09 against a 0.40 threshold.
"""

from __future__ import annotations

from careertwin.services.normalization import (
    label_containment,
    label_similarity,
    semantic_tokens,
    tokens_equivalent,
)

BSC = "B.Sc. in Electronics Engineering (Civil) Electronics Engineering Universidad de Concepcion, Faculty of Engineering"
PHD = "Ph.D. in Electrical Engineering Electrical Engineering Universidad de Chile, Faculty of Physical and Mathematical Sciences"
DIPLOMA = "Postgraduate Diploma in Medical Informatics Medical Informatics Universidad de Chile"


def test_a_held_degree_resolves_its_requirement() -> None:
    """The exact failure a user reported on the deployed workbench."""
    assert label_containment("Engineering degree", BSC) == 1.0
    assert label_containment("Engineering degree", PHD) == 1.0


def test_jaccard_could_never_have_resolved_it() -> None:
    """Record why the metric changed, so nobody restores the old one as a simplification."""
    assert label_similarity("Engineering degree", BSC) < 0.2
    assert label_similarity("Engineering degree", PHD) < 0.2


def test_richer_evidence_never_scores_lower_than_terser_evidence() -> None:
    """The decisive property. Jaccard punished detail; a career record is mostly detail."""
    terse = "Ph.D. in Electrical Engineering"
    detailed = f"{terse} Universidad de Chile, Faculty of Physical and Mathematical Sciences, thesis on inverse problems"
    assert label_containment("Engineering degree", detailed) >= label_containment(
        "Engineering degree", terse
    )
    assert label_similarity("Engineering degree", detailed) < label_similarity(
        "Engineering degree", terse
    )


def test_abbreviated_credentials_are_not_typography() -> None:
    """"b.sc." and "ph.d." carry dots that normalization keeps for node.js and .net."""
    assert tokens_equivalent("degree", "b.sc.")
    assert tokens_equivalent("degree", "ph.d.")
    assert tokens_equivalent("engineering", "ingenieria")


def test_filler_terms_do_not_manufacture_similarity() -> None:
    """Without this, "experience in X" and "experience in Y" start out half-matched."""
    assert semantic_tokens("Strong experience in leadership") == {"leadership"}
    assert label_containment("Strong experience in leadership", "Years of experience in cooking") == 0.0


def test_an_unrelated_requirement_stays_unresolved() -> None:
    """Containment must not resolve everything; a false "met" is worse than a gap."""
    assert label_containment("Veterinary licence", BSC) == 0.0
    assert label_containment("Kubernetes operator development", DIPLOMA) == 0.0
