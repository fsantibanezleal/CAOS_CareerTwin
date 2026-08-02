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
