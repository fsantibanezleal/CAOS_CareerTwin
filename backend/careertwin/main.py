"""CareerTwin FastAPI application and production-safe HTTP shell."""

from __future__ import annotations

import secrets
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
import redis
import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from sqlalchemy import text

from careertwin import __version__
from careertwin.agent.providers import provider_registry
from careertwin.api import (
    admin,
    agent,
    artifacts,
    auth,
    connectors,
    matching,
    opportunities,
    pipeline,
    profile,
    taxonomy,
    workspace,
)
from careertwin.config import get_settings
from careertwin.database import SessionLocal
from careertwin.services.ingestion import clamav_ready

log = structlog.get_logger("careertwin")
REQUESTS = Counter("careertwin_http_requests_total", "HTTP requests", ["method", "path", "status"])
LATENCY = Histogram("careertwin_http_request_seconds", "HTTP request latency", ["method", "path"])


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Create private runtime directories and verify configuration without printing secrets."""
    settings = get_settings()
    settings.blob_root.mkdir(parents=True, exist_ok=True)
    log.info("app.started", version=__version__, environment=settings.app_env)
    yield
    log.info("app.stopped")


app = FastAPI(
    title="CareerTwin API",
    version=__version__,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token", "X-Request-ID"],
)


@app.middleware("http")
async def security_and_observability(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Add trace correlation, response security headers and low-cardinality request metrics."""
    request_id = request.headers.get("x-request-id", secrets.token_hex(12))[:128]
    route_path = request.url.path if request.url.path.startswith("/api/") else "frontend"
    with LATENCY.labels(request.method, route_path).time():
        response = await call_next(request)
    REQUESTS.labels(request.method, route_path, response.status_code).inc()
    response.headers.update(
        {
            "X-Request-ID": request_id,
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            "Cross-Origin-Opener-Policy": "same-origin",
            "Content-Security-Policy": (
                "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
                "script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; "
                "base-uri 'self'; form-action 'self'"
            ),
        }
    )
    return response


@app.get("/api/health/live", tags=["operations"])
def liveness() -> dict[str, str]:
    """Report process liveness without touching dependencies."""
    return {"status": "ok", "version": __version__}


@app.get("/api/health/ready", tags=["operations"])
def readiness() -> JSONResponse:
    """Verify every dependency required to accept normal user work."""
    checks: dict[str, str] = {}
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = type(exc).__name__
    try:
        client = redis.Redis.from_url(
            settings.redis_url, socket_timeout=1, socket_connect_timeout=1
        )
        checks["redis"] = "ok" if client.ping() else "unavailable"
    except Exception as exc:
        checks["redis"] = type(exc).__name__
    provider = provider_registry(settings).get(settings.llm_default_provider)
    checks["model_provider"] = "ok" if provider and provider.ready() else "unavailable"
    if settings.clamav_host:
        checks["malware_scanner"] = (
            "ok" if clamav_ready(settings.clamav_host, settings.clamav_port) else "unavailable"
        )
    if settings.docling_url:
        try:
            response = httpx.get(f"{settings.docling_url.rstrip('/')}/health", timeout=3)
            checks["document_intelligence"] = "ok" if response.is_success else "unavailable"
        except httpx.HTTPError as exc:
            checks["document_intelligence"] = type(exc).__name__
    healthy = all(value == "ok" for value in checks.values())
    return JSONResponse(
        {"status": "ok" if healthy else "degraded", "version": __version__, "checks": checks},
        status_code=200 if healthy else 503,
    )


@app.get("/metrics", include_in_schema=False)
def metrics() -> Response:
    """Expose Prometheus metrics without request bodies, user labels or personal identifiers."""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


for api_router in (
    auth.router,
    admin.router,
    profile.router,
    opportunities.router,
    matching.router,
    pipeline.router,
    connectors.router,
    agent.router,
    artifacts.router,
    taxonomy.router,
    workspace.router,
):
    app.include_router(api_router)

frontend_candidates = (
    Path.cwd() / "frontend" / "dist",
    Path(__file__).resolve().parents[2] / "frontend" / "dist",
)
frontend_dist = next(
    (candidate for candidate in frontend_candidates if (candidate / "index.html").is_file()),
    frontend_candidates[0],
)
if (frontend_dist / "assets").exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")


@app.get("/{path:path}", include_in_schema=False)
def frontend(path: str) -> Response:
    """Serve the SPA for non-API routes while preserving explicit API 404 behavior."""
    if path.startswith("api/") or path == "metrics":
        return JSONResponse({"detail": "Not found"}, status_code=404)
    index = frontend_dist / "index.html"
    if index.exists():
        return FileResponse(index)
    return JSONResponse(
        {"detail": "Frontend is not built. Run the local development script."}, status_code=503
    )
