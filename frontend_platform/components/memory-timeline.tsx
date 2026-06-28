'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from './hindsight-icons'
import { cn } from '@/lib/utils'
import { factTypeStyle } from '@/lib/workspace-colors'
import { documentDisplayName, truncateDocumentLabel } from '@/lib/document-display'
import { eventTimeFromMemory, monthHeader } from '@/lib/temporal-display'
import { animate, stagger } from 'animejs'

interface TimeseriesBucket {
  time: string
  world?: number
  experience?: number
  observation?: number
}

interface MemoryRow {
  id: string
  text?: string
  fact_type?: string
  document_id?: string
  created_at?: string
  occurred_start?: string | null
  mentioned_at?: string | null
  entities?: string[]
}

export interface MemoryTimelineProps {
  bankId: string
  onSelectEntity?: (entityId: string, entityName: string) => void
  onOpenDocument?: (documentId: string) => void
  embedded?: boolean
}

type Period = '7d' | '30d' | '90d'
type TimeField = 'created_at' | 'occurred_start' | 'mentioned_at'

function maxInBuckets(buckets: TimeseriesBucket[]): number {
  let m = 0
  for (const b of buckets) {
    const total = (b.world ?? 0) + (b.experience ?? 0) + (b.observation ?? 0)
    if (total > m) m = total
  }
  return m || 1
}

function bucketDateLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timelineStamp(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '—', time: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '—', time: '' }
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  }
}

export function MemoryTimeline({
  bankId,
  onSelectEntity,
  onOpenDocument,
  embedded = false,
}: MemoryTimelineProps) {
  const [period, setPeriod] = useState<Period>('30d')
  const [timeField, setTimeField] = useState<TimeField>('created_at')
  const [buckets, setBuckets] = useState<TimeseriesBucket[]>([])
  const [memories, setMemories] = useState<MemoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const barsRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tsRes, memRes] = await Promise.all([
        fetch(
          `/api/memories/timeseries?bankId=${encodeURIComponent(bankId)}&period=${period}&timeField=${timeField}`
        ),
        fetch(`/api/memories?bankId=${encodeURIComponent(bankId)}&limit=100`),
      ])
      if (!tsRes.ok) throw new Error(`Timeseries failed (${tsRes.status})`)
      if (!memRes.ok) throw new Error(`Memories failed (${memRes.status})`)
      const tsData = await tsRes.json()
      const memData = await memRes.json()
      setBuckets((tsData.buckets ?? []) as TimeseriesBucket[])
      const rows = (memData.items ?? [])
        .map((row: Record<string, unknown>) => ({
          id: String(row.id ?? ''),
          text: row.text as string | undefined,
          fact_type: row.fact_type as string | undefined,
          document_id: row.document_id as string | undefined,
          created_at: row.created_at as string | undefined,
          occurred_start: (row.occurred_start as string | null) ?? null,
          mentioned_at: (row.mentioned_at as string | null) ?? null,
          entities: Array.isArray(row.entities)
            ? (row.entities as string[])
            : typeof row.entities === 'string'
              ? row.entities.split(',').map((s) => s.trim()).filter(Boolean)
              : [],
        }))
        .filter((m: MemoryRow) => m.id)
      setMemories(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timeline')
      setBuckets([])
      setMemories([])
    } finally {
      setLoading(false)
    }
  }, [bankId, period, timeField])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!barsRef.current || buckets.length === 0) return
    const bars = barsRef.current.querySelectorAll('.ts-bar')
    if (bars.length === 0) return
    animate(bars, {
      scaleY: [0, 1],
      opacity: [0, 1],
      delay: stagger(30),
      duration: 600,
      ease: 'out(3)',
    })
  }, [buckets, selectedBucket])

  useEffect(() => {
    if (!streamRef.current) return
    const cards = streamRef.current.querySelectorAll('.stream-card')
    if (cards.length === 0) return
    animate(cards, {
      translateY: [16, 0],
      opacity: [0, 1],
      delay: stagger(40),
      duration: 350,
      ease: 'outQuad',
    })
  }, [memories, selectedBucket])

  const maxTotal = useMemo(() => maxInBuckets(buckets), [buckets])

  const streamItems = useMemo(() => {
    const sorted = [...memories]
    sorted.sort((a, b) => {
      const ta = eventTimeFromMemory(a) ?? ''
      const tb = eventTimeFromMemory(b) ?? ''
      return tb.localeCompare(ta)
    })
    if (!selectedBucket || buckets.length === 0) return sorted
    const idx = buckets.findIndex((b) => b.time === selectedBucket)
    if (idx < 0) return sorted
    const start = new Date(selectedBucket).getTime()
    const next = buckets[idx + 1]
    const end = next ? new Date(next.time).getTime() : start + 24 * 60 * 60 * 1000
    return sorted.filter((m) => {
      const t = eventTimeFromMemory(m)
      if (!t) return false
      const ms = new Date(t).getTime()
      return ms >= start && ms < end
    })
  }, [memories, selectedBucket, buckets])

  const groupedStream = useMemo(() => {
    const groups: Record<string, MemoryRow[]> = {}
    for (const m of streamItems) {
      const t = eventTimeFromMemory(m) ?? ''
      const key = t ? t.slice(0, 7) : 'unknown'
      ;(groups[key] ??= []).push(m)
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [streamItems])

  const toolbar = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1 border-b bg-[hsl(var(--card))] sm:px-4">
      <div className="flex items-center gap-1">
        <span className="text-xs text-[hsl(var(--vault-muted))] mr-1">Period</span>
        {(['7d', '30d', '90d'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={cn(
              'text-xs rounded-md px-2 py-0.5 border transition-colors font-medium',
              period === p
                ? 'bg-[hsl(var(--accent))]/10 border-[hsl(var(--accent))] text-foreground'
                : 'bg-transparent border-border text-[hsl(var(--vault-muted))] hover:bg-[hsl(var(--secondary))]'
            )}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-[hsl(var(--vault-muted))] mr-1">Time</span>
        {(
          [
            { key: 'created_at', label: 'Ingest' },
            { key: 'occurred_start', label: 'Event' },
            { key: 'mentioned_at', label: 'Mention' },
          ] as { key: TimeField; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTimeField(t.key)}
            className={cn(
              'text-xs rounded-md px-2 py-0.5 border transition-colors font-medium',
              timeField === t.key
                ? 'bg-[hsl(var(--accent))]/10 border-[hsl(var(--accent))] text-foreground'
                : 'bg-transparent border-border text-[hsl(var(--vault-muted))] hover:bg-[hsl(var(--secondary))]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {selectedBucket ? (
        <button
          type="button"
          onClick={() => setSelectedBucket(null)}
          className="text-xs text-[hsl(var(--vault-active))] hover:underline"
        >
          Clear filter
        </button>
      ) : null}
      {!loading && streamItems.length > 0 ? (
        <span className="text-xs text-[hsl(var(--vault-muted))] tabular-nums">
          {streamItems.length} facts
        </span>
      ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="text-sm text-[hsl(var(--vault-muted))] ml-auto min-h-9"
          onClick={load}
          disabled={loading}
          aria-label="Refresh timeline"
        >
          {loading ? <Spinner /> : 'Refresh'}
        </Button>
      </div>
    )

  return (
    <section className={cn('flex flex-col min-h-0', embedded ? 'flex-1' : 'flex-1 min-h-0')}>
      {toolbar}
      <ScrollArea className="flex-1 min-h-0 bg-[hsl(var(--canvas))]">
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner className="size-5" />
          </div>
        ) : error ? (
          <div className="px-5 py-8">
            <p className="text-[12px] text-[hsl(var(--error-fg))]">{error}</p>
            <Button variant="outline" size="sm" className="mt-3 min-h-[44px] text-xs" onClick={load}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-none px-3 py-3 space-y-3">
            {buckets.length > 0 ? (
              <div className="space-y-1.5 w-full" ref={barsRef}>
                <div className="flex items-end gap-0.5 h-20 w-full">
                  {buckets.map((b) => {
                    const total = (b.world ?? 0) + (b.experience ?? 0) + (b.observation ?? 0)
                    const isSelected = selectedBucket === b.time
                    return (
                      <button
                        key={b.time}
                        type="button"
                        title={`${bucketDateLabel(b.time)} · ${total} facts`}
                        onClick={() => setSelectedBucket(isSelected ? null : b.time)}
                        className={cn(
                          'ts-bar flex-1 flex flex-col justify-end rounded-t-sm transition-all origin-bottom',
                          isSelected ? 'opacity-100' : 'opacity-80 hover:opacity-100'
                        )}
                      >
                        <div className="w-full flex flex-col-reverse gap-[1px]">
                          {(b.observation ?? 0) > 0 ? (
                            <div
                              className="w-full bg-[hsl(var(--accent))]/60"
                              style={{ height: `${maxTotal ? Math.round(((b.observation ?? 0) / maxTotal) * 100) : 0}%` }}
                            />
                          ) : null}
                          {(b.experience ?? 0) > 0 ? (
                            <div
                              className="w-full bg-[hsl(var(--vault-active))]/60"
                              style={{ height: `${maxTotal ? Math.round(((b.experience ?? 0) / maxTotal) * 100) : 0}%` }}
                            />
                          ) : null}
                          {(b.world ?? 0) > 0 ? (
                            <div
                              className="w-full bg-[hsl(var(--success-fg))]/60"
                              style={{ height: `${maxTotal ? Math.round(((b.world ?? 0) / maxTotal) * 100) : 0}%` }}
                            />
                          ) : null}
                          {total === 0 ? (
                            <div className="w-full bg-[hsl(var(--secondary))]/40" style={{ height: '2px' }} />
                          ) : null}
                        </div>
                        {isSelected ? (
                          <div className="w-full h-0.5 bg-[hsl(var(--vault-active))] mt-0.5" />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-[hsl(var(--vault-muted))]">
                  <span>{buckets[0] ? bucketDateLabel(buckets[0].time) : ''}</span>
                  <span>{buckets[buckets.length - 1] ? bucketDateLabel(buckets[buckets.length - 1].time) : ''}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-[hsl(var(--vault-muted))]">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-sm bg-[hsl(var(--success-fg))]/60" />
                    world
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-sm bg-[hsl(var(--vault-active))]/60" />
                    experience
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-sm bg-[hsl(var(--accent))]/60" />
                    observation
                  </span>
                </div>
              </div>
            ) : null}

            {streamItems.length === 0 ? (
              <div className="text-center text-[hsl(var(--vault-muted))] text-[12px] py-6">
                {selectedBucket
                  ? 'No facts in this bucket.'
                  : 'No facts yet. Add content first; extracted facts appear after indexing.'}
              </div>
            ) : (
              <div ref={streamRef}>
                {groupedStream.map(([monthKey, mems]) => (
                  <div key={monthKey} className="mb-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--vault-muted))] mb-1.5 pl-[calc(4.5rem+1.25rem)] sm:pl-[calc(5rem+1.5rem)]">
                      {monthHeader(mems[0] ? eventTimeFromMemory(mems[0]) ?? '' : '')}
                    </h3>
                    <div className="relative">
                      {mems.map((mem, idx) => {
                        const when = eventTimeFromMemory(mem)
                        const stamp = timelineStamp(when)
                        return (
                          <div
                            key={mem.id}
                            className="stream-card grid grid-cols-[4.5rem_10px_minmax(0,1fr)] sm:grid-cols-[5rem_10px_minmax(0,1fr)] gap-x-2 sm:gap-x-3"
                          >
                            <div className="text-right pt-0.5 tabular-nums">
                              <p className="text-xs font-medium text-[hsl(var(--vault-active))]">{stamp.date}</p>
                              {stamp.time ? (
                                <p className="text-[10px] text-[hsl(var(--vault-muted))]">{stamp.time}</p>
                              ) : null}
                            </div>
                            <div className="relative flex justify-center">
                              <div
                                className={cn(
                                  'absolute top-0 bottom-0 w-px bg-[hsl(var(--border))]',
                                  idx === 0 && 'top-2',
                                  idx === mems.length - 1 && 'bottom-auto h-3'
                                )}
                                aria-hidden
                              />
                              <div className="relative z-10 mt-1.5 size-2 shrink-0 rounded-full bg-[hsl(var(--vault-active))] ring-2 ring-[hsl(var(--canvas))]" />
                            </div>
                            <article className="min-w-0 pb-3 border-b border-[hsl(var(--border))] last:border-b-0">
                              <p className="text-sm sm:text-[15px] leading-relaxed text-foreground">
                                {mem.text ?? '(empty)'}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                {mem.fact_type ? (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[11px] capitalize font-medium px-2 py-0.5',
                                      factTypeStyle(mem.fact_type).badge
                                    )}
                                  >
                                    {factTypeStyle(mem.fact_type).label}
                                  </Badge>
                                ) : null}
                                {mem.entities?.slice(0, 4).map((entity) =>
                                  onSelectEntity ? (
                                    <button
                                      key={entity}
                                      type="button"
                                      onClick={() => onSelectEntity(entity, entity)}
                                      className="text-[11px] rounded-full px-2 py-0.5 border border-[hsl(var(--accent))]/20 bg-[hsl(var(--accent))]/5 text-[hsl(var(--vault-active))] hover:bg-[hsl(var(--accent))]/15 transition-colors"
                                    >
                                      {entity}
                                    </button>
                                  ) : (
                                    <Badge key={entity} variant="secondary" className="text-[11px] font-normal">
                                      {entity}
                                    </Badge>
                                  )
                                )}
                                {mem.document_id && onOpenDocument ? (
                                  <button
                                    type="button"
                                    onClick={() => onOpenDocument(mem.document_id!)}
                                    className="text-[11px] text-[hsl(var(--vault-active))] hover:underline truncate max-w-[12rem] ml-auto"
                                  >
                                    {truncateDocumentLabel(documentDisplayName(mem.document_id))}
                                  </button>
                                ) : null}
                              </div>
                            </article>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </section>
  )
}
