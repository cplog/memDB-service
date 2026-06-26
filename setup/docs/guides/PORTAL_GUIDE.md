# Portal Guide

Next.js portal at `frontend_platform/` — team-scoped Hindsight UI using `@vectorize-io/hindsight-client`.

## Setup

```bash
cd frontend_platform
cp .env.local.example .env.local
npm install
npm run dev
```

`.env.local`:

```
HINDSIGHT_API_URL=https://knowledge.crewio.ai
HINDSIGHT_UI_URL=https://hindsight-production-baf0.up.railway.app
HINDSIGHT_API_KEY=your-tenant-api-key
JWT_SECRET=strong-random-string
```

## Team model

- One Hindsight bank per team: `{namespace}-team-{teamId}` (production: `co-ech-team-product`)
- Optional shared bank: `co-ech-shared` (consultant/manager only)
- Override namespace: `HINDSIGHT_BANK_NAMESPACE=co-ech` in `.env`
- Sidebar lists teams the user can access; bank id matches Control Plane dropdown

## Features

Markdown rendering via `@uiw/react-md-editor` preview only (Sources reader — users never edit markdown). Add note uses plain textarea.

| Panel | Route | SDK method |
|-------|-------|------------|
| Sources | GET/DELETE `/api/documents`, `/api/documents/:id` | `listDocuments` / `getDocument` / `deleteDocument` |
| Sources filters | GET `/api/documents?q=&tags=` | `listDocuments` query params |
| Sources tags | PATCH `/api/documents/:id` `{ tags }` | `updateDocument` (consultant) |
| Sources replace | POST `/api/upload` + `documentId` | `retainFiles` upsert on same id |
| Sources edit | PUT `/api/documents/:id` + `{ content }` | `retain` upsert (`updateMode: replace`) |
| Knowledge | GET `/api/memories` | `listMemories` |
| Entity detail | GET `/api/entities/:id` | `getEntity` + recall with chunks |
| Add note | POST `/api/retain` | `retain` + tags; append mode for attach |
| Query recall | POST `/api/recall` | `recall` + `include.chunks/entities/source_facts` |
| Query reflect | POST `/api/reflect` | `reflect` + `include.facts` → `based_on` |
| Graph Wiki | GET `/api/banks/:id/wiki` | Live OKF bundle (sources + entities + index) |
| Graph Map | GET `/api/banks/:id/graph` | `getGraph` (native) + legacy fallback |
| Upload | POST `/api/upload` | `retainFiles` (optional `documentId`) |
| Stats | POST `/api/stats` | `getAgentStats` |
| Config | POST `/api/config` | `getBankConfig` / `updateBankConfig` |
| Export JSON | POST `/api/export` | `exportDocuments` |
| Export wiki | POST `/api/export-wiki` | documents + memories + entities → OKF bundle |

## Recall include options (portal defaults)

Portal recall enables by default:

| Include | Purpose |
|---------|---------|
| `chunks` | Surrounding source text per fact (`chunk_id` cross-ref) |
| `entities` | Entity names on each result |
| `source_facts` | Evidence facts for observation-type results |

Mapped in `shared/lib/recall-map.ts` → `RecallMemoryItem` for UI provenance.

## Documents as wiki foundation

- Stable identity: `document_id` survives re-retain (replace/append upsert)
- OKF export: `shared/lib/okf-wiki.ts` emits `sources/*.md` with frontmatter + `original_text`
- **Graph → Wiki**: live browse via GET `/api/banks/:id/wiki` (human titles, clickable `[[links]]`)
- **Graph → Map**: force graph for relationship inspection (not the default sales view)
- Entity pages link back via `[[sources/...]]` style paths; portal uses drawer + open-source links

## Roles

| Role | Teams | Config / export / doc tags |
|------|-------|----------------------------|
| consultant | all | yes |
| manager | all | no |
| member | assigned | no |

## Self-checks

```bash
cd frontend_platform
npm run check:scope
npm run check:graph
npm run check:recall
npm run check:okf
```

## Hindsight agent docs

Agent skill: `.agents/skills/hindsight-docs/` (synced from [vectorize-io/hindsight](https://github.com/vectorize-io/hindsight)).

```bash
./scripts/sync-hindsight-docs.sh   # refresh from upstream + cookbook
```

Start at `references/TOPIC-INDEX.md` for knowledge graph, raw chunks, bank config, and file upload.

## Provenance notes

- Chunks are read-only context; editing source text uses document replace retain
- Tag updates on documents re-consolidate observations (Hindsight side-effect)
- OKF export is augment-readonly — no in-portal wiki editing layer

## Ingestion quality

See [RETAIN_QUALITY.md](./RETAIN_QUALITY.md). Implemented: stable note ids, per-team missions, retain context fields, source timestamps, processing hint, entity_labels bootstrap, observation scope defaults on retain.

```bash
npm run check:retain
npm run check:team-banks
```
