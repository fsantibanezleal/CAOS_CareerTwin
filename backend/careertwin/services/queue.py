"""Durable Redis queue submission helpers with stable idempotency keys."""

from __future__ import annotations

from arq import create_pool
from arq.connections import RedisSettings

from careertwin.config import Settings


async def enqueue_source(settings: Settings, workspace_id: str, source_id: str) -> bool:
    """Queue one committed source and return false when its stable job already exists."""
    pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    try:
        job = await pool.enqueue_job(
            "process_source", workspace_id, source_id, _job_id=f"source:{source_id}"
        )
        return job is not None
    finally:
        await pool.aclose()
