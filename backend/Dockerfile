# ─────────────────────────────────────────────────────────────
# Backend — FastAPI + Celery
# Multi-stage: development (hot-reload) | production
# ─────────────────────────────────────────────────────────────

# ── Base ──────────────────────────────────────
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps: libpq for asyncpg native driver, gcc for compiled wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Dependencies ──────────────────────────────
FROM base AS deps

COPY requirements.txt ./
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# ── Development ───────────────────────────────
FROM deps AS development

COPY requirements-dev.txt* ./
RUN test -f requirements-dev.txt && pip install -r requirements-dev.txt || true

# Copy source code for development
COPY . .

CMD ["python", "-m", "uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000"]

# ── Production builder ────────────────────────
FROM deps AS production-builder

COPY . .

# ── Production runtime ────────────────────────
FROM base AS production

# Only copy installed packages + source, no dev tools
COPY --from=production-builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=production-builder /usr/local/bin /usr/local/bin
COPY --from=production-builder /app /app

# Non-root user for security
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4"]
