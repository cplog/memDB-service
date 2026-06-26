# Product

## Register

product

## Users

Consultants, managers, and team members at client organizations (e.g. ECH) who need to capture, browse, and query institutional knowledge per team.

They use the portal during working hours: after meetings, during research, or when onboarding to a team bank. Consultants see all teams; members see assigned teams only. They are task-focused, not browsing for delight.

## Product Purpose

A team-scoped memory portal on top of Hindsight (`knowledge.crewio.ai`). Each team maps to a bank (`team-{id}`). Users retain notes and uploads, read source documents, inspect extracted facts, query via recall/reflect, and explore entity relationships in a graph.

Success: a user can answer "what does this team know, and where did it come from?" without leaving the portal or guessing which bank to use.

## Brand Personality

Calm, precise, trustworthy. Expert tool, not a demo. Quiet confidence: the interface disappears into the task.

Three words: **focused**, **legible**, **honest**.

## Anti-references

- Generic SaaS dark dashboards (purple gradients, hero metrics, identical stat cards)
- Observability-tool cliché (dark blue, neon charts, alert fatigue aesthetics)
- Identical card grids for every panel
- AI-slop UI (glassmorphism, gradient text, side-stripe accents, decorative motion)
- Over-decorated buttons and invented affordances where standard patterns exist

## Design Principles

1. **Source before synthesis**: show where knowledge came from (documents) before or beside extracted facts.
2. **Team context is always visible**: active bank, role, and scope never require guessing.
3. **Earned familiarity**: patterns from best-in-class tools (Linear, Notion, Raycast); no novelty for its own sake.
4. **States are first-class**: empty, loading, indexing pending, error, and permission-denied must teach, not dead-end.
5. **Density with rhythm**: compact for 13" laptops; hierarchy through weight and spacing, not decoration.

## Accessibility & Inclusion

- WCAG AA minimum for body text; AAA target for small labels where feasible.
- Keyboard navigation for sidebar, tabs, document list, and primary actions.
- Respect `prefers-reduced-motion`.
- Touch/click targets ≥44px on interactive chrome.
