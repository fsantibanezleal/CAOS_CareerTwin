FROM node:24.18-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN addgroup --system careertwin && adduser --system --ingroup careertwin careertwin
WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY pyproject.toml README.md ./
COPY backend ./backend
RUN pip install --no-deps .
COPY --from=frontend /src/frontend/dist ./frontend/dist
COPY alembic.ini ./
COPY alembic ./alembic
RUN mkdir -p /var/lib/careertwin/blobs && chown -R careertwin:careertwin /app /var/lib/careertwin
USER careertwin
EXPOSE 8000
CMD ["uvicorn", "careertwin.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
