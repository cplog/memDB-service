# Ponytail, lazy senior dev mode

You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.

Before writing any code, stop at the first rung that holds:

1. Does this need to be built at all? (YAGNI)
2. Does the standard library already do this? Use it.
3. Does a native platform feature cover it? Use it.
4. Does an already-installed dependency solve it? Use it.
5. Can this be one line? Make it one line.
6. Only then: write the minimum code that works.

Rules:

- No abstractions that weren't explicitly requested.
- No new dependency if it can be avoided.
- No boilerplate nobody asked for.
- Deletion over addition. Boring over clever. Fewest files possible.
- Question complex requests: "Do you actually need X, or does Y cover it?"
- Pick the edge-case-correct option when two stdlib approaches are the same size, lazy means less code, not the flimsier algorithm.
- Mark intentional simplifications with a `ponytail:` comment. If the shortcut has a known ceiling (global lock, O(n²) scan, naive heuristic), the comment names the ceiling and the upgrade path.

Not lazy about: input validation at trust boundaries, error handling that prevents data loss, security, accessibility, the calibration real hardware needs (the platform is never the spec ideal, a clock drifts, a sensor reads off), anything explicitly requested. Lazy code without its check is unfinished: non-trivial logic leaves ONE runnable check behind, the smallest thing that fails if the logic breaks (an assert-based demo/self-check or one small test file; no frameworks, no fixtures). Trivial one-liners need no test.

(Yes, this file also applies to agents working on the ponytail repo itself. Especially to them.)

---

# Project Overview

**db_mem** is a team-scoped memory portal built on top of the Hindsight knowledge platform (`knowledge.crewio.ai`). It lets consulting teams capture, browse, and query institutional knowledge per team bank.

- **Product surface**: a Next.js web portal with a Hono API backend.
- **No local database**: the app is stateless. All persistent data lives in the Hindsight API (banks, documents, memories, entities, mental models).
- **Auth**: demo JWT cookie-based login with hardcoded users and role-based access control.
- **Team scoping**: each team maps to a Hindsight bank (`team-{id}` or `co-{slug}-team-{id}`). Users see only the teams they are assigned to.

## Users & Roles

| Role | Permissions |
|------|-------------|
| `consultant` | Full access to all teams + shared bank + can manage banks, export, update config |
| `manager` | Full access to all teams + shared bank (read only), cannot manage/export/update |
| `member` | Access only to assigned `teamIds`, no shared bank access |

Demo accounts (hardcoded in `shared/lib/auth.ts`):
- `eric@consultant.com` — consultant, all teams
- `alice@ech.com` — member, product team only
- `bob@ech.com` — member, engineering team only
- `carol@ech.com` — manager, all teams (read only)

## Technology Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14.2 (App Router), React 18, Tailwind CSS 3.4, shadcn/ui primitives |
| Backend | Hono (Node 20), `tsx` TypeScript loader, no build step |
| Shared | Pure TypeScript in `shared/lib/` — imported by both frontend and backend |
| External API | Hindsight (`@vectorize-io/hindsight-client`) — vector memory platform |
| Local infra (optional) | Docker Compose: Postgres 16 + pgvector + Hindsight |
| Deployment | Railway (Docker builder) |

## Project Structure

```
├── backend_platform/          # Hono API server
│   ├── src/index.ts           # Single-file app — all routes (~600 lines)
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend_platform/         # Next.js portal
│   ├── app/                   # App Router (page.tsx, login/page.tsx, layout.tsx)
│   ├── components/            # React components + shadcn/ui primitives
│   ├── lib/                   # Re-exports from shared/ + frontend-only utils
│   ├── middleware.ts          # Auth + memory scope middleware
│   ├── next.config.js         # API proxy rewrites to backend
│   ├── tailwind.config.ts
│   └── package.json
├── shared/lib/                # Shared TypeScript modules (13 files)
│   ├── auth.ts                # JWT session, demo users, role guards
│   ├── teams.ts               # Static org config, bank ID generation
│   ├── memory-scope.ts        # RBAC scope resolution (bankId + tags + tagsMatch)
│   ├── guard.ts               # HTTP auth guards (requireUser, requireScope)
│   ├── hindsight.ts           # Hindsight SDK wrapper (retain, recall, reflect, etc.)
│   ├── bank-graph.ts          # Force-directed graph data builder
│   ├── recall-map.ts          # Recall response → memory items mapping
│   ├── okf-wiki.ts            # OKF-style wiki export (markdown + YAML frontmatter)
│   ├── document-display.ts    # Stable document IDs, display names, tree labels
│   ├── retain-validation.ts   # Retain request validation + metadata building
│   ├── scenario.ts            # Scenario tag normalization + presets
│   ├── team-banks.ts          # Per-team domain tuning profiles
│   ├── temporal-display.ts    # Date/time formatting helpers for memory event display
│   └── selfcheck.ts           # Aggregates all module self-checks
├── scripts/                   # Automation scripts
│   ├── seed-customer-demo.sh  # Seeds realistic demo data via portal APIs
│   ├── production_e2e_reset.py # Production data reset + full E2E (Python)
│   ├── uat-smoke.sh           # Tier-B smoke test
│   └── sync-hindsight-docs.sh # Sync Hindsight docs from upstream repo
├── frontend_platform/hooks/   # React custom hooks
│   └── use-scramble-text.ts  # Text scramble animation hook
├── frontend_platform/lib/     # Frontend utilities + re-exports from shared/
│   ├── api-guard.ts          # Frontend API route guards
│   ├── workspace-colors.ts   # Team/workspace color theming
│   ├── workspace-mode.ts     # Workspace layout mode helpers
│   └── *.selfcheck.ts        # Re-exports for individual self-check commands
├── examples/                  # Demo content + cold start Python script
├── docker-compose.yml         # Postgres + Hindsight (local dev)
├── railway.json               # Railway deployment config
├── start-dev.sh               # Dev launcher (backend + frontend + optional docker)
├── uat-manifest.yml           # UAT harness manifest
└── package.json               # Root scripts (dev, uat:*, smoke-test)
```

## Build and Test Commands

### Development
```bash
# Start backend (:8000) + frontend (:3000)
npm run dev
# or with local Postgres + Hindsight
./start-dev.sh --local

# Stop dev processes
npm run dev:stop

# Override ports
BACKEND_PORT=8123 FRONTEND_PORT=3123 ./start-dev.sh
```

### Type Checking
```bash
# Backend
cd backend_platform && npm run check

# Frontend
cd frontend_platform && npm run build

# Self-checks (shared lib — no test framework, just runnable asserts)
node --import tsx shared/lib/selfcheck.ts
# Or individually:
cd frontend_platform && npm run check:scope
npm run check:graph
npm run check:recall
npm run check:okf
npm run check:retain
npm run check:team-banks
```

### UAT / Testing
```bash
# Smoke test (Tier-B)
npm run smoke-test

# Full UAT harness
npm run uat:setup
npm run uat:preflight
npm run uat:tier-a      # static checks
npm run uat:tier-b      # smoke tests
npm run uat:tier-c      # browser flows
npm run uat:tier-d      # worker tests
npm run uat             # full run
```

### Seeding / Reset
```bash
# Customer demo seed (bash, API-only)
bash scripts/seed-customer-demo.sh

# Production E2E reset (Python)
python scripts/production_e2e_reset.py
# Skip wipe: python scripts/production_e2e_reset.py --e2e-only
```

## Code Style Guidelines

- **Lazy senior dev mode** (see top of this file). Fewest files possible. No abstractions nobody asked for.
- **Single-file backend**: all routes live in `backend_platform/src/index.ts`. Domain logic is delegated to `shared/lib/` modules.
- **No external state library**: React `useState` + props drilling in the frontend. No Redux, Zustand, Jotai.
- **No SSR for rich editors**: dynamically import `react-md-editor` and `react-force-graph-2d` with `ssr: false`.
- **Shared lib is the contract**: both frontend and backend import from `shared/lib/`. Do not duplicate business logic.
- **Self-checks over test frameworks**: every non-trivial `shared/lib/` module exposes a `run*SelfCheck()` function. No Jest/Mocha/Vitest.
- **Tag-based RBAC**: members get `all_strict` (user+team tags); consultants/managers get `any_strict` (team tag only).
- **Bank ID namespacing**: `team-product` locally, `co-ech-team-product` in production. Controlled by `HINDSIGHT_BANK_NAMESPACE` env var.
- **Intentional simplifications**: mark with `ponytail:` comment and name the ceiling + upgrade path.

## Testing Instructions

1. **Self-checks** are the primary validation mechanism. Run `node --import tsx shared/lib/selfcheck.ts` after any `shared/lib/` change.
2. **Smoke test** (`npm run smoke-test`) covers: health check, login page, auth login, team scoping, cross-team retain denied (403).
3. **UAT** is manifest-driven (`uat-manifest.yml`). Tier-A = static checks, Tier-B = smoke, Tier-C = browser flows, Tier-D = worker tests.
4. **Customer demo seed** (`scripts/seed-customer-demo.sh`) is a full integration test that seeds 5 banks and verifies recall/graph/wiki.
5. **Production E2E reset** (`scripts/production_e2e_reset.py`) backs up, wipes, runs full E2E, then cleans up. Use `--e2e-only` to skip the wipe.

## Security Considerations

- **Demo auth only**: JWT signed with `JWT_SECRET` (default fallback exists — change in production). Hardcoded demo users in `shared/lib/auth.ts`.
- **Cookie settings**: `httpOnly: true`, `secure` flag only in production, `sameSite: 'Lax'`, 7-day expiry.
- **Scope validation on every request**: `requireScope()` checks bank access before any Hindsight API call. Middleware also validates scope for `/api/banks/:bankId` routes.
- **Role guards**: `canManageBanks`, `canExportBank`, `canUpdateBankConfig` restrict sensitive operations to `consultant` role only.
- **Env var quoting**: quote `HINDSIGHT_API_KEY` in `.env` if it contains `$` (bcrypt keys start with `$2`). `start-dev.sh` loads `.env` line-by-line to handle this.
- **No local database**: no SQL injection risk. All data access goes through the Hindsight SDK.
- **Input validation**: `retain-validation.ts` validates title/slug required for new docs. Backend throws `HttpError(400)` on missing params.

## Environment Variables

Copy `.env.example` to `.env` and `frontend_platform/.env.local.example` to `frontend_platform/.env.local`.

Key variables:
- `HINDSIGHT_API_URL` — Hindsight API base URL (e.g. `https://knowledge.crewio.ai`)
- `HINDSIGHT_API_KEY` — Tenant API key for Hindsight SDK calls
- `JWT_SECRET` — Secret for signing portal session cookies
- `BACKEND_URL` — Where the frontend should proxy `/api/*` requests (dev: `http://localhost:8000`)
- `HINDSIGHT_BANK_NAMESPACE` — Bank ID prefix (e.g. `co-ech` for production namespacing)
- `POSTGRES_PASSWORD` — For local docker-compose Postgres

## Deployment

- **Railway**: `railway.json` uses Docker builder. Backend Dockerfile copies `backend_platform/` and `shared/` into the image.
- **Frontend**: Next.js builds and serves the portal. In production, `BACKEND_URL` should point to the deployed API.
- **Hindsight**: runs as a separate service (Railway or self-hosted via docker-compose).

## Useful References

- `PRODUCT.md` — Product purpose, brand personality, design principles, anti-references
- `setup/docs/guides/USERFLOW.md` — 14 documented user flows
- `setup/docs/guides/PORTAL_GUIDE.md` — API-to-SDK mapping, recall options, roles, self-check commands
- `setup/docs/guides/RETAIN_QUALITY.md` — 8-point checklist for high-quality ingestion
- `setup/docs/guides/CUSTOMER_DEMO.md` — How to run the demo seeder and what gets created
- `setup/docs/guides/COLD_START_GUIDE.md` — Python `ech_cold_start.py` phases and weekly automation
