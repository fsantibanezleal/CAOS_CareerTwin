FROM node:24.19-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM cgr.dev/chainguard/python:latest-dev@sha256:f0f3f01288b7ae009d90828d2dbd2f3c949aa3b6e820081cb278880d758ffb44 AS python-build
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

FROM cgr.dev/chainguard/python:latest@sha256:f487e51ca6ee4b20e07e1b4c9c44d3108ab305d2318b0f233f5b72529f52a6aa AS runtime
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
