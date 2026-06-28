'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Spinner } from './hindsight-icons'
import { factTypeStyle, GRAPH_LINK_TYPE_META, GRAPH_NODE_TYPE_META } from '@/lib/workspace-colors'
import { cn } from '@/lib/utils'
import type { GraphNode, GraphLink, LinkTypeCounts } from '../../shared/lib/bank-graph'
import type { WikiGraphNode } from '../../shared/lib/okf-wiki'

const CytoscapeGraphClient = dynamic(
  () => import('./cytoscape-graph-client').then((m) => m.CytoscapeGraphClient),
  { ssr: false, loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <Spinner className="size-6" />
    </div>
  )}
)

/** Map GraphNode to display node for Sigma */
function toDisplayNode(n: GraphNode): WikiGraphNode & { factType?: string; fullText?: string } {
  const typeMap: Record<string, 'index' | 'source' | 'entity'> = {
    entity: 'entity',
    memory: 'source',
    bank: 'index',
  }
  return {
    id: n.id,
    label: n.label,
    type: typeMap[n.type] ?? 'source',
    documentId: n.documentId,
    val: n.val ?? 4,
    factType: n.factType,
    fullText: n.fullText,
  }
}

function formatGraphDate(iso?: string): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function GraphNodeCard({
  node,
  linkCount,
  tableRow,
  onSelectEntity,
}: {
  node: GraphNode
  linkCount: number
  tableRow?: { text: string; date: string; entities: string[]; context: string }
  onSelectEntity?: (entityId: string, entityName: string) => void
}) {
  const style = factTypeStyle(node.factType)
  const text = node.fullText ?? tableRow?.text ?? node.label

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 backdrop-blur-sm shadow-lg p-3 max-w-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('text-[10px] font-semibold uppercase tracking-wider', style.badge, 'border rounded px-1.5 py-0.5')}>
          {style.label}
        </span>
        <span className="text-[10px] text-[hsl(var(--vault-muted))] tabular-nums ml-auto">
          {linkCount} links
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-foreground line-clamp-4">{text}</p>
      {tableRow?.date ? (
        <p className="text-[10px] text-[hsl(var(--vault-muted))] mt-2 uppercase tracking-wide">
          Mentioned · {formatGraphDate(tableRow.date)}
        </p>
      ) : null}
      {tableRow?.entities?.length ? (
        <div className="flex flex-wrap gap-1 mt-2">
          {tableRow.entities.map((e) =>
            onSelectEntity ? (
              <button
                key={e}
                type="button"
                onClick={() => onSelectEntity(e.toLowerCase().replace(/\s+/g, '-'), e)}
                className="text-[10px] rounded-full border border-[hsl(var(--border))] px-2 py-0.5 hover:bg-[hsl(var(--secondary))] transition-colors"
              >
                {e}
              </button>
            ) : (
              <span key={e} className="text-[10px] rounded-full border border-[hsl(var(--border))] px-2 py-0.5">
                {e}
              </span>
            )
          )}
        </div>
      ) : null}
    </div>
  )
}

interface MemoryGraphViewProps {
  bankId: string
  nodes: GraphNode[]
  links: GraphLink[]
  tableRows?: { id: string; text: string; date: string; entities: string[]; context: string }[]
  linkTypeCounts?: LinkTypeCounts
  meta?: { totalNodes: number; totalLinks: number; truncated: boolean }
  loading?: boolean
  error?: string | null
  onNodeClick?: (node: GraphNode) => void
  onSelectEntity?: (entityId: string, entityName: string) => void
  layout?: 'force' | 'cluster' | 'spiral' | 'constellation'
  showControls?: boolean
  compact?: boolean
}

export function MemoryGraphView({
  bankId,
  nodes,
  links,
  tableRows,
  linkTypeCounts,
  meta,
  loading,
  error,
  onNodeClick,
  onSelectEntity,
  layout = 'constellation',
  showControls = true,
  compact = false,
}: MemoryGraphViewProps) {
  const [activeLayout, setActiveLayout] = useState<'force' | 'cluster' | 'spiral'>('force')
  const [maxNodes, setMaxNodes] = useState(() => Math.min(nodes.length || 50, 50))
  const [showLabels, setShowLabels] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [linkTypesVisible, setLinkTypesVisible] = useState<Set<string>>(
    () => new Set(['semantic', 'entity', 'causal'])
  )
  const [focusId, setFocusId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [fitToken, setFitToken] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [profile, setProfile] = useState<{ name?: string; disposition?: { empathy?: number; literalism?: number; skepticism?: number }; mission?: string } | null>(null)

  // Fetch tags and profile
  useEffect(() => {
    Promise.all([
      fetch(`/api/banks/${bankId}/tags?limit=100`).then((r) => r.ok ? r.json() : { tags: [] }),
      fetch(`/api/banks/${bankId}/profile`).then((r) => r.ok ? r.json() : null),
    ]).then(([tagData, profileData]) => {
      setTags((tagData.tags ?? tagData ?? []).slice(0, 100))
      setProfile(profileData)
    }).catch(() => {})
  }, [bankId])

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const tableRowById = useMemo(
    () => new Map((tableRows ?? []).map((r) => [r.id, r])),
    [tableRows]
  )

  const displayNodes = useMemo(() => {
    return nodes.slice(0, maxNodes)
  }, [nodes, maxNodes])

  const nodeIds = useMemo(() => new Set(displayNodes.map((n) => n.id)), [displayNodes])

  const displayLinks = useMemo(() => {
    return links.filter((l) => {
      if (!nodeIds.has(l.source) || !nodeIds.has(l.target)) return false
      const t = l.type.toLowerCase()
      if (t === 'semantic' && !linkTypesVisible.has('semantic')) return false
      if (t === 'temporal' && !linkTypesVisible.has('temporal')) return false
      if (t === 'entity' && !linkTypesVisible.has('entity')) return false
      if (t === 'causal' && !linkTypesVisible.has('causal')) return false
      return true
    })
  }, [links, nodeIds, linkTypesVisible])

  const searchMatchIds = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.toLowerCase()
    const matches = new Set<string>()
    for (const n of displayNodes) {
      if (n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) {
        matches.add(n.id)
      }
    }
    return matches.size > 0 ? matches : null
  }, [searchQuery, displayNodes])

  const handleNodeClick = useCallback((node: { id: string; label: string }) => {
    setFocusId(node.id)
    onNodeClick?.(node as GraphNode)
  }, [onNodeClick])

  const handleNodeHover = useCallback((id: string | null) => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = window.setTimeout(() => setHoverId(id), id ? 48 : 0)
  }, [])

  useEffect(() => () => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current)
  }, [])

  const linkCountById = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of displayLinks) {
      counts.set(l.source, (counts.get(l.source) ?? 0) + 1)
      counts.set(l.target, (counts.get(l.target) ?? 0) + 1)
    }
    return counts
  }, [displayLinks])

  const toggleLinkType = useCallback((type: string) => {
    setLinkTypesVisible((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const activeId = focusId ?? hoverId
  const neighborIds = useMemo(() => {
    if (!activeId) return null
    const neighbors = new Set<string>()
    for (const l of displayLinks) {
      if (l.source === activeId) neighbors.add(l.target)
      if (l.target === activeId) neighbors.add(l.source)
    }
    return neighbors
  }, [activeId, displayLinks])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-[12px] text-[hsl(var(--error-fg))]">{error}</p>
          <Button variant="outline" size="sm" className="mt-3 text-xs">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[12px] text-[hsl(var(--vault-muted))]">No graph data to display.</p>
      </div>
    )
  }

  const counts = linkTypeCounts ?? { semantic: 0, temporal: 0, entity: 0, causal: 0, other: 0 }
  const cardNode = activeId ? nodeById.get(activeId) : null

  return (
    <div className={cn('flex flex-col min-h-0', compact ? 'flex-1' : 'flex-1 min-h-0')}>
      {showControls && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-1.5 border-b bg-[hsl(var(--card))] sm:px-5">

          <label htmlFor="graph-search" className="sr-only">Search graph</label>
          <input
            id="graph-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search…"
            className="h-8 w-36 text-xs rounded-md border border-border bg-[hsl(var(--canvas))] px-2 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--vault-active))]"
          />

          <button
            type="button"
            onClick={() => setShowLabels((v) => !v)}
            className={cn(
              'text-xs rounded-md px-2 py-0.5 border transition-colors font-medium',
              showLabels
                ? 'bg-[hsl(var(--accent))]/10 border-[hsl(var(--accent))] text-foreground'
                : 'bg-transparent border-border text-[hsl(var(--vault-muted))]'
            )}
          >
            Labels {showLabels ? 'on' : 'off'}
          </button>

          {focusId ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={() => { setFocusId(null); setHoverId(null); setFitToken((t) => t + 1) }}
            >
              Reset view
            </Button>
          ) : null}

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-[hsl(var(--vault-muted))] hover:text-foreground ml-auto"
          >
            {showAdvanced ? 'Less' : 'More'} controls
          </button>

          {showAdvanced ? (
            <>
              <div className="flex items-center gap-1 w-full sm:w-auto">
                <span className="text-xs text-[hsl(var(--vault-muted))] mr-1">Layout</span>
                {(['force', 'cluster', 'spiral'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setActiveLayout(l)}
                    className={cn(
                      'text-xs rounded-md px-2 py-0.5 border transition-colors font-medium capitalize',
                      activeLayout === l
                        ? 'bg-[hsl(var(--accent))]/10 border-[hsl(var(--accent))] text-foreground'
                        : 'bg-transparent border-border text-[hsl(var(--vault-muted))] hover:bg-[hsl(var(--secondary))]'
                    )}
                  >
                    {l === 'force' ? 'Force' : l === 'cluster' ? 'Cluster' : 'Spiral'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-[hsl(var(--vault-muted))] mr-1">Max nodes</span>
                <input
                  type="range"
                  min={10}
                  max={Math.max(nodes.length, 10)}
                  value={maxNodes}
                  onChange={(e) => setMaxNodes(Number(e.target.value))}
                  className="h-4 w-20 accent-[hsl(var(--vault-active))]"
                />
                <span className="text-xs tabular-nums text-[hsl(var(--vault-muted))]">
                  {displayNodes.length}/{nodes.length}
                </span>
              </div>
            </>
          ) : null}

          <span className={cn('text-xs tabular-nums text-[hsl(var(--vault-muted))]', showAdvanced && 'w-full sm:w-auto sm:ml-auto')}>
            {displayNodes.length} nodes · {displayLinks.length} links
            {meta?.truncated ? ' (truncated)' : ''}
          </span>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 relative min-h-0 bg-[hsl(var(--canvas))]">
          <CytoscapeGraphClient
            nodes={displayNodes.map(toDisplayNode)}
            links={displayLinks}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            focusId={focusId}
            hoverId={hoverId}
            searchMatchIds={searchMatchIds}
            activeId={activeId}
            neighborIds={neighborIds}
            fitToken={fitToken}
            layout={activeLayout}
            showLabels={showLabels}
            linkTypesVisible={linkTypesVisible}
          />

          {cardNode ? (
            <div className="absolute bottom-3 left-3 z-10 pointer-events-auto max-w-[min(100%-1.5rem,22rem)]">
              <GraphNodeCard
                node={cardNode}
                linkCount={linkCountById.get(cardNode.id) ?? 0}
                tableRow={tableRowById.get(cardNode.id)}
                onSelectEntity={onSelectEntity}
              />
            </div>
          ) : null}

          <div className="pointer-events-none absolute top-3 left-3 text-xs text-[hsl(var(--vault-muted))]">
            Scroll to zoom · drag to pan · hover to explore
          </div>
        </div>

        {showControls && (
          <div className="w-52 shrink-0 border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 overflow-y-auto hidden md:block">
            <p className="text-[11px] text-[hsl(var(--vault-muted))] leading-relaxed mb-3">
              Click a node to preview. Toggle link types below to reduce clutter.
            </p>

            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--vault-muted))] mb-2">
              Link types
            </h4>
            <div className="space-y-1.5">
              {GRAPH_LINK_TYPE_META.map((lt) => (
                <button
                  key={lt.key}
                  type="button"
                  onClick={() => toggleLinkType(lt.key)}
                  className={cn(
                    'flex items-center gap-2 w-full text-left text-xs rounded px-1.5 py-1 transition-colors',
                    linkTypesVisible.has(lt.key)
                      ? 'opacity-100'
                      : 'opacity-40'
                  )}
                >
                  <span
                    className="inline-block size-2 rounded-full shrink-0"
                    style={{ backgroundColor: lt.color }}
                  />
                  <span className="flex-1">{lt.label}</span>
                  <span className="tabular-nums text-[hsl(var(--vault-muted))]">
                    {counts[lt.key as keyof typeof counts] ?? 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-[hsl(var(--border))]">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--vault-muted))] mb-2">
                Node types
              </h4>
              <div className="space-y-1.5">
                {GRAPH_NODE_TYPE_META.map((nt) => (
                  <div key={nt.key} className="flex items-center gap-2 text-xs px-1.5 py-0.5">
                    <span
                      className="inline-block size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: nt.color }}
                    />
                    <span>{nt.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[hsl(var(--border))]">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--vault-muted))] mb-2">
                Tags
              </h4>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {tags.length === 0 ? (
                  <span className="text-[11px] text-[hsl(var(--vault-muted))] italic">No tags</span>
                ) : (
                  tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-0.5 text-[hsl(var(--vault-muted))]"
                    >
                      {t}
                    </span>
                  ))
                )}
              </div>
            </div>

            {profile ? (
              <div className="mt-4 pt-3 border-t border-[hsl(var(--border))]">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--vault-muted))] mb-2">
                  Bank
                </h4>
                <div className="text-xs space-y-2">
                  {profile.name ? (
                    <p className="font-medium text-foreground text-[13px]">{profile.name}</p>
                  ) : null}
                  {profile.mission ? (
                    <p className="text-[11px] text-[hsl(var(--vault-muted))] leading-relaxed line-clamp-3">
                      {profile.mission}
                    </p>
                  ) : null}
                  {profile.disposition ? (
                    <div className="flex gap-2 text-[10px] text-[hsl(var(--vault-muted))]">
                      {profile.disposition.empathy != null ? (
                        <span>Empathy {profile.disposition.empathy}/5</span>
                      ) : null}
                      {profile.disposition.literalism != null ? (
                        <span>Literal {profile.disposition.literalism}/5</span>
                      ) : null}
                      {profile.disposition.skepticism != null ? (
                        <span>Skepticism {profile.disposition.skepticism}/5</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-4 pt-3 border-t border-[hsl(var(--border))]">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--vault-muted))] mb-2">
                Stats
              </h4>
              <dl className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <dt className="text-[hsl(var(--vault-muted))]">Total nodes</dt>
                  <dd className="tabular-nums">{meta?.totalNodes ?? nodes.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[hsl(var(--vault-muted))]">Total links</dt>
                  <dd className="tabular-nums">{meta?.totalLinks ?? links.length}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
