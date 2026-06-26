# db_mem — Hindsight Consulting Memory Platform

Multi-team memory stack: Hindsight on CrewIO (`knowledge.crewio.ai`), **Next.js portal** on Vercel.

## Quick start

```bash
cp .env.example .env
cp frontend_platform/.env.local.example frontend_platform/.env.local
./start-dev.sh                 # API + portal (auto ports; prefers :8000 / :3000)

# Customer demo (API-only, no Python):
./scripts/seed-customer-demo.sh

# optional local Hindsight stack:
# ./start-dev.sh --local
```

Portal: see startup output (default http://localhost:3000) · API: default http://localhost:8000

If 8000/3000 are busy, `start-dev.sh` picks random free ports in 8100–8999 / 3100–3999 and writes `.uat/dev-ports.json`. Override: `BACKEND_PORT=8123 FRONTEND_PORT=3123 ./start-dev.sh`

## Architecture

```
Browser → Next.js :3000 (/api rewrite) → backend_platform :8000 → knowledge.crewio.ai
```

- **Per-team banks**: `{namespace}-team-{teamId}` (e.g. `co-ech-team-product`)
- **Scenarios**: optional `scenario:{id}` tags within a team bank; retain strategies for extraction profiles
- **Multi-company safety**: per-company namespace env vars (`HINDSIGHT_BANK_NAMESPACE_ECH`); legacy global namespace only for `ech`
- **RBAC**: JWT + `shared/lib/memory-scope.ts`
- **Dashboard UI**: `hindsight-production-baf0.up.railway.app` (Control Plane only)
- **Graph tab**: Wiki (default, linked pages) + Map (relationship inspection); no Three.js

## Docs

| Doc | Purpose |
|-----|---------|
| [MODULE_STRUCTURE](docs/core/MODULE_STRUCTURE.md) | Directory map |
| [USERFLOW](docs/guides/USERFLOW.md) | Login → team → retain/recall |
| [DEPLOYMENT](docs/deployment/DEPLOYMENT.md) | Vercel + Railway |
| [PORTAL_GUIDE](docs/guides/PORTAL_GUIDE.md) | Portal features |
| [RETAIN_QUALITY](docs/guides/RETAIN_QUALITY.md) | Ingestion quality & bank tuning |
| [COLD_START_GUIDE](docs/guides/COLD_START_GUIDE.md) | ECH bootstrap |

## Verify RBAC scope

```bash
cd frontend_platform && npm run check:scope && npm run check:recall && npm run check:okf && npm run check:retain && npm run check:team-banks
```
