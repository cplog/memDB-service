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
import { MemoryTable, type TableRow } from './memory-table'
import { MemoryTimeline } from './memory-timeline'
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

type ViewMode = 'list' | 'table' | 'timeline'
type FactType = 'all' | 'world' | 'experience' | 'observation'

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
        className="text-xs text-[hsl(var(--vault-muted))] hover:text-[hsl(var(--vault-active))] mt-1"
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  )
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
  const [factType, setFactType] = useState<FactType>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [deleteTarget, setDeleteTarget] = useState<MemoryRow | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Graph data for table view
  const [tableRows, setTableRows] = useState<TableRow[]>([])
  const [graphLoading, setGraphLoading] = useState(false)

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
      factType === 'all'
        ? items
        : items.filter((m) => (m.fact_type ?? '').toLowerCase() === factType),
    [items, factType]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        bankId,
        limit: '100',
        offset: '0',
      })
      if (documentId) params.set('documentId', documentId)
      if (filter.trim()) params.set('q', filter.trim())
      if (factType !== 'all') params.set('type', factType)
      const res = await fetch(`/api/memories?${params}`)
      if (!res.ok) throw new Error(`Failed to load facts (${res.status})`)
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
      setError(e instanceof Error ? e.message : 'Failed to load facts')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [bankId, documentId, filter, factType])

  const loadGraph = useCallback(async () => {
    setGraphLoading(true)
    try {
      const params = new URLSearchParams({ limit: '500' })
      if (factType !== 'all') params.set('type', factType)
      const res = await fetch(`/api/banks/${bankId}/graph?${params}`)
      if (!res.ok) throw new Error(`Graph load failed (${res.status})`)
      const data = await res.json()
      setTableRows(data.tableRows ?? [])
    } catch {
      // Silent fail — graph view will show empty state
    } finally {
      setGraphLoading(false)
    }
  }, [bankId, factType])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (viewMode === 'table') {
      loadGraph()
    }
  }, [viewMode, loadGraph])

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
      setError(e instanceof Error ? e.message : 'Failed to delete fact')
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
                className="text-[11px] rounded-full px-2.5 py-0.5 border border-[hsl(var(--accent))]/20 bg-[hsl(var(--accent))]/5 text-[hsl(var(--vault-active))] hover:bg-[hsl(var(--accent))]/15 hover:border-[hsl(var(--accent))]/40 cursor-pointer"
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
            className="text-[11px] text-[hsl(var(--vault-muted))] hover:text-[hsl(var(--error-fg))] shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
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
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-1.5 border-b bg-[hsl(var(--card))] sm:px-5">
        {/* Fact type tabs */}
        <div className="flex items-center gap-1">
          {([
            { key: 'all' as const, label: 'All', count: items.length },
            { key: 'world' as const, label: 'World', count: typeCounts.world ?? 0 },
            { key: 'experience' as const, label: 'Experience', count: typeCounts.experience ?? 0 },
            { key: 'observation' as const, label: 'Observations', count: typeCounts.observation ?? 0 },
          ]).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFactType(tab.key)}
              className={cn(
                'text-xs rounded-md px-2.5 py-1 border font-medium',
                factType === tab.key
                  ? 'bg-[hsl(var(--accent))]/10 border-[hsl(var(--accent))] text-foreground'
                  : 'bg-transparent border-border text-[hsl(var(--vault-muted))] hover:bg-[hsl(var(--secondary))]'
              )}
            >
              {tab.label} {tab.count > 0 ? tab.count : ''}
            </button>
          ))}
        </div>

        <span className="w-px h-4 bg-border mx-1 shrink-0" aria-hidden />

        {/* View switcher */}
        <div className="flex items-center gap-1">
          {([
            { key: 'list' as const, label: 'List' },
            { key: 'table' as const, label: 'Table' },
            { key: 'timeline' as const, label: 'Timeline' },
          ]).map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setViewMode(v.key)}
              className={cn(
                'text-xs rounded-md px-2 py-1 font-medium',
                viewMode === v.key
                  ? 'bg-[hsl(var(--secondary))] text-foreground'
                  : 'text-[hsl(var(--vault-muted))] hover:bg-[hsl(var(--secondary))]/50'
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-1 min-w-[10rem] max-w-xs ml-2">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Filter facts…"
            className="text-sm h-8"
            aria-label="Filter facts"
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-sm text-[hsl(var(--vault-muted))] ml-auto min-h-8"
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
            className="text-sm h-8"
            onClick={() => onAddToDocument(documentId)}
          >
            Add to this document
          </Button>
        </div>
      ) : null}

      {/* View content */}
      {viewMode === 'list' ? (
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
                No {factType !== 'all' ? `${factType} ` : ''}facts match this filter.
              </p>
              {factType !== 'all' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 min-h-[44px] text-xs"
                  onClick={() => setFactType('all')}
                >
                  Show all types
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="px-4 sm:px-6 lg:px-8 py-2 divide-y divide-[hsl(var(--border))] w-full max-w-none">
              {visibleItems.map(renderFactCard)}
            </div>
          )}
        </ScrollArea>
      ) : viewMode === 'table' ? (
        <MemoryTable rows={tableRows} loading={graphLoading} />
      ) : (
        <MemoryTimeline
          bankId={bankId}
          onSelectEntity={onSelectEntity}
          onOpenDocument={onOpenDocument}
          embedded
        />
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-[hsl(var(--card))] border-border max-w-md p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-semibold">Delete this fact?</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-[hsl(var(--vault-muted))] mt-2">
              This fact will be hidden from future queries. Linked observations may also be affected.
              If you need to restore it, contact an admin.
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
