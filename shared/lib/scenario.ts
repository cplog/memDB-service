/** Tag value for docs shared across scenarios within a team bank. */
export const SCENARIO_SHARED = 'shared'

/** Normalize user input to a slug-safe scenario id. */
export function normalizeScenarioId(raw?: string | null): string | null {
  if (!raw?.trim()) return null
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) return null
  return slug.length > 48 ? slug.slice(0, 48) : slug
}

export function scenarioTag(scenarioId: string): string {
  return `scenario:${scenarioId}`
}

export function appendScenarioTag(tags: string[], scenarioId?: string | null): string[] {
  const sid = normalizeScenarioId(scenarioId)
  if (!sid) return tags
  const tag = scenarioTag(sid)
  return tags.includes(tag) ? tags : [...tags, tag]
}

/** Common scenario slugs per team — optional quick-picks in portal forms. */
export const TEAM_SCENARIO_PRESETS: Record<string, string[]> = {
  product: ['megacorp-renewal', 'q3-roadmap', 'shared'],
  engineering: ['incidents', 'architecture', 'shared'],
  sales: ['pipeline', 'account-review', 'shared'],
  ops: ['compliance', 'vendors', 'shared'],
}

/** Runnable self-check — imported by shared/lib/selfcheck.ts */
export function runScenarioSelfCheck(): void {
  if (normalizeScenarioId('  MegaCorp Renewal! ') !== 'megacorp-renewal') {
    throw new Error('scenario normalize failed')
  }
  if (scenarioTag('renewal') !== 'scenario:renewal') {
    throw new Error('scenario tag failed')
  }
  const tags = appendScenarioTag(['team:product'], 'renewal')
  if (!tags.includes('scenario:renewal')) {
    throw new Error('append scenario tag failed')
  }
}
