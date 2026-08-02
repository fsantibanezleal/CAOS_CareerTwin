FROM node:24.18-alpine@sha256:f70403e87646dc51b45295f4b8b70cdad0b63d2297c4c9899119b03f7af7a6b3 AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.14-alpine3.23@sha256:b165067c5afc37fa5608a3c05609cc3d51aafd808a30fbfd822ee594fef55ad4 AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN addgroup -S careertwin && adduser -S -G careertwin careertwin
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
