# Customer Demo — Live Portal Walkthrough

Realistic ECH consulting data seeded **only through portal APIs** (upload, retain, edit, append, tags). No Python.

## Quick start

```bash
npm run dev                    # backend + portal
./scripts/seed-customer-demo.sh
```

Open the portal URL from startup output (default `http://localhost:3000`).

- **Login:** `eric@consultant.com`
- **Best banks for demo:** Product, Shared, Sales

Allow **2–3 minutes** after seeding for Recall, Graph, and Entity views to fully populate.

## What gets created

| Bank | Content |
|------|---------|
| **Shared** | 10 directory facts + company directory markdown upload |
| **Product** | Q3 roadmap + MegaCorp profile uploads; meeting notes with append + edit + tags; **3 playbooks** (mental models) |
| **Engineering** | GraphQL ADR upload; P2 incident post-mortem (edited) |
| **Sales** | MegaCorp renewal proposal; check-in + FastStart upsell notes |
| **Ops** | SOC 2 checklist upload; compliance prep note |

Source markdown lives in `examples/demo-content/` (editable before re-seeding).

All demo sources are tagged `demo:customer` where tags apply.

## Customer tour (suggested)

1. **Sources** — Product bank: roadmap, MegaCorp profile, edited meeting notes (`ech-demo-*`)
2. **Knowledge** — facts mentioning MegaCorp, SSO, Carol Lee, Project Phoenix
3. **Query → Recall** — *"MegaCorp SSO renewal August"* — try scenario filter `megacorp-renewal` vs `q3-roadmap`
4. **Query → Reflect** — *"What are the risks to MegaCorp renewal?"* — expand **Based on → Mental models** after playbooks finish generating (~1 min)
5. **Config → Playbooks** — MegaCorp renewal, SSO critical path, Q3 priorities
6. **Graph** — entity clusters around MegaCorp, Alice Chen, Bob Smith
7. **Export** — JSON bundle + OKF wiki with `[[wiki links]]` between sources and entities

## API-only seeder

`scripts/seed-customer-demo.sh` uses:

- `POST /api/auth/login`
- `POST /api/upload`
- `POST /api/retain` (optional `scenarioId`, `retainStrategy`)
- `POST /api/upload` (optional `scenarioId`, `retainStrategy` form fields)
- `PUT /api/documents/:id` (edit)
- `PATCH /api/documents/:id` (tags)
- `POST /api/mental-models` (product playbooks)
- `POST /api/recall`, `GET /api/banks/:id/graph`, `POST /api/export-wiki` (verify)

Reads backend URL from `.uat/dev-ports.json` when present.

Verification report: `.uat/reports/customer-demo-seed.json`

## Re-seed

Safe to re-run; creates additional documents (does not wipe). To start clean, delete sources in the portal first.
