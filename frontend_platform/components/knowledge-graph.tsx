'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Spinner } from './hindsight-icons'
import { MarkdownPreview } from './markdown-field'
import { WikiViewer } from './wiki-viewer'
import { MemoryGraphView } from './memory-graph-view'
import { cn } from '@/lib/utils'
import { GRAPH_NODE_COLORS, WIKI_GRAPH_COLORS } from '@/lib/workspace-colors'
import {
  buildWikiGraphFromBundle,
  splitWikiLinkMarkdown,
  stripOkfFrontmatter,
  type OkfWikiBundle,
  type WikiGraphNode,
} from '../../shared/lib/okf-wiki'
import type { GraphNode, GraphLink, LinkTypeCounts } from '../../shared/lib/bank-graph'

const CytoscapeGraphClient = dynamic(
  () => import('./cytoscape-graph-client').then((m) => m.CytoscapeGraphClient),
  { ssr: false, loading: () => <Spinner className="size-6" /> }
)

const LEGEND: { type: keyof typeof WIKI_GRAPH_COLORS; label: string }[] = [
  { type: 'source', label: 'Source' },
  { type: 'entity', label: 'Entity' },
  { type: 'index', label: 'Index' },
]

interface KnowledgeGraphProps {
  bankId: string
  bankLabel?: string
  userRole?: string
  onOpenDocument?: (documentId: string, chunkHint?: string | null) => void
  onSelectEntity?: (entityId: string, entityName: string) => void
}

function GraphPreviewBody({
  body,
  onNavigate,
}: {
  body: string
  onNavigate: (path: string) => void
}) {
  const parts = useMemo(() => splitWikiLinkMarkdown(body.slice(0, 8000)), [body])
  return (
    <div className="prose prose-sm max-w-none text-foreground">
      {parts.map((part, i) => {
        if (part.kind === 'link') {
          return (
            <button
              key={`${part.path}-${i}`}
              type="button"
              onClick={() => onNavigate(part.path)}
              className="text-[hsl(var(--vault-active))] underline underline-offset-2 hover:opacity-80 inline align-baseline not-prose text-sm"
            >
              {part.label}
            </button>
          )
        }
        if (!part.text.trim()) return null
        return (
          <div key={`t-${i}`} className="wiki-md-chunk">
            <MarkdownPreview source={part.text} />
          </div>
        )
      })}
    </div>
  )
}

export function KnowledgeGraph({
  bankId,
  bankLabel,
  userRole: _userRole,
  onOpenDocument,
  onSelectEntity,
}: KnowledgeGraphProps) {
  // Default to Memory Graph (native graph from /api/banks/:id/graph)
  const [mode, setMode] = useState<'memory' | 'entity' | 'wiki'>('memory')

  // Memory graph state
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([])
  const [graphLinks, setGraphLinks] = useState<GraphLink[]>([])
  const [graphTableRows, setGraphTableRows] = useState<{ id: string; text: string; date: string; entities: string[]; context: string }[]>([])
  const [graphLinkTypeCounts, setGraphLinkTypeCounts] = useState<LinkTypeCounts | undefined>()
  const [graphMeta, setGraphMeta] = useState<{ totalNodes: number; totalLinks: number; truncated: boolean } | undefined>()
  const [graphLoading, setGraphLoading] = useState(true)
  const [graphError, setGraphError] = useState<string | null>(null)

  // Entity co-occurrence graph state
  // ponytail: Hindsight API returns Cytoscape-ready shapes: { data: { id, label, ... } }
  const [entityGraphData, setEntityGraphData] = useState<{
    nodes: Record<string, unknown>[]
    edges: Record<string, unknown>[]
  } | null>(null)
  const [entityGraphLoading, setEntityGraphLoading] = useState(false)
  const [entityGraphError, setEntityGraphError] = useState<string | null>(null)
  const [entityMinCount, setEntityMinCount] = useState(2)
  const [entityTopN, setEntityTopN] = useState(30)

  // Wiki state
  const [wikiLoading, setWikiLoading] = useState(false)
  const [wikiError, setWikiError] = useState<string | null>(null)
  const [wikiBundle, setWikiBundle] = useState<OkfWikiBundle | null>(null)
  const [selected, setSelected] = useState<WikiGraphNode | null>(null)

  // Load memory graph on mount
  useEffect(() => {
    setGraphLoading(true)
    setGraphError(null)
    fetch(`/api/banks/${bankId}/graph?limit=500`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load graph (${r.status})`)
        return r.json()
      })
      .then((data) => {
        setGraphNodes(data.nodes ?? [])
        setGraphLinks(data.links ?? [])
        setGraphTableRows(data.tableRows ?? [])
        setGraphLinkTypeCounts(data.linkTypeCounts)
        setGraphMeta(data.meta)
      })
      .catch((e: Error) => setGraphError(e.message))
      .finally(() => setGraphLoading(false))
  }, [bankId])

  // Load entity co-occurrence graph on demand
  useEffect(() => {
    setEntityGraphData(null)
    setFocusId(null)
  }, [bankId, entityMinCount])

  useEffect(() => {
    if (mode !== 'entity') return
    if (entityGraphData) return
    setEntityGraphLoading(true)
    setEntityGraphError(null)
    fetch(`/api/banks/${bankId}/entities/graph?limit=200&minCount=${entityMinCount}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load entity graph (${r.status})`)
        return r.json()
      })
      .then((data) => {
        setEntityGraphData({
          nodes: data.nodes ?? [],
          edges: data.edges ?? [],
        })
      })
      .catch((e: Error) => setEntityGraphError(e.message))
      .finally(() => setEntityGraphLoading(false))
  }, [mode, bankId, entityGraphData, entityMinCount])

  // Load wiki on demand
  useEffect(() => {
    setWikiBundle(null)
    setSelected(null)
    setFocusId(null)
  }, [bankId])

  useEffect(() => {
    if (mode !== 'wiki') return
    if (wikiBundle) return
    setWikiLoading(true)
    setWikiError(null)
    const label = bankLabel ? encodeURIComponent(bankLabel) : ''
    const qs = label ? `?bankLabel=${label}` : ''
    fetch(`/api/banks/${bankId}/wiki${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load wiki (${r.status})`)
        return r.json()
      })
      .then((data: OkfWikiBundle) => setWikiBundle(data))
      .catch((e: Error) => setWikiError(e.message))
      .finally(() => setWikiLoading(false))
  }, [mode, bankId, bankLabel, wikiBundle])

  // ponytail: Hindsight API returns Cytoscape-ready shapes: { data: { id, label, ... } }
  const entityNodes: WikiGraphNode[] = useMemo(() => {
    if (!entityGraphData) return []
    const all = entityGraphData.nodes.map((n) => {
      const d = (n.data ?? n) as Record<string, unknown>
      return {
        id: String(d.id ?? ''),
        label: String(d.label ?? d.canonical_name ?? d.name ?? ''),
        type: 'entity' as const,
        val: Number(d.mentionCount ?? d.mention_count ?? 1),
        entityId: String(d.id ?? ''),
      }
    }).filter((n) => n.id)
    // Sort by mention count and take top N for cleaner visualization
    return all.sort((a, b) => (b.val ?? 1) - (a.val ?? 1)).slice(0, entityTopN)
  }, [entityGraphData, entityTopN])

  const entityNodeIds = useMemo(() => new Set(entityNodes.map((n) => n.id)), [entityNodes])

  const entityLinks: { source: string; target: string; type?: string; weight?: number }[] =
    useMemo(() => {
      if (!entityGraphData) return []
      return entityGraphData.edges.map((e) => {
        const d = (e.data ?? e) as Record<string, unknown>
        return {
          source: String(d.source ?? ''),
          target: String(d.target ?? ''),
          type: String(d.linkType ?? d.type ?? 'cooccurrence'),
          weight: Number(d.weight ?? d.cooccurrence_count ?? 1),
        }
      }).filter((l) => l.source && l.target && entityNodeIds.has(l.source) && entityNodeIds.has(l.target))
    }, [entityGraphData, entityNodeIds])

  const wikiGraph = useMemo(
    () => (wikiBundle ? buildWikiGraphFromBundle(wikiBundle) : { nodes: [], links: [] }),
    [wikiBundle]
  )

  const wikiNodes = wikiGraph.nodes
  const wikiLinks = wikiGraph.links

  const [focusId, setFocusId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const searchMatchIds = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.toLowerCase()
    const matches = new Set<string>()
    for (const n of wikiNodes) {
      if (n.label.toLowerCase().includes(q)) matches.add(n.id)
    }
    return matches.size > 0 ? matches : null
  }, [searchQuery, wikiNodes])

  const nodeByPath = useMemo(() => new Map(wikiNodes.map((n) => [n.id, n])), [wikiNodes])

  const activeId = focusId ?? hoverId

  const neighborIds = useMemo(() => {
    if (!activeId) return null
    const ids = new Set<string>([activeId])
    for (const l of wikiLinks) {
      if (l.source === activeId) ids.add(String(l.target))
      if (l.target === activeId) ids.add(String(l.source))
    }
    return ids
  }, [activeId, wikiLinks])

  const selectNode = useCallback((node: WikiGraphNode) => {
    setSelected(node)
    setFocusId(node.id)
  }, [])

  const navigateToPath = useCallback(
    (path: string) => {
      const node = nodeByPath.get(path)
      if (node) selectNode(node)
    },
    [nodeByPath, selectNode]
  )

  const selectedBody = useMemo(() => {
    if (!selected || !wikiBundle) return ''
    const raw = wikiBundle.files[selected.id]
    if (!raw) return ''
    return stripOkfFrontmatter(raw)
  }, [selected, wikiBundle])

  return (
    <section className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-1.5 border-b border-border bg-[hsl(var(--card))] sm:px-5 shrink-0">
        <div
          className="inline-flex rounded-md border border-border overflow-hidden"
          role="tablist"
          aria-label="Graph browser mode"
        >
          {(
            [
              ['memory', 'Memory Graph', 'Constellation view for bank shape, topology, and relationship types'],
              ['entity', 'Entities', 'Co-occurrence graph for entity clustering and navigation'],
              ['wiki', 'Wiki', 'Raw facts and recall traces for precise auditing'],
            ] as const
          ).map(([id, label, hint]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              title={hint}
              onClick={() => setMode(id)}
              className={cn(
                'h-9 px-3 text-xs font-medium',
                mode === id
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                  : 'text-[hsl(var(--vault-muted))] hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'memory' && !graphLoading && graphMeta ? (
          <span className="text-xs text-[hsl(var(--vault-muted))] tabular-nums">
            {graphMeta.totalNodes} nodes · {graphMeta.totalLinks} links
            {graphMeta.truncated ? ' (truncated)' : ''}
          </span>
        ) : null}

        {mode === 'entity' && entityNodes.length > 0 ? (
          <>
            <span className="text-xs text-[hsl(var(--vault-muted))] tabular-nums">
              {entityNodes.length} entities · {entityLinks.length} co-occurrences
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-[hsl(var(--vault-muted))]">Top</span>
              <input
                type="range"
                min={10}
                max={100}
                step={10}
                value={entityTopN}
                onChange={(e) => setEntityTopN(Number(e.target.value))}
                className="h-4 w-20 accent-[hsl(var(--vault-active))]"
              />
              <span className="text-xs tabular-nums text-[hsl(var(--vault-muted))]">{entityTopN}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-[hsl(var(--vault-muted))]">Min co-occurrences</span>
              <input
                type="range"
                min={1}
                max={10}
                value={entityMinCount}
                onChange={(e) => setEntityMinCount(Number(e.target.value))}
                className="h-4 w-20 accent-[hsl(var(--vault-active))]"
              />
              <span className="text-xs tabular-nums text-[hsl(var(--vault-muted))]">{entityMinCount}</span>
            </div>
          </>
        ) : null}

        {mode === 'wiki' && wikiNodes.length > 0 ? (
          <span className="text-xs text-[hsl(var(--vault-muted))] tabular-nums">
            {wikiNodes.length} nodes · {wikiLinks.length} links
          </span>
        ) : null}

        {mode === 'wiki' ? (
          <>
            <label htmlFor="wiki-graph-search" className="sr-only">Search graph</label>
              <input
                id="wiki-graph-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search…"
              className="h-9 w-36 text-xs rounded-md border border-border bg-[hsl(var(--canvas))] px-2 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--vault-active))]"
            />
          </>
        ) : null}
      </div>

      {/* Content */}
      {mode === 'memory' ? (
        <MemoryGraphView
          bankId={bankId}
          nodes={graphNodes}
          links={graphLinks}
          tableRows={graphTableRows}
          linkTypeCounts={graphLinkTypeCounts}
          meta={graphMeta}
          loading={graphLoading}
          error={graphError}
          onNodeClick={(n) => {
            if (n.documentId && onOpenDocument) onOpenDocument(n.documentId)
          }}
          onSelectEntity={onSelectEntity}
          layout="force"
          showControls
        />
      ) : mode === 'entity' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] flex-1 min-h-0 overflow-hidden">
          <div className="relative flex-1 min-h-0 h-full overflow-hidden bg-[hsl(var(--canvas))]">
            {entityGraphLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner className="size-6" />
              </div>
            ) : entityGraphError ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-[hsl(var(--error-fg))] px-4 text-center">
                {entityGraphError}
              </div>
            ) : entityNodes.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                <p className="text-sm text-[hsl(var(--vault-muted))]">No entity graph yet</p>
                <p className="text-xs text-[hsl(var(--vault-muted))] max-w-sm opacity-80">
                  Entities link automatically as facts are retained. Add team knowledge to see co-occurrence patterns.
                </p>
              </div>
            ) : (
              <>
                <div className="absolute inset-0">
                  <CytoscapeGraphClient
                    nodes={entityNodes}
                    links={entityLinks}
                    onNodeClick={(node) => {
                      if (node.entityId && onSelectEntity) onSelectEntity(node.entityId, node.label)
                    }}
                    onNodeHover={setHoverId}
                    onBackgroundClick={() => setFocusId(null)}
                    focusId={focusId}
                    hoverId={hoverId}
                    searchMatchIds={null}
                    activeId={null}
                    neighborIds={null}
                    layout="force"
                    showLabels
                  />
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-3 py-2 text-[11px] text-[hsl(var(--vault-muted))] bg-gradient-to-t from-[hsl(var(--canvas))] to-transparent">
                  <span className="tabular-nums">
                    {entityNodes.length} entities · {entityLinks.length} co-occurrences
                    {' · click entity to open'}
                  </span>
                  <span className="hidden sm:flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: GRAPH_NODE_COLORS.entity }} aria-hidden />
                      Entity
                    </span>
                  </span>
                </div>
              </>
            )}
          </div>
          <aside className="hidden lg:flex bg-[hsl(var(--canvas))] p-3 flex-col gap-2 min-h-0 overflow-y-auto border-l border-border">
            <p className="text-xs font-medium text-[hsl(var(--vault-muted))] uppercase tracking-widest">
              Co-occurrence
            </p>
            <p className="text-xs text-[hsl(var(--vault-muted))] leading-relaxed">
              Edges represent entities that appear together in the same fact. Thicker edges = more co-occurrences.
            </p>
            <div className="mt-2 text-xs text-[hsl(var(--vault-muted))] space-y-1">
              <p>Click an entity node to open its detail panel in Knowledge.</p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] flex-1 min-h-0 overflow-hidden">
          <div className="relative flex-1 min-h-0 h-full overflow-hidden bg-[hsl(var(--canvas))]">
            {wikiLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner className="size-6" />
              </div>
            ) : wikiError ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-[hsl(var(--error-fg))] px-4 text-center">
                {wikiError}
              </div>
            ) : wikiNodes.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                <p className="text-sm text-[hsl(var(--vault-muted))]">No wiki graph yet</p>
                <p className="text-xs text-[hsl(var(--vault-muted))] max-w-sm opacity-80">
                  Retain team sources and facts. Wiki pages and their links become the graph.
                </p>
              </div>
            ) : (
              <>
                <div className="absolute inset-0">
                  <CytoscapeGraphClient
                    nodes={wikiNodes}
                    links={wikiLinks}
                    onNodeClick={selectNode}
                    onNodeHover={setHoverId}
                    onBackgroundClick={() => { setSelected(null); setFocusId(null) }}
                    focusId={focusId}
                    hoverId={hoverId}
                    searchMatchIds={searchMatchIds}
                    activeId={activeId}
                    neighborIds={neighborIds}
                    layout="force"
                    showLabels
                  />
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-3 py-2 text-[11px] text-[hsl(var(--vault-muted))] bg-gradient-to-t from-[hsl(var(--canvas))] to-transparent">
                  <span className="tabular-nums">
                    {wikiNodes.length} nodes · {wikiLinks.length} links
                    {selected ? ' · click canvas to reset' : ''}
                  </span>
                  <span className="hidden sm:flex flex-wrap gap-2">
                    {LEGEND.map(({ type, label }) => (
                      <span key={type} className="inline-flex items-center gap-1">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: WIKI_GRAPH_COLORS[type] }}
                          aria-hidden
                        />
                        {label}
                      </span>
                    ))}
                  </span>
                </div>
              </>
            )}
          </div>

          <aside className="hidden lg:flex bg-[hsl(var(--canvas))] p-3 flex-col gap-2 min-h-0 overflow-y-auto border-l border-border">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[hsl(var(--vault-muted))] uppercase tracking-widest">
                Preview
              </p>
              {selected ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-[hsl(var(--vault-muted))]"
                  onClick={() => { setSelected(null); setFocusId(null) }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
            {selected ? (
              <>
                <div className="rounded-md border border-border bg-[hsl(var(--card))] px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                      style={{ backgroundColor: WIKI_GRAPH_COLORS[selected.type] }}
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium leading-snug">{selected.label}</p>
                      <p className="text-xs mt-1 capitalize text-[hsl(var(--vault-muted))]">
                        {selected.type}
                      </p>
                    </div>
                  </div>
                </div>
                {selectedBody ? (
                  <div className="min-h-0 overflow-y-auto pr-1">
                    <GraphPreviewBody body={selectedBody} onNavigate={navigateToPath} />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {selected.type === 'entity' && selected.entityId && onSelectEntity ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] text-xs"
                      onClick={() => onSelectEntity(selected.entityId!, selected.label)}
                    >
                      Open entity detail
                    </Button>
                  ) : null}
                  {selected.type === 'source' && selected.documentId && onOpenDocument ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] text-xs"
                      onClick={() => onOpenDocument(selected.documentId!)}
                    >
                      Open source
                    </Button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-xs text-[hsl(var(--vault-muted))] leading-relaxed">
                Click a node for preview.
              </p>
            )}
          </aside>
        </div>
      )}
    </section>
  )
}
