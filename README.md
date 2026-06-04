<div align="center">
  <h1>Daggle</h1>
  <p><b>The Dataset Layer for Machine Learning Workflows</b></p>
  <p><i>GitHub for ML datasets &nbsp;&nbsp;+&nbsp;&nbsp; Kaggle dataset UX &nbsp;&nbsp;+&nbsp;&nbsp; Notebook-ready sync</i></p>
</div>

---

## 📖 The Story: Why Daggle?

Managing datasets for Machine Learning is often chaotic. Data scientists frequently deal with duplicated data, lost versions, and messy folder structures (e.g., `data_v2_final_final.csv`). Sharing these datasets across teams or syncing them into Kubeflow clusters is full of friction, often requiring manual downloads, custom scripts, and a lot of wasted time.

We built **Daggle** to bring order to this chaos. Daggle provides a seamless platform that gives your team the rigorous version control of GitHub, combined with the intuitive dataset exploration of Kaggle. Instead of wrestling with infrastructure or fighting duplicate data files, your team can focus on what matters most: building better models with reliable, reproducible data.

## 🚀 Advanced Features & Strategy

Daggle is built to work seamlessly in the background. Our architecture ensures that from the moment a dataset is uploaded to the moment it's queried in a Jupyter Notebook, the experience is fast, reliable, and frictionless.

*   **Content-Addressable Storage (CAS)**: Under the hood, Daggle employs a robust CAS strategy for dataset versioning. This ensures absolute reproducibility for your ML pipelines without wasting disk space on duplicated files. Every version is tracked, immutable, and deduplicated efficiently.
*   **S3-Compatible Core (RustFS)**: We use RustFS as our native object storage, meaning Daggle is fully S3-compatible from day one. Data scientists don't need to learn a new API; they can connect to their datasets directly from Jupyter Notebooks using standard tools like `boto3` or AWS CLI.
*   **Automated Data Processing**: Upload a massive ZIP file, and our asynchronous Celery workers automatically extract it, compute file statistics, and generate rich data previews. The heavy lifting happens invisibly, leaving the UI lightning-fast and the dataset instantly ready-to-use.
*   **Rich Metadata & Tagging System**: Organize your data ecosystem effortlessly. Add rich metadata and tags to make datasets easily discoverable across your entire organization.
*   **Zero-Friction Authentication (OIDC)**: Built on an OIDC backend-proxy pattern with Keycloak. Tokens are handled securely server-side, providing seamless Single Sign-On (SSO) that integrates effortlessly with your existing Kubeflow deployments or enterprise identity providers.

---

## 🛠️ Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React + TypeScript + Vite | 18 / 5 |
| Routing | React Router | v6 |
| Data fetching | SWR | v2 |
| Backend | FastAPI (async) | 0.104+ |
| Auth | Keycloak OIDC (backend-proxy) | 26.1 |
| Task queue | Celery + Flower | 5.3+ |
| Metadata DB | PostgreSQL (alpine) | 17 |
| Cache / broker | Redis (alpine) | 8 |
| Object storage | RustFS (S3-compatible) | latest |
| Reverse proxy | Traefik | v3.3 |

---

## ⚡ Quick Start

```bash
# 1. Clone
git clone <repo> daggle && cd daggle

# 2. Copy env and fill in secrets
cp .env.example .env

# 3. Start all services
cd infra
docker compose --env-file ../.env up -d

# 4. Start frontend (new terminal, from repo root)
cd frontend && npm install && npm run dev
```

> **Why `--env-file ../.env`?**
> Docker Compose looks for `.env` in the compose file's directory (`infra/`).
> Your `.env` lives in the repo root, one level up, so you must point to it explicitly.

### Dev URLs

| Service | URL |
|---|---|
| Frontend (local dev) | http://localhost:5173 |
| Backend API | http://api.localhost |
| API Docs (Swagger) | http://api.localhost/docs |
| Keycloak Admin | http://auth.localhost |
| RustFS Console | http://storage-console.localhost |
| Flower (Celery monitor) | http://flower.localhost |
| Traefik Dashboard | http://traefik.localhost:8080 |
| pgAdmin *(devtools profile)* | http://pgadmin.localhost |
| Redis Commander *(devtools profile)* | http://redis.localhost |

> **Windows/Linux**: Add to `hosts` file → `127.0.0.1 api.localhost auth.localhost storage.localhost storage-console.localhost flower.localhost traefik.localhost pgadmin.localhost redis.localhost`

```bash
# With devtools (pgAdmin + Redis Commander)
cd infra
docker compose --env-file ../.env --profile devtools up -d
```

---

## 📁 Directory Structure

```
daggle/
├── .env                          ← local secrets (gitignored)
├── .env.example                  ← committed template
├── README.md
│
├── backend/
│   ├── Dockerfile                ← dev (uvicorn --reload) | production
│   ├── requirements.txt
│   └── app/
│       ├── main.py               ← FastAPI app factory + SessionMiddleware
│       ├── api/
│       │   ├── deps.py           ← CurrentUser, DbSession, require_role()
│       │   ├── auth.py           ← /auth/login → /auth/callback → /auth/me
│       │   └── datasets.py
│       ├── core/
│       │   ├── config.py         ← pydantic-settings (all env vars)
│       │   ├── database.py       ← SQLAlchemy engine + get_db()
│       │   └── security.py       ← OIDC JWT validation via Keycloak JWKS
│       ├── models/               ← SQLAlchemy ORM models
│       ├── repositories/         ← DB access layer (one repo per aggregate)
│       ├── services/             ← business logic
│       ├── workers/
│       │   ├── celery_app.py     ← Celery factory
│       │   └── tasks/            ← ingestion, processing, sync
│       └── integrations/
│           ├── storage/          ← RustFS / S3 boto3 wrapper
│           └── keycloak/         ← Keycloak Admin REST client
│
├── frontend/
│   ├── Dockerfile
│   └── src/
│       ├── app/                  ← router, providers
│       ├── features/
│       │   ├── auth/             ← AuthContext, authService, ProtectedRoute
│       │   ├── datasets/         ← dataset list, detail, upload
│       │   └── versions/
│       ├── components/           ← ui/, layout/, feedback/
│       ├── pages/                ← thin page components
│       ├── services/
│       │   └── apiClient.ts      ← axios + session cookie + 401 redirect
│       └── types/                ← models.ts, api.ts
│
├── infra/
│   ├── docker-compose.yml        ← single file, all services
│   └── postgres/
│       └── init/
│           └── 01_create_keycloak_db.sql
```

---

## 🔐 Auth — Keycloak OIDC (Backend-Proxy Pattern)

Authentication uses **Keycloak 26.1** with an OIDC **backend-proxy** pattern:
the frontend never sees tokens — all exchange happens on the FastAPI server.

```
Browser ──► GET /api/auth/login ──► FastAPI ──► redirect to Keycloak
Browser ──► (user logs in on Keycloak)
Browser ──► GET /api/auth/callback ──► FastAPI exchanges code → stores token in HttpOnly cookie
Browser ──► GET /api/auth/me ──► FastAPI reads cookie, validates JWT via Keycloak JWKS → returns user
```

**Why backend-proxy:**
- `client_secret` stays server-side only
- Tokens never exposed to browser JS (XSS-safe)
- Works natively with Kubeflow federation (same Keycloak realm)

### First-time Keycloak Setup

After `docker compose up -d`:

1. Open http://auth.localhost → log in with `admin / admin` (change in `.env`)
2. Create realm: **`daggle`**
3. Create client: **`daggle-backend`** → type `confidential`, add redirect URI `http://api.localhost/auth/callback`
4. Copy the client secret → add to `.env` as `KEYCLOAK_CLIENT_SECRET`
5. Restart backend: `docker compose restart backend`

### Kubeflow Integration

When connecting to a Kubeflow that already has its own Keycloak — **don't run two Keycloaks**.
Instead, update two env vars in `.env` and zero code changes are needed:

```env
# Point at Kubeflow's existing Keycloak
KEYCLOAK_URL=https://auth.your-kubeflow.example.com
KEYCLOAK_REALM=kubeflow   # or whichever realm Kubeflow uses
# Then register daggle-backend as a new client in that realm
```

If both deployments are on separate clusters, use Keycloak **Identity Brokering**
(built-in: one Keycloak trusts the other as an external OIDC IdP — configured in the admin console).

---

## 🏗️ Infrastructure

### Image Versions

| Service | Image | Variant | Reason |
|---|---|---|---|
| Traefik | `traefik:v3.3` | standard | No alpine variant; official image is already minimal |
| Keycloak | `quay.io/keycloak/keycloak:26.1` | UBI (standard) | No alpine variant; UBI-based, minimal by default |
| PostgreSQL | `postgres:17-alpine` | **alpine** ✅ | Pure C, no glibc deps — alpine saves ~100 MB |
| Redis | `redis:8-alpine` | **alpine** ✅ | Pure C, no glibc deps — alpine is ideal |
| Backend/Worker | `python:3.12-slim` | **slim, NOT alpine** ⚠️ | `pandas` + `Pillow` need glibc; alpine/musl breaks them |
| RustFS | `rustfs/rustfs:latest` | standard | No versioned tags published yet |
| mc (init) | `amazon/aws-cli:2.22.0` | pinned | Apache 2.0 — S3-compatible, no MinIO dependency |
| pgAdmin | `dpage/pgadmin4:8` | standard | Major-pinned — gets patches, blocks major upgrades |
| Redis Commander | `rediscommander/redis-commander:0.8.0` | standard | Fully pinned |

> **Alpine rule of thumb**: use alpine for infrastructure services (DB, cache, proxy). Use `slim` for Python — alpine's `musl libc` breaks binary wheels (numpy, pandas, Pillow).

### Environment Variables

All variables live in `.env` (gitignored). Copy `.env.example` to start.

| Variable | Used by | Description |
|---|---|---|
| `APP_ENV` | backend, worker | `development` \| `staging` \| `production` |
| `DEBUG` | backend | FastAPI debug mode |
| `LOG_LEVEL` | backend, worker | `debug` \| `info` \| `warning` \| `error` |
| `POSTGRES_USER` | postgres, backend, keycloak | DB username |
| `POSTGRES_PASSWORD` | postgres, backend, keycloak | DB password |
| `POSTGRES_DB` | postgres, backend | Main database name (`keycloak` DB is auto-created) |
| `RUSTFS_ACCESS_KEY` | rustfs, backend, worker, mc-init | S3 access key |
| `RUSTFS_SECRET_KEY` | rustfs, backend, worker, mc-init | S3 secret key |
| `SESSION_SECRET_KEY` | backend | Signs the HttpOnly OIDC session cookie. Min 32 chars. |
| `CORS_ORIGINS` | backend | Comma-separated allowed frontend origins |
| `KEYCLOAK_ADMIN` | keycloak | Admin console username |
| `KEYCLOAK_ADMIN_PASSWORD` | keycloak | Admin console password |
| `KEYCLOAK_URL` | backend | Keycloak base URL. Change for Kubeflow integration. |
| `KEYCLOAK_REALM` | backend | Realm name. Change for Kubeflow integration. |
| `KEYCLOAK_CLIENT_ID` | backend | OIDC client ID |
| `KEYCLOAK_CLIENT_SECRET` | backend | OIDC client secret (from Keycloak admin console) |
| `PGADMIN_EMAIL` | pgadmin *(devtools)* | pgAdmin login email |
| `PGADMIN_PASSWORD` | pgadmin *(devtools)* | pgAdmin login password |

> **Never in `.env`** (always internal docker-network URLs, set in compose directly):
> `DATABASE_URL`, `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `RUSTFS_ENDPOINT`

---

## 📦 Object Storage (RustFS)

RustFS exposes an S3-compatible API at `http://rustfs:9000` (internal) / `http://storage.localhost` (external).

Pre-created buckets (via `rustfs-init` one-shot container):

| Bucket | Purpose |
|---|---|
| `datasets` | Versioned dataset files (CSV, Parquet, ZIP, etc.) |
| `uploads-staging` | Temporary landing zone for user uploads |
| `exports` | Generated exports / snapshots |

The backend uses `boto3` / `aiobotocore` pointed at `RUSTFS_ENDPOINT`.
The same code works with AWS S3 or any S3-compatible store — just swap endpoint + credentials.

---

## ⚙️ Celery Workers

Three task queues handled by Celery workers:

| Queue | Tasks |
|---|---|
| `ingestion` | Receive upload, move from staging → datasets bucket |
| `processing` | Extract ZIPs, generate previews, compute file stats |
| `sync` | Sync dataset metadata, PVC layout sync (future Kubeflow) |

Monitor tasks at http://flower.localhost.

---

## 🎯 MVP Scope

**Included:**
- ✅ Dataset upload (ZIP, CSV, Parquet)
- ✅ Dataset versioning (`v1`, `v2`, ...)
- ✅ Metadata + tags
- ✅ ZIP auto-extraction
- ✅ Dataset preview
- ✅ Keycloak OIDC auth

**Not in MVP:**
- ❌ Notebook runtime
- ❌ Kubeflow replacement
- ❌ AutoML / pipelines
- ❌ Distributed training

---

## 💻 Common Commands

> All commands run from the **`infra/`** directory.

```bash
cd infra

# Start all services
docker compose --env-file ../.env up -d

# With devtools (pgAdmin + Redis Commander)
docker compose --env-file ../.env --profile devtools up -d

# View logs
docker compose --env-file ../.env logs -f backend
docker compose --env-file ../.env logs -f keycloak

# Restart one service
docker compose --env-file ../.env restart backend

# Pull updated images
docker compose --env-file ../.env pull

# Stop (keep volumes)
docker compose --env-file ../.env down

# Wipe all data -- DELETES database and storage volumes
docker compose --env-file ../.env down -v
```

```bash
# Frontend development (from repo root)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

```bash
# Generate a secure SESSION_SECRET_KEY
python -c "import secrets; print(secrets.token_hex(32))"
```
