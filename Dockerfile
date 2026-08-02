FROM node:24.18-alpine@sha256:f70403e87646dc51b45295f4b8b70cdad0b63d2297c4c9899119b03f7af7a6b3 AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM cgr.dev/chainguard/python:latest-dev@sha256:b6ea84d6ad79b9537046467ef8f507f2787fb9138fdd5e9e3078f0e63fbb502d AS python-build
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

FROM cgr.dev/chainguard/python:latest@sha256:231d4a76e8521327dbb3c23094b2c41151501845d2656da3c1a0610981c496c5 AS runtime
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
