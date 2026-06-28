'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from './hindsight-icons'
import { cn } from '@/lib/utils'
import { documentDisplayName, truncateDocumentLabel } from '@/lib/document-display'
import { factTypeStyle } from '@/lib/workspace-colors'

interface EntityObservation {
  text: string
  mentioned_at?: string | null
}

interface EntityDetailData {
  id: string
  canonical_name: string
  mention_count: number
  first_seen?: string | null
  last_seen?: string | null
  observations: EntityObservation[]
}

interface RecallFact {
  id?: string
  content?: string
  type?: string | null
  documentId?: string | null
  chunkId?: string | null
  chunkText?: string | null
  chunkTruncated?: boolean
}

interface SourceGroup {
  documentId: string
  facts: RecallFact[]
}

interface EntityDetailProps {
  bankId: string
  entityId: string
  entityName?: string
  onClose: () => void
  onOpenDocument?: (documentId: string, chunkText?: string | null) => void
}

export function EntityDetail({
  bankId,
  entityId,
  entityName,
  onClose,
  onOpenDocument,
}: EntityDetailProps) {
  const [detail, setDetail] = useState<EntityDetailData | null>(null)
  const [facts, setFacts] = useState<RecallFact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set())
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ponytail: simple focus trap — cycles focus within the panel
  // upgrade path: use a proper focus-trap library if more panels need it
  useEffect(() => {
    const panel = document.querySelector('[role="dialog"][aria-label^="Entity:"]') as HTMLElement | null
    if (!panel) return
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    panel.addEventListener('keydown', trap)
    return () => panel.removeEventListener('keydown', trap)
  }, [detail])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nameHint =
        entityName ??
        (entityId.startsWith('entity:')
          ? entityId.slice('entity:'.length).replace(/-/g, ' ')
          : null)

      const fetchEntity = async (id: string): Promise<EntityDetailData | null> => {
        const res = await fetch(
          `/api/entities/${encodeURIComponent(id)}?bankId=${encodeURIComponent(bankId)}`
        )
        if (!res.ok) return null
        return (await res.json()) as EntityDetailData
      }

      const resolveEntity = async (): Promise<EntityDetailData | null> => {
        if (entityId && !entityId.startsWith('entity:') && !entityId.includes(' ')) {
          const direct = await fetchEntity(entityId)
          if (direct) return direct
        }

        if (!nameHint) return null

        const listRes = await fetch(
          `/api/entities?bankId=${encodeURIComponent(bankId)}&limit=200`
        )
        if (!listRes.ok) return null

        const listData = await listRes.json()
        const hint = nameHint.toLowerCase()
        const match = (listData.items ?? []).find(
          (e: { canonical_name?: string; id?: string }) =>
            e.canonical_name?.toLowerCase() === hint
        )
        if (!match?.id) return null
        return fetchEntity(String(match.id))
      }

      const [entity, recallRes] = await Promise.all([
        resolveEntity(),
        fetch('/api/recall', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bankId,
            query: nameHint ?? entityId,
          }),
        }),
      ])

      const recallFacts: RecallFact[] = recallRes.ok
        ? ((await recallRes.json()).memories ?? [])
        : []
      setFacts(recallFacts)

      if (entity) {
        setDetail(entity)
        return
      }

      if (nameHint) {
        setDetail({
          id: entityId,
          canonical_name: nameHint,
          mention_count: recallFacts.length,
          observations: [],
        })
        return
      }

      throw new Error('Entity not found')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load entity')
      setDetail(null)
      setFacts([])
    } finally {
      setLoading(false)
    }
  }, [bankId, entityId, entityName])

  useEffect(() => {
    void load()
  }, [load])

  const sourceGroups = useMemo(() => {
    const map = new Map<string, RecallFact[]>()
    for (const f of facts) {
      if (!f.documentId) continue
      const list = map.get(f.documentId) ?? []
      list.push(f)
      map.set(f.documentId, list)
    }
    return Array.from(map.entries()).map(([documentId, groupFacts]) => ({
      documentId,
      facts: groupFacts,
    })) satisfies SourceGroup[]
  }, [facts])

  function toggleChunk(id: string) {
    setExpandedChunks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const title = detail?.canonical_name ?? entityName ?? entityId

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/50"
        aria-label="Close entity detail"
        onClick={onClose}
      />
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-border bg-[hsl(var(--card))] shadow-lg flex flex-col min-h-0"
        role="dialog"
        aria-modal="true"
        aria-label={`Entity: ${title}`}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-medium truncate">{title}</h2>
            <p className="text-xs text-[hsl(var(--vault-muted))] mt-0.5">Entity detail</p>
          </div>
          <Button
            ref={closeRef}
            variant="ghost"
            size="sm"
            className="min-h-[44px] text-xs"
            onClick={onClose}
          >
            Close
          </Button>
        </div>

      <ScrollArea className="flex-1 min-h-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-5" />
          </div>
        ) : error ? (
          <div className="p-4">
            <p className="text-[12px] text-[hsl(var(--error-fg))]">{error}</p>
            <Button variant="outline" size="sm" className="mt-3 min-h-[44px] text-xs" onClick={load}>
              Retry
            </Button>
          </div>
        ) : detail ? (
          <div className="p-4 space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs font-normal">
                {detail.mention_count} mentions
              </Badge>
              {detail.last_seen ? (
                <span className="text-xs text-[hsl(var(--vault-muted))]">
                  Last seen {new Date(detail.last_seen).toLocaleDateString()}
                </span>
              ) : null}
            </div>

            {detail.observations.length > 0 ? (
              <section>
                <h3 className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--vault-muted))] mb-2">
                  Observations
                </h3>
                <ul className="space-y-2">
                  {detail.observations.map((obs, i) => (
                    <li
                      key={i}
                      className="rounded-sm border border-border bg-[hsl(var(--canvas))] px-3 py-2 text-[12px] leading-relaxed"
                    >
                      {obs.text}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <h3 className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--vault-muted))] mb-2">
                Related facts · {facts.length}
              </h3>
              {facts.length === 0 ? (
                <p className="text-xs text-[hsl(var(--vault-muted))]">No recall hits for this entity.</p>
              ) : (
                <ul className="space-y-2">
                  {facts.map((f, i) => {
                    const key = f.id ?? String(i)
                    const showChunk = expandedChunks.has(key)
                    return (
                      <li
                        key={key}
                        className="rounded-sm border border-border bg-[hsl(var(--canvas))] px-3 py-2"
                      >
                        <p className="text-[12px] leading-relaxed">{f.content}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {f.type ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs capitalize font-normal border',
                                factTypeStyle(f.type).badge
                              )}
                            >
                              {f.type}
                            </Badge>
                          ) : null}
                          {f.documentId && onOpenDocument ? (
                            <button
                              type="button"
                              className="text-xs text-[hsl(var(--vault-active))] hover:underline"
                              onClick={() =>
                                onOpenDocument(f.documentId!, f.chunkText)
                              }
                            >
                              {truncateDocumentLabel(documentDisplayName(f.documentId))}
                            </button>
                          ) : null}
                          {f.chunkText ? (
                            <button
                              type="button"
                              className="text-xs text-[hsl(var(--vault-muted))] hover:text-[hsl(var(--vault-active))]"
                              onClick={() => toggleChunk(key)}
                            >
                              {showChunk ? 'Hide context' : 'Show context'}
                            </button>
                          ) : null}
                        </div>
                        {showChunk && f.chunkText ? (
                          <blockquote className="mt-2 pl-2 border-l-2 border-[hsl(var(--vault-active))]/40 text-xs text-[hsl(var(--vault-muted))] leading-relaxed whitespace-pre-wrap">
                            {f.chunkText}
                            {f.chunkTruncated ? (
                              <span className="block mt-1 text-xs opacity-70">Truncated</span>
                            ) : null}
                          </blockquote>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--vault-muted))] mb-2">
                Sources · {sourceGroups.length}
              </h3>
              {sourceGroups.length === 0 ? (
                <p className="text-xs text-[hsl(var(--vault-muted))]">No linked source documents.</p>
              ) : (
                <ul className="space-y-1.5">
                  {sourceGroups.map(({ documentId, facts: groupFacts }) => (
                    <li key={documentId}>
                      <button
                        type="button"
                        className="w-full text-left rounded-sm px-2 py-2 hover:bg-[hsl(var(--secondary))]/40 min-h-[44px]"
                        onClick={() => onOpenDocument?.(documentId)}
                      >
                        <span className="text-[12px] font-medium block truncate">
                          {documentDisplayName(documentId)}
                        </span>
                        <span className="text-xs text-[hsl(var(--vault-muted))]">
                          {groupFacts.length} fact{groupFacts.length === 1 ? '' : 's'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </ScrollArea>
      </div>
    </>
  )
}
