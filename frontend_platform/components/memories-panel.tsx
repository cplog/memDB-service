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

  return (
    <section className="flex flex-col flex-1 min-h-0">
      <div className="px-6 py-5 border-b bg-[hsl(var(--card))]">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-medium tracking-tight">Knowledge</h1>
            <p className="text-sm text-[hsl(var(--vault-muted))] mt-1">
              {teamLabel ?? bankId}
              {documentId ? ' · one document' : ` · ${total} facts`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-[hsl(var(--vault-muted))]"
            onClick={load}
            disabled={loading}
            aria-label="Refresh facts"
          >
            {loading ? <Spinner /> : 'Refresh'}
          </Button>
        </div>

        {documentId && onAddToDocument ? (
          <Button
            variant="secondary"
            size="sm"
            className="mt-4 text-sm w-full sm:w-auto"
            onClick={() => onAddToDocument(documentId)}
          >
            Add to this document
          </Button>
        ) : null}

        <div className="flex gap-3 mt-5">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Filter facts…"
            className="text-sm"
            aria-label="Filter facts"
          />
          <Button size="sm" className="px-4 shrink-0 text-sm" onClick={load} disabled={loading}>
            Filter
          </Button>
        </div>

        {items.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-4">
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
          </div>
        ) : null}
      </div>

      <ScrollArea className="flex-1 min-h-0 bg-[hsl(var(--canvas))]">
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner className="size-5" />
          </div>
        ) : error ? (
          <div className="px-5 py-8">
            <p className="text-[12px] text-[hsl(var(--error-fg))]">{error}</p>
            <Button variant="outline" size="sm" className="mt-3 min-h-[44px] text-[11px]" onClick={load}>
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
                  <Button size="sm" variant="secondary" className="min-h-[44px] text-[11px]" onClick={onUpload}>
                    Upload
                  </Button>
                ) : null}
                {onAddNote ? (
                  <Button variant="outline" size="sm" className="min-h-[44px] text-[11px]" onClick={onAddNote}>
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
                className="mt-4 min-h-[44px] text-[11px]"
                onClick={() => setTypeFilter(null)}
              >
                Show all types
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visibleItems.map((mem) => (
              <li key={mem.id} className="px-6 py-5 hover:bg-[hsl(var(--secondary))]/50 transition-colors">
                <p className="text-base leading-relaxed text-foreground">{mem.text ?? '(empty)'}</p>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  {mem.fact_type ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs capitalize font-medium px-2.5 py-0.5',
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
                        onClick={() =>
                          onSelectEntity(
                            `entity:${entity.toLowerCase().replace(/\s+/g, '-')}`,
                            entity
                          )
                        }
                        className="text-xs rounded-md px-2 py-1 bg-[hsl(var(--secondary))] text-[hsl(var(--vault-active))] hover:bg-[hsl(var(--accent))]/10 transition-colors"
                      >
                        {entity}
                      </button>
                    ) : (
                      <Badge key={entity} variant="secondary" className="text-xs font-normal">
                        {entity}
                      </Badge>
                    )
                  )}
                  {mem.document_id && onOpenDocument ? (
                    <button
                      type="button"
                      onClick={() => onOpenDocument(mem.document_id!)}
                      className="text-xs text-[hsl(var(--vault-active))] hover:underline truncate max-w-full text-left"
                    >
                      {truncateDocumentLabel(documentDisplayName(mem.document_id))}
                    </button>
                  ) : mem.document_id ? (
                    <span className="text-xs text-[hsl(var(--vault-muted))] truncate">
                      {truncateDocumentLabel(documentDisplayName(mem.document_id))}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="ml-auto text-xs text-[hsl(var(--vault-muted))] hover:text-[hsl(var(--error-fg))] shrink-0 transition-colors"
                    onClick={() => {
                      setDeleteTarget(mem)
                      setDeleteOpen(true)
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
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
