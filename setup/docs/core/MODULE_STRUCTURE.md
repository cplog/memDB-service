# Module Structure

## Directory map

```
db_mem/
├── backend_platform/           # Hono API server (Railway / Docker)
│   └── src/index.ts            # All /api/* routes
├── frontend_platform/          # Next.js portal UI (Vercel)
│   ├── components/             # Obsidian-like UI panels
│   │   ├── entity-detail.tsx   # Entity drawer (facts, chunks, sources)
│   │   └── wiki-viewer.tsx     # Read-only OKF export preview
│   └── lib/                    # Re-exports from shared/ + self-checks
├── shared/lib/                 # Auth, RBAC, Hindsight client (used by both)
│   ├── auth.ts
│   ├── teams.ts
│   ├── memory-scope.ts
│   ├── guard.ts
│   ├── hindsight.ts            # SDK wrappers (recall, documents, entities)
│   ├── recall-map.ts           # Recall → UI items with chunk provenance
│   ├── okf-wiki.ts             # OKF Markdown bundle generator
│   ├── retain-validation.ts    # Retain options + document_id (Phase 4: stable slugs)
│   └── team-banks.ts           # Bank bootstrap missions (Phase 4: per-team missions)
├── examples/                   # ech_cold_start.py, weekly template
├── setup/                      # Docs + scripts
├── start-dev.sh                # Backend :8000 + portal :3000
└── docker-compose.yml          # Optional local Postgres + Hindsight
```

## Data flow

```
Browser → Next.js :3000 (/api/* rewrite) → backend_platform :8000
        → requireScope(user, bankId) → HindsightClient → knowledge.crewio.ai
```

## Bank naming

| Pattern | Example |
|---------|---------|
| Team bank | `team-product`, `team-engineering` |

## External services

| Service | URL |
|---------|-----|
| Hindsight API | `https://knowledge.crewio.ai` |
| Control Plane UI | `https://hindsight-production-baf0.up.railway.app` |
