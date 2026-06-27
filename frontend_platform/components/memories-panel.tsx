'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from './hindsight-icons'
import { cn } from '@/lib/utils'
import { factTypeStyle } from '@/lib/workspace-colors'
import { documentDisplayName, truncateDocumentLabel } from '@/lib/document-display'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface MemoryRow {
  id: string
  text?: string
  fact_type?: string
  document_id?: string
  created_at?: string
  entities?: string[]
}

interface MemoriesPanelProps {
  bankId: string
  teamLabel?: string
  documentId?: string | null
  onOpenDocument?: (documentId: string) => void
  onSelectEntity?: (entityId: string, entityName: string) => void
  onAddNote?: () => void
  onUpload?: () => void
  onAddToDocument?: (documentId: string) => void
}

function parseEntities(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw === 'string') return raw.split(',').map((s) => s.trim()).filter(Boolean)
  return []
}

function relativeTime(iso?: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 0) return 'just now'
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function ExpandableText({ text, className }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false)
  const needsTruncate = text.length > 280

  if (!needsTruncate) {
    return <p className={className}>{text}</p>
  }

  return (
    <div>
      <p className={cn(className, !expanded && 'line-clamp-3')}>
        {text}
      </p>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-[hsl(var(--vault-muted))] hover:text-[hsl(var(--vault-active))] mt-1 transition-colors"
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  )
}

type GroupMode = 'none' | 'type' | 'document'

export function MemoriesPanel({
  bankId,
  teamLabel,
  documentId,
  onOpenDocument,
  onSelectEntity,
  onAddNote,
  onUpload,
  onAddToDocument,
}: MemoriesPanelProps) {
  const [items, setItems] = useState<MemoryRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [groupMode, setGroupMode] = useState<GroupMode>('none')
  const [deleteTarget, setDeleteTarget] = useState<MemoryRow | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of items) {
      const t = (m.fact_type ?? 'unknown').toLowerCase()
      counts[t] = (counts[t] ?? 0) + 1
    }
    return counts
  }, [items])

  const visibleItems = useMemo(
    () =>
      typeFilter
        ? items.filter((m) => (m.fact_type ?? '').toLowerCase() === typeFilter)
        : items,
    [items, typeFilter]
  )

  const groupedItems = useMemo(() => {
    if (groupMode === 'type') {
      const groups: Record<string, MemoryRow[]> = {}
      for (const m of visibleItems) {
        const t = m.fact_type ?? 'other'
        ;(groups[t] ??= []).push(m)
      }
      return Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
    }
    if (groupMode === 'document') {
      const groups: Record<string, MemoryRow[]> = {}
      for (const m of visibleItems) {
        const d = m.document_id ?? '(untitled)'
        ;(groups[d] ??= []).push(m)
      }
      return Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
    }
    return null
  }, [visibleItems, groupMode])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        bankId,
        limit: '50',
        offset: '0',
      })
      if (documentId) params.set('documentId', documentId)
      if (filter.trim()) params.set('q', filter.trim())
      const res = await fetch(`/api/memories?${params}`)
      if (!res.ok) throw new Error(`Could not load facts (${res.status})`)
      const data = await res.json()
      const rows = (data.items ?? [])
        .map((row: Record<string, unknown>) => ({
          id: String(row.id ?? ''),
          text: row.text as string | undefined,
          fact_type: row.fact_type as string | undefined,
          document_id: row.document_id as string | undefined,
          created_at: row.created_at as string | undefined,
          entities: parseEntities(row.entities),
        }))
        .filter((m: MemoryRow) => m.id)
      setItems(rows)
      setTotal(data.total ?? rows.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load facts')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [bankId, documentId, filter])

  useEffect(() => {
    load()
  }, [load])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteOpen(false)
    setDeleting(true)
    try {
      const res = await fetch(`/api/memories/${encodeURIComponent(deleteTarget.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId, state: 'invalidated', reason: 'Deleted via portal' }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(String(data.error ?? `Delete failed (${res.status})`))
        return
      }
      setDeleteTarget(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete fact')
    } finally {
      setDeleting(false)
    }
  }

  function renderFactCard(mem: MemoryRow) {
    return (
      <div
        key={mem.id}
        className="group py-3 border-b border-[hsl(var(--border))] last:border-b-0"
      >
        <ExpandableText
          text={mem.text ?? '(empty)'}
          className="text-[15px] leading-relaxed text-foreground"
        />

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {mem.fact_type ? (
            <Badge
              variant="outline"
              className={cn(
                'text-[11px] capitalize font-medium px-2 py-0.5',
                factTypeStyle(mem.fact_type).badge
              )}
            >
              <span
                className={cn(
                  'inline-block w-1.5 h-1.5 rounded-full mr-1.5',
                  factTypeStyle(mem.fact_type).dot
                )}
                aria-hidden
              />
              {mem.fact_type}
            </Badge>
          ) : null}

          {mem.entities?.map((entity) =>
            onSelectEntity ? (
              <button
                key={entity}
                type="button"
                onClick={() => onSelectEntity(entity, entity)}
                className="text-[11px] rounded-full px-2.5 py-0.5 border border-[hsl(var(--accent))]/20 bg-[hsl(var(--accent))]/5 text-[hsl(var(--vault-active))] hover:bg-[hsl(var(--accent))]/15 hover:border-[hsl(var(--accent))]/40 transition-colors cursor-pointer"
              >
                {entity}
              </button>
            ) : (
              <Badge key={entity} variant="secondary" className="text-[11px] font-normal">
                {entity}
              </Badge>
            )
          )}

          <span className="text-[11px] text-[hsl(var(--vault-muted))]/60 ml-auto hidden sm:inline">
            {relativeTime(mem.created_at)}
          </span>

          {mem.document_id && onOpenDocument ? (
            <button
              type="button"
              onClick={() => onOpenDocument(mem.document_id!)}
              className="text-[11px] text-[hsl(var(--vault-active))] hover:underline truncate max-w-[180px] text-left hidden sm:inline"
            >
              {truncateDocumentLabel(documentDisplayName(mem.document_id))}
            </button>
          ) : mem.document_id ? (
            <span className="text-[11px] text-[hsl(var(--vault-muted))] truncate max-w-[180px] hidden sm:inline">
              {truncateDocumentLabel(documentDisplayName(mem.document_id))}
            </span>
          ) : null}

          <button
            type="button"
            className="text-[11px] text-[hsl(var(--vault-muted))] hover:text-[hsl(var(--error-fg))] shrink-0 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => {
              setDeleteTarget(mem)
              setDeleteOpen(true)
            }}
          >
            Delete
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-wrap items-center gap-2 px-4 py-1.5 border-b bg-[hsl(var(--card))] sm:px-5">
        <p className="text-xs text-[hsl(var(--vault-muted))] tabular-nums">
          {documentId ? 'One document' : `${total} facts`}
        </p>
        <div className="flex gap-2 flex-1 min-w-[12rem] max-w-md ml-2">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Filter facts…"
            className="text-sm h-9"
            aria-label="Filter facts"
          />
          <Button size="sm" className="shrink-0 text-sm h-9" onClick={load} disabled={loading}>
            Filter
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-sm text-[hsl(var(--vault-muted))] ml-auto min-h-9"
          onClick={load}
          disabled={loading}
          aria-label="Refresh facts"
        >
          {loading ? <Spinner /> : 'Refresh'}
        </Button>
      </div>

      {documentId && onAddToDocument ? (
        <div className="px-4 py-2 border-b sm:px-5">
          <Button
            variant="secondary"
            size="sm"
            className="text-sm h-9"
            onClick={() => onAddToDocument(documentId)}
          >
            Add to this document
          </Button>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b sm:px-5">
            <button
              type="button"
              onClick={() => setTypeFilter(null)}
              className={cn(
                'text-xs rounded-md px-3 py-1.5 border transition-colors font-medium',
                typeFilter === null
                  ? 'bg-[hsl(var(--accent))]/10 border-[hsl(var(--accent))] text-foreground'
                  : 'bg-transparent border-border text-[hsl(var(--vault-muted))] hover:bg-[hsl(var(--secondary))]'
              )}
            >
              All {items.length}
            </button>
            {(['world', 'experience', 'observation'] as const).map((t) =>
              typeCounts[t] ? (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                  className={cn(
                    'text-xs rounded-md px-3 py-1.5 border capitalize transition-colors font-medium',
                    factTypeStyle(t).badge,
                    typeFilter === t && 'ring-2 ring-[hsl(var(--vault-active))]'
                  )}
                >
                  {factTypeStyle(t).label} {typeCounts[t]}
                </button>
              ) : null
            )}

            <div className="ml-auto flex items-center gap-1 text-[11px] text-[hsl(var(--vault-muted))]">
              <span className="hidden sm:inline">Group:</span>
              {(['none', 'type', 'document'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGroupMode(mode)}
                  className={cn(
                    'rounded px-1.5 py-0.5 capitalize transition-colors',
                    groupMode === mode
                      ? 'bg-[hsl(var(--secondary))] text-foreground font-medium'
                      : 'hover:bg-[hsl(var(--secondary))]/50'
                  )}
                >
                  {mode === 'none' ? 'List' : mode}
                </button>
              ))}
            </div>
          </div>
        ) : null}

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
        ) : items.length === 0 ? (
          <div className="px-5 py-16 text-center max-w-sm mx-auto">
            <p className="text-[12px] text-[hsl(var(--vault-muted))] leading-relaxed">
              {documentId
                ? 'No facts from this document yet. Processing — searchable in a few minutes.'
                : 'No facts yet. Add content first; extracted facts appear after indexing.'}
            </p>
            {!documentId && (onUpload || onAddNote) ? (
              <div className="flex flex-col gap-2 mt-6">
                {onUpload ? (
                  <Button size="sm" variant="secondary" className="min-h-[44px] text-xs" onClick={onUpload}>
                    Upload
                  </Button>
                ) : null}
                {onAddNote ? (
                  <Button variant="outline" size="sm" className="min-h-[44px] text-xs" onClick={onAddNote}>
                    Add note
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="px-5 py-16 text-center max-w-sm mx-auto">
            <p className="text-[12px] text-[hsl(var(--vault-muted))] leading-relaxed">
              No {typeFilter ? `${typeFilter} ` : ''}facts match this filter.
            </p>
            {typeFilter ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 min-h-[44px] text-xs"
                onClick={() => setTypeFilter(null)}
              >
                Show all types
              </Button>
            ) : null}
          </div>
        ) : groupedItems ? (
          <div className="px-4 sm:px-6 lg:px-8 py-2 space-y-5 w-full max-w-none">
            {groupedItems.map(([key, mems]) => (
              <div key={key}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  {groupMode === 'type' ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[11px] capitalize font-medium px-2 py-0.5',
                        factTypeStyle(key).badge
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block w-1.5 h-1.5 rounded-full mr-1.5',
                          factTypeStyle(key).dot
                        )}
                        aria-hidden
                      />
                      {key}
                    </Badge>
                  ) : (
                    <span className="text-xs font-medium text-[hsl(var(--vault-muted))]">
                      {key === '(untitled)' ? 'Untitled' : truncateDocumentLabel(documentDisplayName(key))}
                    </span>
                  )}
                  <span className="text-[11px] text-[hsl(var(--vault-muted))]/60">
                    {mems.length} {mems.length === 1 ? 'fact' : 'facts'}
                  </span>
                </div>
                <div className="divide-y divide-[hsl(var(--border))]">
                  {mems.map(renderFactCard)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 sm:px-6 lg:px-8 py-2 divide-y divide-[hsl(var(--border))] w-full max-w-none">
            {visibleItems.map(renderFactCard)}
          </div>
        )}
      </ScrollArea>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-[hsl(var(--card))] border-border max-w-md p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-semibold">Delete knowledge fact?</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-[hsl(var(--vault-muted))] mt-2">
              This fact will be invalidated and excluded from future queries and consolidation.
              Linked observations may also be affected. This action is reversible (revert via API).
            </DialogDescription>
          </DialogHeader>
          {deleteTarget ? (
            <div className="rounded-md border border-border bg-[hsl(var(--canvas))] px-4 py-3 text-sm leading-relaxed max-h-[160px] overflow-y-auto">
              {deleteTarget.text}
            </div>
          ) : null}
          <DialogFooter className="gap-3 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              className="text-sm"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="text-sm"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? <Spinner className="mr-2" /> : null}
              Delete fact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
