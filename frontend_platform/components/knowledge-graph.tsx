'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Spinner } from './hindsight-icons'
import { MarkdownPreview } from './markdown-field'
import { WikiViewer } from './wiki-viewer'
import { cn } from '@/lib/utils'
import { WIKI_GRAPH_COLORS } from '@/lib/workspace-colors'
import {
  buildWikiGraphFromBundle,
  splitWikiLinkMarkdown,
  stripOkfFrontmatter,
  type OkfWikiBundle,
  type WikiGraphNode,
} from '../../shared/lib/okf-wiki'

const NODE_COLORS: Record<string, string> = {
  source: WIKI_GRAPH_COLORS.source,
  entity: WIKI_GRAPH_COLORS.entity,
  index: WIKI_GRAPH_COLORS.index,
}

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

// Dynamic Sigma wrapper — loads only on client to avoid SSR WebGL errors
const SigmaGraphClient = dynamic(
  () => import('./sigma-graph-client').then((m) => m.SigmaGraphClient),
  { ssr: false, loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <Spinner className="size-6" />
    </div>
  )}
)

export function KnowledgeGraph({
  bankId,
  bankLabel,
  userRole: _userRole,
  onOpenDocument,
  onSelectEntity,
}: KnowledgeGraphProps) {
  const [mode, setMode] = useState<'wiki' | 'graph'>('wiki')
  const [wikiLoading, setWikiLoading] = useState(true)
  const [wikiError, setWikiError] = useState<string | null>(null)
  const [wikiBundle, setWikiBundle] = useState<OkfWikiBundle | null>(null)
  const [selected, setSelected] = useState<WikiGraphNode | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [fitToken, setFitToken] = useState(0)

  useEffect(() => {
    setWikiLoading(true)
    setWikiError(null)
    setWikiBundle(null)
    setSelected(null)
    setFocusId(null)
    setHoverId(null)
    const label = bankLabel ? encodeURIComponent(bankLabel) : ''
    const qs = label ? `?bankLabel=${label}` : ''
    fetch(`/api/banks/${bankId}/wiki${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Wiki load failed (${r.status})`)
        return r.json()
      })
      .then((data: OkfWikiBundle) => setWikiBundle(data))
      .catch((e: Error) => setWikiError(e.message))
      .finally(() => setWikiLoading(false))
  }, [bankId, bankLabel])

  const wikiGraph = useMemo(
    () => (wikiBundle ? buildWikiGraphFromBundle(wikiBundle) : { nodes: [], links: [] }),
    [wikiBundle]
  )

  const nodes = wikiGraph.nodes
  const links = wikiGraph.links

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return nodes.filter((n) => n.label.toLowerCase().includes(q))
  }, [nodes, searchQuery])

  const searchMatchIds = useMemo(() => {
    if (!searchQuery.trim()) return null
    return new Set(filteredNodes.map((n) => n.id))
  }, [filteredNodes, searchQuery])

  const nodeByPath = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  const activeId = focusId ?? hoverId

  const neighborIds = useMemo(() => {
    if (!activeId) return null
    const ids = new Set<string>([activeId])
    for (const l of links) {
      if (l.source === activeId) ids.add(String(l.target))
      if (l.target === activeId) ids.add(String(l.source))
    }
    return ids
  }, [activeId, links])

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

  const graphEmpty = !wikiLoading && !wikiError && nodes.length === 0
  const graphBusy = wikiLoading && mode === 'graph'

  const showFullGraph = useCallback(() => {
    setFocusId(null)
    setSelected(null)
    setHoverId(null)
    setFitToken((t) => t + 1)
  }, [])

  return (
    <section className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-[hsl(var(--card))]">
        <div className="min-w-0 flex-1">
          <h1 className="text-[13px] font-medium tracking-tight">Knowledge browser</h1>
          <p className="text-xs text-[hsl(var(--vault-muted))] mt-0.5">
            Read linked wiki pages or explore the visual graph
          </p>
        </div>
        <div
          className="inline-flex rounded-sm border border-border overflow-hidden"
          role="tablist"
          aria-label="Knowledge browser mode"
        >
          {(
            [
              ['wiki', 'Wiki'],
              ['graph', 'Graph'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={cn(
                'min-h-[44px] px-4 text-xs font-medium',
                mode === id
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                  : 'text-[hsl(var(--vault-muted))] hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'wiki' ? (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <WikiViewer
            bundle={wikiBundle}
            loading={wikiLoading}
            error={wikiError}
            onOpenDocument={onOpenDocument}
            onOpenEntity={onSelectEntity}
          />
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-2 border-b border-border bg-[hsl(var(--vault))]/40">
            {LEGEND.map(({ type, label }) => (
              <span key={type} className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--vault-muted))]">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: WIKI_GRAPH_COLORS[type] }}
                  aria-hidden
                />
                {label}
              </span>
            ))}
            <div className="w-px h-3 bg-border" aria-hidden />
            <label htmlFor="graph-search" className="sr-only">Find node</label>
            <input
              id="graph-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find node…"
              className="w-28 text-xs rounded-md border border-border bg-[hsl(var(--canvas))] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--vault-active))]"
            />
            {nodes.length > 0 ? (
              <span className="text-xs text-[hsl(var(--vault-muted))] tabular-nums">
                {nodes.length} pages · {links.length} links
              </span>
            ) : null}
            {selected ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="ml-auto text-xs shrink-0"
                onClick={showFullGraph}
              >
                Show full graph
              </Button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,34%)] flex-1 min-h-0 overflow-hidden">
            <div className="relative min-h-0 overflow-hidden border-b lg:border-b-0 lg:border-r border-border bg-[hsl(var(--canvas))]">
              {graphBusy ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner className="size-6" />
                </div>
              ) : wikiError ? (
                <div className="absolute inset-0 flex items-center justify-center text-[12px] text-[hsl(var(--error-fg))] px-4 text-center">
                  {wikiError}
                </div>
              ) : graphEmpty ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                  <p className="text-[12px] text-[hsl(var(--vault-muted))]">No graph yet</p>
                  <p className="text-xs text-[hsl(var(--vault-muted))] max-w-xs opacity-80">
                    Retain team sources and facts. Wiki pages and their links become the graph.
                  </p>
                </div>
              ) : (
                <SigmaGraphClient
                  nodes={nodes}
                  links={links}
                  onNodeClick={selectNode}
                  onNodeHover={(id) => setHoverId(id)}
                  onBackgroundClick={showFullGraph}
                  focusId={focusId}
                  hoverId={hoverId}
                  searchMatchIds={searchMatchIds}
                  activeId={activeId}
                  neighborIds={neighborIds}
                  fitToken={fitToken}
                />
              )}
            </div>

            <aside className="bg-[hsl(var(--canvas))] p-4 flex flex-col gap-3 min-h-0 overflow-y-auto border-l border-border">
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
                    onClick={showFullGraph}
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
                <p className="text-sm text-[hsl(var(--vault-muted))] leading-relaxed">
                  Click a node to preview its page and highlight neighbors. Click empty canvas or{' '}
                  <span className="font-medium text-foreground">Show full graph</span> to zoom back out.
                </p>
              )}
            </aside>
          </div>
        </div>
      )}
    </section>
  )
}
