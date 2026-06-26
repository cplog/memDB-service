# Retain Quality & Bank Tuning

Checklist for **before heavy ingestion** and **ongoing portal retains**. Complements Documents + Chunks work (stable sources, OKF export).

## 1. Stable document IDs for notes ✅

**Behavior:** New notes require a title/slug. `documentIdFromTitle()` produces a stable id (same sanitization as uploads). Attach/append keeps existing `document_id`.

**Code:** `shared/lib/retain-validation.ts`, `frontend_platform/components/memory-editor.tsx`

## 2. Domain-specific bank missions ✅

Per-team profiles in `shared/lib/team-banks.ts` (`TEAM_BANK_PROFILES`) set `retainMission`, `reflectMission`, and `observationsMission` at bank creation.

**Before bulk ingest:** run `PUT /api/banks` or cold start so missions are applied.

## 3. Richer retain context ✅

Add note and upload forms accept:

| Field | Maps to |
|-------|---------|
| Source type | `context` + `metadata.source_type` |
| Meeting name | `context` + `metadata.meeting_name` |
| Ticket ID | `context` + `metadata.ticket_id` |

## 4. Source timestamps ✅

Optional **source date** on note/upload → retain `timestamp` and `metadata.source_date` when valid.

## 5. Post-retain UX hint ✅

Unified copy: **“Processing — searchable in a few minutes.”** after note, upload, and Sources indexing banner.

## 6. entity_labels ✅

Team bootstrap sets domain-specific `entity_labels` (e.g. Product: `content_kind`, `audience`; Engineering: `system_area`, `record_kind`).

Consultants can view/edit JSON in **Admin → Config → Entity labels**.

## 7. observation_scopes ✅

Private retains pass `observationScopes: 'per_tag'`; shared retains use `'combined'`. Documented in Bank Config panel. Prevents observation bleed across mixed private/shared team banks.

## 8. Scenarios + retain strategies ✅

Optional `scenarioId` on retain/upload/query writes or filters `scenario:{id}` tags within a team bank. Named `retain_strategies` in bank config (and per-call `retainStrategy`) control extraction mode per content type. See USERFLOW §7.

## Consultant bootstrap order

1. Create team bank (`PUT /api/banks`) — applies domain missions + entity_labels
2. Review missions in Admin → Config (tune before bulk upload)
3. Cold start or upload with **stable document ids** (note titles, filenames)
4. Add optional source context (type, meeting, ticket, date) on retains
5. Verify recall + Sources before bulk ingest

## Related docs

- [USERFLOW.md](./USERFLOW.md) — Add note / upload flows
- [PORTAL_GUIDE.md](./PORTAL_GUIDE.md) — API and bank config
- [COLD_START_GUIDE.md](./COLD_START_GUIDE.md) — seed data

## Self-checks

```bash
cd frontend_platform
npm run check:retain
npm run check:team-banks
```
