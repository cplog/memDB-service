# UAT — db_mem Memory Portal

Operator acceptance testing for the Hindsight consulting memory portal.

## Audience

Run before deploy or after PRs touching auth, RBAC, API routes, or Hindsight integration.

## Critical paths

| Flow id | Route | What must work |
|---------|-------|----------------|
| login | /login | Demo email login, session cookie |
| team-workspace | / | Team sidebar, role-scoped teams |
| retain | / | Retain to active team bank |
| recall | / | Recall/reflect scoped to bank |
| consultant-bootstrap | / | Consultant PUT /api/banks |

## Environments

| Env | Portal | API | Auth | DB |
|-----|--------|-----|------|-----|
| local | http://127.0.0.1:3000 | http://127.0.0.1:8000 | Demo JWT | read-only Hindsight remote |

Start stack: `./start-dev.sh`

## Auth prerequisite (Tier C)

Use demo accounts from [USERFLOW.md](./USERFLOW.md). Any password — email only.

## Out of scope

- Hindsight Control Plane UI (Railway)
- Webhook endpoints
- Native mobile
- `co-ech-*` → `team-*` bank migration

## Run harness

```bash
npm run uat:preflight
npm run uat:tier-a
npm run uat:tier-b
npm run uat:tier-c -- --flows login,team-workspace,retain,recall --manual
```

Manifest: `uat-manifest.yml` at repo root.
