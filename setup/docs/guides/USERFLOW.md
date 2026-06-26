# User Flows

## 1. Login → team workspace

```
/login (email) → JWT cookie → home with team sidebar
```

| Role | Teams visible | Sidebar documents | Workspace mode |
|------|---------------|-------------------|----------------|
| consultant | All org teams + Shared | All banks expanded; documents prefetched for every team | **Operations** (work + Ops tabs, bank ids, config/export) |
| manager | All org teams + Shared | Same as consultant | **Overview** (team-wide query, no Ops tabs) |
| member | Assigned teams only | Active team only | **Workspace** (your contributions only, simpler chrome) |

Each mode changes shell tint, scope banner copy, sidebar labels, and tab accents. Sign in with demo accounts on `/login` to compare.

Active bank = `co-ech-team-{teamId}` on production (same as Hindsight Control Plane). Set `HINDSIGHT_BANK_NAMESPACE=co-ech` in `.env`. Header shows team label + bank id.

## 2. Upload files (Sources)

Primary path: **Browse → Sources → Upload file** (toolbar opens inline dropzone).

Alternate path: **Add → Upload** (full-page uploader; redirects back to Sources on success).

1. Select team in sidebar
2. Click **Upload file** on Sources, or use Add → Upload
3. Choose **New source** or **Replace existing** (pick document id for upsert)
4. Drop or browse PDF, DOCX, TXT, MD, CSV, images (max 100MB)
5. POST `/api/upload` → Hindsight queues indexing (`operation_ids`)
6. Portal returns to Sources and refreshes the document list; header shows **Indexing N** for ~15s
7. Open the new document in the list to read retained text; facts appear under **Knowledge**

Consultants can choose parser (`markitdown` vs `iris`); other roles use the default.

## 3. Sources (read, replace, delete, filter, tags)

1. Select team in sidebar — expand bank to lazy-load document list
2. **Sources** tab (default): list documents, click to read `original_text`
3. Filter list by document id substring (`q`) or tags (comma-separated)
4. GET `/api/documents?bankId=` and `/api/documents/:id?bankId=`
5. Document cards show fact counts, `nodes_by_fact_type`, and timestamps
6. **Replace file** — pick a new file on the open document; POST `/api/upload` with `documentId` set to the existing id (Hindsight upsert: old facts removed, new content re-indexed)
7. **Edit text** — **Edit** on an open document; PUT `/api/documents/:id` with `{ bankId, content }` re-retains same `document_id` (replace mode)
8. **Continue this source** — opens Add note with append retain on the same `document_id`
9. **Tags** (consultants) — PATCH `/api/documents/:id` with `{ bankId, tags }`; triggers observation re-consolidation for that source
10. **Delete** — confirm dialog; DELETE `/api/documents/:id?bankId=` removes the source and all derived facts (irreversible on production banks)

After replace or delete, the list refreshes and **Indexing N** may appear while async retain runs.

## 4. Knowledge (extracted facts + entities)

1. **Knowledge** tab lists memory units via GET `/api/memories?bankId=`
2. Filter by document when one is selected in sidebar
3. Click **source** link to jump to document reader
4. Click **entity pill** to open entity detail drawer (facts, chunks, source docs)
5. When scoped to one document, **Add to this document** opens note editor in append mode

## 5. Retain (Add note)

1. Select team in sidebar
2. **Add → Note** — plain text only (no formatting required)
3. Choose **New document** (optional title) or **Attach to existing** (append retain on chosen `document_id`)
4. For Word/PDF, use **Sources → Upload file** instead
5. POST `/api/retain` — server injects tags: `user:{id}`, `team:{id}`, `scope:private`
6. Append mode uses `updateMode: append` when attaching to an existing source

## 6. Query (Recall / Reflect)

- Scoped to active team bank
- Members: `tagsMatch: all_strict` (user + team tags)
- Consultant/manager: `tagsMatch: any_strict` (team tag only)
- **Recall** requests `include.chunks`, `include.entities`, and `include.source_facts` by default
- Each recall hit can **Show context** (chunk text) and **Open source** (document)
- Observations show **Evidence** (source facts with links)
- **Reflect** returns answer plus **Based on** sections: mental models, memories (world / experience / observation), and directives when present
- Consultants: **Save as playbook** on a Reflect answer creates a mental model (Config → Playbooks)

## 7. Bank settings (consultant)

**Config** tab — four sections:

| Tab | Controls |
|-----|----------|
| **Retain** | Bank/agent name, extraction mode, retain mission, custom instructions, **default retain strategy**, **retain strategies JSON** |
| **Reflect** | Reflect mission, strategy, enable observations, observations mission |
| **Playbooks** | Mental models — create, refresh, clear, delete standing Reflect syntheses |
| **Advanced** | Entity labels JSON, store document text, LLM tracing, resolved config dump |

POST `/api/config` with `{ action: 'get' | 'update', bankId, updates }`. Playbooks: `/api/mental-models` CRUD + refresh/clear.

Team defaults are applied at bootstrap via `TEAM_BANK_PROFILES` in `shared/lib/team-banks.ts`.

### Scenarios vs retain strategies (same team bank)

| Concept | Purpose | Example |
|---------|---------|---------|
| **Scenario** | Tag-based slice within a team bank — shared docs use `shared` | `scenario:megacorp-renewal`, `scenario:q3-roadmap` |
| **Retain strategy** | How content is extracted (mode, mission overrides per call) | `meetings` (concise), `uploads` (verbose) |

- **Add note / Upload / Query** — optional scenario field writes or filters `scenario:{id}` tags.
- Leave scenario empty for team-wide recall/reflect.
- Docs tagged `scenario:shared` (or untagged) remain visible when no scenario filter is set.

### Multi-company bank namespaces

Bank ids are `{namespace}-team-{teamId}` per company (e.g. `co-ech-team-product`). Per-company env overrides: `HINDSIGHT_BANK_NAMESPACE_ECH`, `HINDSIGHT_SHARED_BANK_ECH`. Legacy global `HINDSIGHT_BANK_NAMESPACE` applies only to `ech`.

## 8. Knowledge browser (Graph tab — Wiki + Map)

The **Graph** tab is a human-first knowledge browser, not a raw graph dump.

| Mode | Audience | What you see |
|------|----------|--------------|
| **Wiki** (default) | Everyone | Linked source and entity pages with readable titles, `[[wiki links]]`, and provenance |
| **Map** | Power users / consultants | Force-directed entity + memory graph for relationship inspection |

1. Open **Graph** on any team bank
2. **Wiki** loads live via GET `/api/banks/:bankId/wiki` (same OKF bundle as export, no download step)
3. Browse **Overview**, **Sources**, or **Entities** in the sidebar; click `[[links]]` to navigate
4. **Open in Sources** / **Open entity detail** jump to the main portal panels
5. Switch to **Map** for advanced inspection (GET `/api/banks/:bankId/graph`)

No Three.js: wiki mode is text + links for readability and sales demos. Export wiki (consultant) remains for portable OKF files.

## 9. Entity detail (Graph / Knowledge)

1. Click an entity in **Wiki**, a node in **Map**, or an entity pill in **Knowledge**
2. Drawer loads GET `/api/entities/:id` plus recall for related facts (with chunks)
3. **Sources** section groups facts by originating document with open links

## 10. Export wiki (OKF) — consultant

1. **Ops → Export → Export wiki (OKF)**
2. POST `/api/export-wiki` builds the same bundle as live Wiki (plus download)
3. Frontmatter includes `type`, `id`, counts, `nodes_by_fact_type`, timestamps, tags
4. Optional in-portal preview uses the shared Wiki viewer

## 11. Bootstrap team bank (consultant)

`PUT /api/banks` with `{ "teamId": "product" }` — creates `team-product` with default missions.

## 12. Demo accounts

| Email | Role | Teams |
|-------|------|-------|
| eric@consultant.com | consultant | all |
| alice@ech.com | member | product |
| bob@ech.com | member | engineering |
| carol@ech.com | manager | all |

Password: any (demo).

## 13. Cold start alignment

Run `python examples/ech_cold_start.py --phase all` to seed `team-*` banks before first portal use.

## Provenance principle

**Source before synthesis:** UI surfaces raw documents and chunks before compiled observations. Entity pages and OKF export link facts back to stable `document_id` source pages — no editable wiki layer in the portal.

## 14. Ingestion quality (Phase 4)

See [RETAIN_QUALITY.md](../RETAIN_QUALITY.md) — stable note ids, team missions, retain context, source timestamps, processing hint, entity_labels, observation scopes.
