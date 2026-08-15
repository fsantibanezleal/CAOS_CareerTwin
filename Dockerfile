FROM node:24.18-alpine@sha256:f70403e87646dc51b45295f4b8b70cdad0b63d2297c4c9899119b03f7af7a6b3 AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM cgr.dev/chainguard/python:latest-dev@sha256:21b83f9766bdc6a8d2180f4950c00079eac274944109a95d858bcb989525d2b6 AS python-build
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

FROM cgr.dev/chainguard/python:latest@sha256:605be9a2e22b32c98b94c2a1bcbd27f9e35a2616282abca488d2eb035e97b660 AS runtime
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
