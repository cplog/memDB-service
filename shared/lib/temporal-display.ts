/**
 * Temporal display helpers for portal memory items.
 * ponytail: simple date formatting; Intl.DateTimeFormat is stdlib, no deps.
 */

export function eventTimeFromMemory(row: {
  occurred_start?: string | null
  mentioned_at?: string | null
  created_at?: string | null
}): string | null {
  return row.occurred_start ?? row.mentioned_at ?? row.created_at ?? null
}

export function formatEventTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatEventTimeRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return ''
  const s = formatEventTime(start)
  const e = formatEventTime(end)
  if (s && e && s !== e) return `${s} → ${e}`
  return s || e || ''
}

export function monthHeader(iso?: string | null): string {
  if (!iso) return 'Unknown'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function runTemporalDisplaySelfCheck(): void {
  const row = { occurred_start: '2026-06-15T00:00:00Z', mentioned_at: '2026-06-16T00:00:00Z', created_at: '2026-06-17T00:00:00Z' }
  if (eventTimeFromMemory(row) !== '2026-06-15T00:00:00Z') throw new Error('temporal: eventTimeFromMemory should prefer occurred_start')

  const row2 = { occurred_start: null, mentioned_at: '2026-06-16T00:00:00Z', created_at: '2026-06-17T00:00:00Z' }
  if (eventTimeFromMemory(row2) !== '2026-06-16T00:00:00Z') throw new Error('temporal: eventTimeFromMemory should fall back to mentioned_at')

  const row3 = { occurred_start: null, mentioned_at: null, created_at: '2026-06-17T00:00:00Z' }
  if (eventTimeFromMemory(row3) !== '2026-06-17T00:00:00Z') throw new Error('temporal: eventTimeFromMemory should fall back to created_at')

  if (formatEventTime('2026-06-15T00:00:00Z') !== 'Jun 15, 2026') throw new Error('temporal: formatEventTime failed')
  if (formatEventTime(null) !== '') throw new Error('temporal: formatEventTime(null) should be empty')
  if (formatEventTimeRange('2026-06-01T00:00:00Z', '2026-06-10T00:00:00Z') !== 'Jun 1, 2026 → Jun 10, 2026') throw new Error('temporal: formatEventTimeRange failed')
  if (formatEventTimeRange('2026-06-01T00:00:00Z', '2026-06-01T00:00:00Z') !== 'Jun 1, 2026') throw new Error('temporal: formatEventTimeRange same day should collapse')
  if (monthHeader('2026-06-15T00:00:00Z') !== 'June 2026') throw new Error('temporal: monthHeader failed')
}
