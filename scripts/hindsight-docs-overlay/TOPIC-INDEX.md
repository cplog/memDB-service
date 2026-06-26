# Hindsight Topic Index — Knowledge, Raw Content & Configuration

Curated map for **db_mem** portal work. Read this before diving into individual API pages.

Source: [vectorize-io/hindsight](https://github.com/vectorize-io/hindsight) — sync via `./scripts/sync-hindsight-docs.sh`.

---

## Data model (what gets stored)

| Layer | What it is | Doc |
|-------|------------|-----|
| **Bank** | Isolated memory container (our `team-{id}`) | [memory-banks.md](./developer/api/memory-banks.md) |
| **Document** | Source container (file, session, upload) — traceability | [documents.md](./developer/api/documents.md) |
| **Chunk** | Raw text segment before fact extraction | [documents.md#chunks](./developer/api/documents.md) |
| **Memory unit** | Atomic extracted fact (`world`, `experience`, `observation`) | [memories.md](./developer/api/memories.md) |
| **Entity** | Person/org/concept — links memories in graph | [memory-banks.md#entity-labels](./developer/api/memory-banks.md) |
| **Observation** | Consolidated pattern from multiple facts | [observations.md](./developer/observations.md) |
| **Mental model** | Long-horizon synthesized knowledge | [mental-models.md](./developer/api/mental-models.md) |
| **Async operation** | Background retain/file_convert/graph_maintenance | [operations.md](./developer/api/operations.md) |

---

## Raw content & traceability

**Upload / file retain** (`retainFiles`, markitdown/iris parsers):

- [retain.md](./developer/api/retain.md) — `POST …/file-retain`, parsers, async response
- [documents.md](./developer/api/documents.md) — `document_id`, list/get/delete documents
- **Portal:** upload must call `createBank` first (FK on `banks` table)

**Getting raw text back:**

| Need | API flag / endpoint |
|------|---------------------|
| Original file text segments | Recall `include.chunks` → response `chunks` dict | [recall.md#include-chunks](./developer/api/recall.md) |
| Full document body | `GET …/documents/{document_id}` | [documents.md](./developer/api/documents.md) |
| Source facts for observations | Recall `include.source_facts` | [recall.md](./developer/api/recall.md) |
| Entity names on facts | Recall `include.entities` (default on) | [recall.md](./developer/api/recall.md) |

**Chunks vs memories:** Facts are extracted from chunks; recall returns facts by default. Enable chunks when the agent needs surrounding original wording.

---

## Knowledge graph

| Topic | Doc |
|-------|-----|
| Graph built at retain time | [retain.md](./developer/retain.md) (architecture) |
| Graph traversal in recall | [retrieval.md](./developer/retrieval.md) |
| Entity co-occurrence / links | [memory-banks.md](./developer/api/memory-banks.md) |
| Graph maintenance after edits | [operations.md#graph_maintenance](./developer/api/operations.md) |
| Bank stats (`total_nodes`, `total_links`, `pending_operations`) | OpenAPI `getAgentStats` — [openapi.json](./openapi.json) |

**Portal graph view:** native `getGraph` via `/api/banks/:id/graph` (Cytoscape unwrapping in `shared/lib/bank-graph.ts`); legacy fallback from `listMemories` + entity strings.

**Portal entity / wiki layer (Documents + Chunks):**

| Need | Portal surface |
|------|----------------|
| Chunk context on recall | Query → Show context; `recallForScope` with `includeChunks` |
| Document filters | Sources list `q` + `tags` |
| Document tags | Sources detail PATCH (consultant) |
| Entity provenance | Entity drawer: recall + sources grouped by `document_id` |
| OKF source pages | Export wiki → `sources/<document_id>.md` |
| Continue conversation | Sources **Continue this source** → append retain |
| Attach note/upload | Add note / Upload **Attach to existing** |

Implementation: `shared/lib/recall-map.ts`, `shared/lib/okf-wiki.ts`, `frontend_platform/components/entity-detail.tsx`.

---

## Bank configuration (per-team tuning)

Configure via **Control Plane UI**, **bank config API**, or **createBank** options:

| Setting | Purpose |
|---------|---------|
| `retain_mission` | Steer what facts get extracted |
| `retain_extraction_mode` | `concise` / `verbose` / `custom` |
| `retain_chunk_size` | Max chars per extraction chunk (default 3000) |
| `entity_labels` | Controlled vocabulary → graph links + tag filters |
| `reflect_mission` | Identity/context for reflect |
| `dispositionSkepticism/Literalism/Empathy` | 1–5 traits for reflect |
| `observations_mission` | When/how to synthesize observations |
| `enableObservations` | Toggle observation consolidation |
| `thinking_budget` | Maps recall `budget` low/mid/high |

Full reference: [memory-banks.md#bank-configuration](./developer/api/memory-banks.md)  
Server-wide env vars: [configuration.md](./developer/configuration.md) (2000+ lines — DB, LLM, retain, recall, workers)

---

## Operations portal should surface

| Signal | Field / endpoint |
|--------|------------------|
| Indexing in progress | `pending_operations` in stats; poll [operations.md](./developer/api/operations.md) |
| Upload queued | `operation_ids` from file retain |
| Empty recall after retain | Async — wait for `completed` operations |
| Bank missing on upload | Create bank before async op (FK error) |

---

## db_mem mapping

| Portal feature | Hindsight API |
|----------------|---------------|
| Team bank | `team-{teamId}` via `createBank` |
| Text retain | `retain` + tags/metadata |
| File upload | `retainFiles` (markitdown/iris) |
| Attach / continue source | `retain` / `retainFiles` with same `document_id` |
| Search / recall | `recall` with tag scope + `include.chunks/entities/source_facts` |
| Reflect panel | `reflect` + `include.facts` |
| Stats panel | `getAgentStats` |
| Bank config panel | `getBankConfig` / `updateBankConfig` |
| Graph | `getGraph` (+ legacy `listMemories` fallback) |
| Entity detail | `getEntity` + scoped `recall` |
| Document tags | `updateDocument` (tags only) |
| Export JSON | `exportDocuments` |
| Export wiki (OKF) | `listDocuments` + `getDocument` + `listMemories` + `listEntities` |

### Ingestion quality (Phase 4 — implemented)

See [RETAIN_QUALITY.md](../../../setup/docs/guides/RETAIN_QUALITY.md):

- Stable `document_id` for new notes (required title/slug)
- Per-team `retain_mission` / `reflect_mission` / `observations_mission` at bootstrap
- Retain context + source timestamps on note/upload forms
- Post-retain UX: “Processing — searchable in a few minutes.”
- `entity_labels` per team + editable in Bank Config
- `observationScopes`: `per_tag` (private) / `combined` (shared) on retain

---

## Cookbook (multi-tenant patterns)

| Recipe | Relevance |
|--------|-----------|
| [per-user-memory.md](./cookbook/recipes/per-user-memory.md) | Tag scoping like our RBAC |
| [support-agent-shared-knowledge.md](./cookbook/recipes/support-agent-shared-knowledge.md) | Shared team bank |
| [quickstart.md](./cookbook/recipes/quickstart.md) | End-to-end retain/recall |

---

## Start here

1. [best-practices.md](./best-practices.md)
2. [TOPIC-INDEX.md](./TOPIC-INDEX.md) (this file)
3. [developer/api/quickstart.md](./developer/api/quickstart.md)
4. [openapi.json](./openapi.json) for exact schemas
