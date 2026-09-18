"""Stable normalization used by taxonomy, evidence and matching services."""

from __future__ import annotations

import re
import unicodedata


def normalize_label(value: str) -> str:
    """Normalize a human label without translating or silently changing its meaning."""
    decomposed = unicodedata.normalize("NFKD", value.casefold().strip())
    ascii_like = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9+#.]+", " ", ascii_like).strip()


def token_set(value: str) -> set[str]:
    """Return normalized semantic tokens, excluding only very short noise terms."""
    return {token for token in normalize_label(value).split() if len(token) > 1}


def label_similarity(left: str, right: str) -> float:
    """Return deterministic token Jaccard similarity with exact-match preference."""
    a, b = normalize_label(left), normalize_label(right)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    left_tokens, right_tokens = token_set(a), token_set(b)
    union = left_tokens | right_tokens
    return len(left_tokens & right_tokens) / len(union) if union else 0.0


# Connective and filler terms carry no evidence. Left in a comparison they inflate it:
# "experience in leadership" and "experience in cooking" already share half their tokens
# before a single meaningful term has been compared.
_STOPWORDS = frozenset(
    {
        "and", "or", "the", "of", "in", "on", "at", "to", "for", "with", "by", "from",
        "as", "an", "is", "are", "be", "its", "this", "that", "than", "then",
        "de", "del", "la", "el", "los", "las", "en", "con", "por", "para", "un", "una",
        "experience", "experiencia", "years", "year", "anos", "ano",
        "strong", "solid", "proven", "demonstrated", "deep", "solida",
        "ability", "able", "capacity", "knowledge", "conocimiento", "conocimientos",
        "skills", "skill", "habilidades", "level", "nivel",
        "good", "excellent", "plus", "desirable", "deseable", "required", "requerido",
        "preferred", "minimum", "least", "work", "working", "trabajo",
    }
)

# Terms that denote the same thing on a CV. Deliberately small, explicit and auditable:
# the interface has to show a person WHY a requirement was judged met, and an opaque
# embedding cannot be shown. Every entry here is a claim we are willing to defend.
_FAMILIES: tuple[frozenset[str], ...] = (
    frozenset(
        {
            "degree", "bachelor", "bachelors", "bsc", "licenciatura", "titulo",
            "master", "masters", "msc", "mba", "phd", "doctorate", "doctoral",
            "doctorado", "postgraduate", "postgrado", "diploma", "graduate", "grado",
        }
    ),
    frozenset({"engineering", "engineer", "ingenieria", "ingeniero", "ingeniera"}),
    frozenset(
        {
            "leadership", "liderazgo", "lead", "leader", "manager", "management",
            "head", "jefatura", "jefe", "gerente", "subgerente", "director", "gestion",
        }
    ),
    frozenset({"ai", "ia", "artificial", "intelligence", "inteligencia"}),
    frozenset({"ml", "machine", "learning", "aprendizaje", "automatico"}),
    frozenset({"data", "datos", "dato"}),
    frozenset({"analytics", "analytical", "analytic", "analysis", "analisis", "analitica"}),
    frozenset({"governance", "gobernanza", "gobierno"}),
    frozenset({"team", "teams", "equipo", "equipos"}),
    frozenset({"strategy", "strategic", "estrategia", "estrategico"}),
    frozenset({"innovation", "innovacion", "innovative"}),
    frozenset({"spanish", "espanol", "castellano"}),
    frozenset({"english", "ingles"}),
)

_FAMILY_INDEX: dict[str, int] = {
    term: index for index, family in enumerate(_FAMILIES) for term in family
}


def _stem(token: str) -> str:
    """Crude suffix trim, applied only to tokens long enough to survive it."""
    return token[:5] if len(token) >= 6 else token


def _canonical(token: str) -> str:
    """Drop the punctuation `normalize_label` keeps for identifiers like node.js.

    Abbreviated credentials arrive as "b.sc." and "ph.d.", which match nothing without
    this: the dots are typography, not meaning.
    """
    stripped = token.replace(".", "")
    return stripped or token


def tokens_equivalent(left: str, right: str) -> bool:
    """Whether two normalized tokens denote the same thing."""
    left, right = _canonical(left), _canonical(right)
    if left == right or _stem(left) == _stem(right):
        return True
    left_family = _FAMILY_INDEX.get(left)
    return left_family is not None and left_family == _FAMILY_INDEX.get(right)


def semantic_tokens(value: str) -> set[str]:
    """Tokens that carry evidence, with filler removed."""
    return {
        token
        for token in normalize_label(value).split()
        if len(token) > 1 and token not in _STOPWORDS
    }


def label_containment(requirement: str, document: str) -> float:
    """Fraction of a requirement's terms that the document evidences.

    Asymmetric on purpose. Jaccard divides by the union, so a longer, richer evidence
    document scores LOWER against the same requirement than a terse one: "Engineering
    degree" scores 0.09 against a real doctorate record, under any usable threshold.
    Containment asks the question actually being asked, which is whether the document
    covers the requirement, and is therefore independent of how much else it says.
    """
    needles = semantic_tokens(requirement)
    haystack = semantic_tokens(document)
    if not needles or not haystack:
        return 0.0
    covered = sum(
        1 for needle in needles if any(tokens_equivalent(needle, hay) for hay in haystack)
    )
    return covered / len(needles)
