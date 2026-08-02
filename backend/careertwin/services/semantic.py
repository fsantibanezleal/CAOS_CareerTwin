"""Private multilingual embeddings through the configured local Ollama service."""

from __future__ import annotations

from collections.abc import Sequence

import httpx

from careertwin.config import Settings

EMBEDDING_DIMENSIONS = 768


def ollama_model_revision(settings: Settings, model: str) -> str:
    """Resolve the locally installed immutable digest for provenance."""
    if not settings.ollama_base_url:
        raise ValueError("Ollama is not configured")
    response = httpx.get(f"{settings.ollama_base_url.rstrip('/')}/api/tags", timeout=10)
    response.raise_for_status()
    for item in response.json().get("models", []):
        name = str(item.get("name", ""))
        if name in {model, f"{model}:latest"}:
            digest = str(item.get("digest", ""))
            if digest:
                return digest
    raise ValueError(f"Ollama model is not installed: {model}")


def embed_texts(settings: Settings, texts: Sequence[str]) -> list[list[float]]:
    """Embed a bounded text batch locally and enforce the persisted vector dimension."""
    if not texts:
        return []
    if len(texts) > 64:
        raise ValueError("Embedding batch exceeds 64 texts")
    if not settings.ollama_base_url:
        raise ValueError("Ollama is not configured")
    inputs = [text.strip()[:8_000] for text in texts]
    if any(not text for text in inputs):
        raise ValueError("Embedding inputs must not be empty")
    response = httpx.post(
        f"{settings.ollama_base_url.rstrip('/')}/api/embed",
        json={"model": settings.ollama_embedding_model, "input": inputs, "truncate": True},
        timeout=settings.llm_request_timeout_seconds,
    )
    response.raise_for_status()
    embeddings = response.json().get("embeddings")
    if not isinstance(embeddings, list) or len(embeddings) != len(inputs):
        raise ValueError("Ollama returned an invalid embedding batch")
    vectors = [[float(value) for value in vector] for vector in embeddings]
    if any(len(vector) != EMBEDDING_DIMENSIONS for vector in vectors):
        raise ValueError("Ollama embedding dimension does not match the database contract")
    return vectors
