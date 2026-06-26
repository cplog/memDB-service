# Deployment

## Local dev

```bash
cp frontend_platform/.env.local.example frontend_platform/.env.local
# set HINDSIGHT_API_URL, HINDSIGHT_API_KEY, JWT_SECRET
./start-dev.sh
```

| Process | Port | Role |
|---------|------|------|
| backend_platform | 8000 | API (`/api/*`, auth, RBAC) |
| frontend_platform | 3000 | UI; proxies `/api` → backend |
| hindsight (optional `--local`) | 8888 | Local memory engine |

## Local (Docker — Hindsight only)

```bash
cp .env.example .env
docker compose up -d
./start-dev.sh --local
```

Use **8888** for API calls, not the Control Plane UI on 9999.

## Railway (full platform)

Deploy both backend and frontend as separate services in the same Railway project.

### Service 1: API Backend

1. New service from repo; Dockerfile path `backend_platform/Dockerfile` (build context: repo root)
2. Environment:

```
HINDSIGHT_API_URL=https://knowledge.crewio.ai
HINDSIGHT_API_KEY=your-tenant-api-key
JWT_SECRET=strong-random-string
PORT=8000
```

3. Health check: `GET /health`

### Service 2: Portal Frontend

1. New service from repo; Dockerfile path `frontend_platform/Dockerfile` (build context: repo root)
2. Environment:

```
BACKEND_URL=https://your-api-backend.railway.app
HINDSIGHT_UI_URL=https://hindsight-production-baf0.up.railway.app
JWT_SECRET=same-as-backend
PORT=3000
```

3. The frontend rewrites `/api/*` to `BACKEND_URL` internally.

## Railway (Hindsight + Postgres — self-hosted)

1. PostgreSQL: `pgvector/pgvector:pg16` with persistent volume
2. Hindsight: `ghcr.io/vectorize-io/hindsight:latest-slim`
3. Env from `.env.example`; expose **9999** (UI), keep **8888** private/internal
4. `setup/scripts/setup_railway.sh` — verification checklist

## Bank naming

| Pattern | Example |
|---------|---------|
| Team bank | `team-product`, `team-engineering` |

Bootstrap via portal: `PUT /api/banks` `{ "teamId": "product" }` or `examples/ech_cold_start.py`.

## Backup & migration

**Warning:** production DB + RLS may exist — confirm before migrate/restore.

```bash
HINDSIGHT_API_DATABASE_URL=... setup/scripts/backup.sh
setup/scripts/migrate.sh
```
