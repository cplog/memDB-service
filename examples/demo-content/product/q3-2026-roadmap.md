# ECH Product Roadmap — Q3 2026

**Author:** Alice Chen · **Reviewed by:** David Wong · **Status:** Approved 2026-06-14

## Executive summary

Q3 focuses on enterprise readiness ahead of MegaCorp renewal and FastStart upsell. Project Titan AI work is deferred to Q4 to fund SSO and reporting.

## Priority 1 — Project Phoenix (platform migration)

- Migrate billing and auth services off monolith by 2026-08-15
- Zero-downtime cutover rehearsal with MegaCorp sandbox
- **Owner:** Alice Chen · **Engineering:** Bob Smith

## Priority 2 — Enterprise SSO

MegaCorp requires OAuth2 + SAML by **August 2026** for procurement security audit. Carol Lee escalated this as renewal blocker.

- SAML IdP metadata ingestion — Bob Smith, 6-week estimate
- David Wong approved pulling one engineer from Titan to hit 4-week target

## Priority 3 — Custom reporting module

FastStart upsell depends on self-serve dashboards. Design kickoff 2026-07-01. Ship target Q4.

## Metrics we're watching

| Metric | Current | Target |
|--------|---------|--------|
| Mobile onboarding conversion | 12% | 22% by July 1 |
| Desktop onboarding conversion | 34% | maintain |
| MegaCorp API uptime (30d) | 99.2% | 99.9% |

## Deprioritized

- Project Titan generative features → Q4 2026
- Greenfield mobile redesign → 2027 H1

## Decisions log

1. **2026-06-10** — Run parallel A/B tests for mobile vs desktop onboarding (Alice / Bob)
2. **2026-06-14** — SSO beats Titan for Q3 staffing (David)
3. **2026-06-14** — Carol may offer manual reporting bridge for FastStart until Q4 module ships
