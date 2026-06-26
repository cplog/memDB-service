# SOC 2 Type II Readiness Checklist

**Audit window:** August 2026 · **Owner:** Diana Park · **Advisor:** Eric Tai (consultant)

## Gap analysis (2026-06-13)

| Control area | Status | Gap | Remediation |
|--------------|--------|-----|-------------|
| Access reviews | 🔴 | Ad-hoc approvals by David | Quarterly review process — Diana |
| Incident response | 🟡 | Runbooks in Slack threads | Formal runbook in Hindsight + Confluence — Eric |
| Vendor risk | 🟡 | 2 small tools unaudited | Complete by 2026-07-15 |
| Change management | 🟢 | GitHub PRs + Railway deploy logs | None |
| Encryption at rest | 🟢 | NeonDB + S3 | None |

## Vendor landscape

- **Railway** — hosting, satisfactory
- **NeonDB** — costs +20% QoQ; Diana evaluating reserved capacity
- **SendGrid** — deliverability issues to enterprise inboxes; evaluating AWS SES

## Consultant recommendations (Eric Tai)

1. Retain incident post-mortems and ADRs in Hindsight for audit evidence trail
2. Map MegaCorp SSO project to access-control narrative for auditor
3. Export OKF wiki bundle monthly as read-only knowledge backup

## Timeline

- **2026-06-25** — Access review policy draft
- **2026-07-01** — Incident runbook v1
- **2026-07-15** — Vendor assessments complete
- **2026-08-01** — Audit kickoff
