# ADR-001: GraphQL for Internal APIs

**Status:** Accepted · **Date:** 2026-06-08 · **Author:** Bob Smith

## Context

Frontend teams over-fetch REST endpoints by ~40%. Mobile dashboard loads 11 endpoints for one screen. MegaCorp bulk-import UI suffers from N+1 calls.

## Decision

Adopt GraphQL for **internal** service APIs (portal, admin tools). Public customer REST API unchanged for backward compatibility.

## Consequences

**Positive**
- Flexible queries; fewer round trips
- Strong typing via schema registry

**Negative**
- Learning curve for junior engineers
- Need query complexity limits to prevent abuse

## Alternatives considered

| Option | Verdict |
|--------|---------|
| gRPC | Rejected — tooling overhead for team size |
| BFF layer only | Rejected — duplicates logic per client |
| Keep REST | Rejected — mobile perf unacceptable |

## Action items

- Bob runs internal GraphQL workshop — **2026-06-20**
- Circuit breaker for DB pool — **2026-06-30** (linked to P2 incident)
- SSO work may delay GraphQL rollout by 2 weeks — David approved tradeoff

## Related incidents

**P2 outage 2026-06-15** — Connection pool exhausted during MegaCorp bulk import. Fix: pool 20→100, alerts added.
