FROM node:24.20-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM cgr.dev/chainguard/python:latest-dev@sha256:6a2f9c5a2c2374c991f08eeed2ee1fa8fe2b61972b8a05c5a020f172c3513a5e AS python-build
USER root
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
RUN python -m venv /venv && /venv/bin/pip install --upgrade pip==26.2
COPY requirements.txt ./
RUN /venv/bin/pip install -r requirements.txt
COPY pyproject.toml README.md ./
COPY backend ./backend
RUN /venv/bin/pip install --no-deps .
RUN /venv/bin/pip check \
    && /venv/bin/pip uninstall -y setuptools wheel \
    && rm -rf \
        /venv/bin/pip \
        /venv/bin/pip3 \
        /venv/bin/pip3.14 \
        /venv/lib/python3.14/site-packages/pip \
        /venv/lib/python3.14/site-packages/pip-*.dist-info
RUN mkdir -p /var/lib/careertwin/blobs && chown -R 65532:65532 /var/lib/careertwin

FROM cgr.dev/chainguard/python:latest@sha256:c8e464ca00c86bd80498e0e509120b0d2dadcd9655dcc31b0efd0caf86465253 AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/venv/bin:$PATH"
WORKDIR /app
COPY --from=python-build --chown=65532:65532 /venv /venv
COPY --from=python-build --chown=65532:65532 /var/lib/careertwin /var/lib/careertwin
COPY --from=frontend --chown=65532:65532 /src/frontend/dist ./frontend/dist
COPY --chown=65532:65532 extension ./extension
COPY --chown=65532:65532 alembic.ini ./
COPY --chown=65532:65532 alembic ./alembic
USER 65532
EXPOSE 8000
ENTRYPOINT []
CMD ["/venv/bin/uvicorn", "careertwin.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
