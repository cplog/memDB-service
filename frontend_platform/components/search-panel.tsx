'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from './hindsight-icons'
import { MarkdownPreview } from './markdown-field'
import { cn } from '@/lib/utils'
import { documentDisplayName, truncateDocumentLabel } from '@/lib/document-display'
import { factTypeStyle } from '@/lib/workspace-colors'
import { ScenarioField } from './scenario-field'

interface RecallMemory {
  id?: string
  content?: string
  score?: number
  type?: string | null
  documentId?: string | null
  chunkId?: string | null
  chunkText?: string | null
  chunkTruncated?: boolean
  entities?: string[]
  sourceFacts?: RecallMemory[]
}

interface ReflectFact {
  id?: string | null
  text: string
  type?: string | null
  context?: string | null
  occurred_start?: string | null
}

interface ReflectMentalModel {
  id?: string | null
  text?: string | null
  context?: string | null
}

interface ReflectDirective {
  id?: string | null
  name?: string | null
  content?: string | null
}

interface ReflectBasedOn {
  memories: ReflectFact[]
  mentalModels: ReflectMentalModel[]
  directives: ReflectDirective[]
  usage?: { total_tokens?: number; input_tokens?: number; output_tokens?: number }
}

function TypeBadge({ type }: { type?: string | null }) {
  if (!type) return null
  const style = factTypeStyle(type)
  return (
    <Badge
      variant="outline"
      className={cn('text-xs capitalize font-normal border shrink-0', style.badge)}
    >
      <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1.5', style.dot)} aria-hidden />
      {style.label}
    </Badge>
  )
}

function ReflectProvenance({ basedOn }: { basedOn: ReflectBasedOn }) {
  const total =
    basedOn.memories.length + basedOn.mentalModels.length + basedOn.directives.length
  if (total === 0) return null

  return (
    <div className="rounded-sm border border-border bg-[hsl(var(--canvas))] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-[hsl(var(--vault-muted))] uppercase tracking-widest">
          Based on · {total}
        </p>
        {basedOn.usage?.total_tokens ? (
          <span className="text-xs text-[hsl(var(--vault-muted))] tabular-nums">
            {basedOn.usage.total_tokens.toLocaleString()} tokens
          </span>
        ) : null}
      </div>

      {basedOn.mentalModels.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-[hsl(var(--vault-muted))] mb-2">
            Mental models · {basedOn.mentalModels.length}
          </p>
          <ul className="space-y-2">
            {basedOn.mentalModels.map((m, i) => (
              <li key={m.id ?? i} className="text-[12px] leading-relaxed pl-2 border-l-2 border-[hsl(var(--vault-border))]">
                <div className="flex flex-wrap items-start gap-2">
                  <TypeBadge type="mental_model" />
                  <span>{m.text ?? '(empty)'}</span>
                </div>
                {m.context ? (
                  <p className="text-xs text-[hsl(var(--vault-muted))] mt-1">{m.context}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {basedOn.memories.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-[hsl(var(--vault-muted))] mb-2">
            Memories · {basedOn.memories.length}
          </p>
          <ul className="space-y-2">
            {basedOn.memories.map((f, i) => (
              <li key={f.id ?? i} className="text-[12px] leading-relaxed">
                <div className="flex flex-wrap items-start gap-2">
                  <TypeBadge type={f.type} />
                  <span>{f.text}</span>
                </div>
                {f.context ? (
                  <p className="text-xs text-[hsl(var(--vault-muted))] mt-1 ml-0">{f.context}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {basedOn.directives.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-[hsl(var(--vault-muted))] mb-2">
            Directives · {basedOn.directives.length}
          </p>
          <ul className="space-y-2">
            {basedOn.directives.map((d, i) => (
              <li key={d.id ?? i} className="text-[12px] leading-relaxed pl-2 border-l-2 border-[hsl(var(--vault-border))]">
                <div className="flex flex-wrap items-center gap-2">
                  <TypeBadge type="directive" />
                  {d.name ? (
                    <span className="text-xs font-medium">{d.name}</span>
                  ) : null}
                </div>
                {d.content ? (
                  <p className="text-xs text-[hsl(var(--vault-muted))] mt-1 whitespace-pre-wrap">
                    {d.content}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

interface SearchPanelProps {
  bankId: string
  teamLabel?: string
  canManagePlaybooks?: boolean
  onOpenDocument?: (documentId: string) => void
  onBrowseSources?: () => void
}

function slugPlaybookId(query: string): string {
  return (
    query
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'playbook'
  )
}

function scoreLabel(score?: number): string {
  if (score == null) return 'Match'
  if (score >= 0.7) return 'High'
  if (score >= 0.4) return 'Medium'
  return 'Low'
}

function scoreTone(score?: number) {
  if (score == null) return 'bg-[hsl(var(--secondary))] text-[hsl(var(--vault-muted))] border-border'
  if (score >= 0.7) return 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success-fg))] border-[hsl(var(--success-border))]'
  if (score >= 0.4) return 'bg-[hsl(var(--accent))]/50 text-[hsl(var(--vault-active))] border-border'
  return 'bg-[hsl(var(--secondary))] text-[hsl(var(--vault-muted))] border-border'
}

function RecallResultCard({
  memory,
  onOpenDocument,
  expandedDocs,
  onToggleDocExpand,
}: {
  memory: RecallMemory
  onOpenDocument?: (documentId: string) => void
  expandedDocs: Set<string>
  onToggleDocExpand: (key: string) => void
}) {
  const key = memory.id ?? memory.content ?? ''
  const showChunk = expandedDocs.has(`chunk:${key}`)
  const showSources = expandedDocs.has(`sources:${key}`)

  return (
    <li className="rounded-sm border border-border bg-[hsl(var(--canvas))] px-3 py-3">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <Badge
          variant="outline"
          className={cn('text-xs font-normal border', scoreTone(memory.score))}
          title={scoreLabel(memory.score)}
        >
          {memory.score != null ? `${scoreLabel(memory.score)} ${memory.score.toFixed(2)}` : 'Match'}
        </Badge>
        {memory.type ? (
          <Badge
            variant="outline"
            className={cn(
              'text-xs capitalize font-normal border',
              factTypeStyle(memory.type).badge
            )}
          >
            {memory.type}
          </Badge>
        ) : null}
      </div>
      <p className="text-[13px] leading-relaxed">{memory.content}</p>

      {memory.entities?.length ? (
        <div className="flex flex-wrap gap-1 mt-2">
          {memory.entities.map((e) => (
            <Badge key={e} variant="secondary" className="text-xs font-normal">
              {e}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mt-2">
        {memory.documentId && onOpenDocument ? (
          <button
            type="button"
            className="text-xs text-[hsl(var(--vault-active))] hover:underline min-h-[44px] flex items-center"
            onClick={() => onOpenDocument(memory.documentId!)}
          >
            {truncateDocumentLabel(documentDisplayName(memory.documentId))}
          </button>
        ) : null}
        {memory.chunkText ? (
          <button
            type="button"
            className="text-xs text-[hsl(var(--vault-muted))] hover:text-[hsl(var(--vault-active))] min-h-[44px]"
            onClick={() => onToggleDocExpand(`chunk:${key}`)}
            aria-expanded={showChunk}
          >
            {showChunk ? 'Hide context' : 'Show context'}
          </button>
        ) : null}
        {memory.type === 'observation' && memory.sourceFacts?.length ? (
          <button
            type="button"
            className="text-xs text-[hsl(var(--vault-muted))] hover:text-[hsl(var(--vault-active))] min-h-[44px]"
            onClick={() => onToggleDocExpand(`sources:${key}`)}
            aria-expanded={showSources}
          >
            {showSources ? 'Hide evidence' : `Evidence (${memory.sourceFacts.length})`}
          </button>
        ) : null}
      </div>

      {showChunk && memory.chunkText ? (
        <blockquote className="mt-2 pl-2 border-l-2 border-[hsl(var(--vault-active))]/40 text-xs text-[hsl(var(--vault-muted))] leading-relaxed whitespace-pre-wrap">
          {memory.chunkText}
          {memory.chunkTruncated ? (
            <span className="block mt-1 text-xs opacity-70">Truncated</span>
          ) : null}
        </blockquote>
      ) : null}

      {showSources && memory.sourceFacts?.length ? (
        <ul className="mt-2 space-y-1.5 pl-2 border-l border-border">
          {memory.sourceFacts.map((sf, i) => (
            <li key={sf.id ?? i} className="text-xs text-[hsl(var(--vault-muted))]">
              {sf.content}
              {sf.documentId && onOpenDocument ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className="text-[hsl(var(--vault-active))] hover:underline"
                    onClick={() => onOpenDocument(sf.documentId!)}
                  >
                    source
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function SearchPanel({
  bankId,
  teamLabel,
  canManagePlaybooks,
  onOpenDocument,
  onBrowseSources,
}: SearchPanelProps) {
  const [recallQuery, setRecallQuery] = useState('')
  const [reflectQuery, setReflectQuery] = useState('')
  const [recallResults, setRecallResults] = useState<RecallMemory[]>([])
  const [reflectResult, setReflectResult] = useState('')
  const [reflectBasedOn, setReflectBasedOn] = useState<ReflectBasedOn | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('recall')
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())
  const [searchedRecall, setSearchedRecall] = useState(false)
  const [playbookMessage, setPlaybookMessage] = useState('')
  const [savingPlaybook, setSavingPlaybook] = useState(false)
  const [scenarioId, setScenarioId] = useState('')

  function toggleExpand(key: string) {
    setExpandedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleRecall() {
    if (!recallQuery.trim()) return
    setLoading(true)
    setError(null)
    setExpandedDocs(new Set())
    setSearchedRecall(true)
    try {
      const res = await fetch('/api/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankId,
          query: recallQuery,
          scenarioId: scenarioId.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(String(data.error ?? `Search failed (${res.status})`))
        setRecallResults([])
        return
      }
      setRecallResults(data.memories || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
      setRecallResults([])
    } finally {
      setLoading(false)
    }
  }

  async function handleReflect() {
    if (!reflectQuery.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankId,
          query: reflectQuery,
          scenarioId: scenarioId.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(String(data.error ?? `Reflect failed (${res.status})`))
        setReflectResult('')
        setReflectBasedOn(null)
        return
      }
      setReflectResult(data.response || data.text || '')
      const bo = data.based_on ?? {}
      setReflectBasedOn({
        memories: (bo.memories ?? []).map((m: Record<string, unknown>) => ({
          id: m.id as string | undefined,
          text: String(m.text ?? ''),
          type: (m.type as string | undefined) ?? null,
          context: (m.context as string | undefined) ?? null,
          occurred_start: (m.occurred_start as string | undefined) ?? null,
        })),
        mentalModels: (bo.mental_models ?? []).map((m: Record<string, unknown>) => ({
          id: m.id as string | undefined,
          text: (m.text as string | undefined) ?? null,
          context: (m.context as string | undefined) ?? null,
        })),
        directives: (bo.directives ?? []).map((d: Record<string, unknown>) => ({
          id: d.id as string | undefined,
          name: (d.name as string | undefined) ?? null,
          content: (d.content as string | undefined) ?? null,
        })),
        usage: data.usage as ReflectBasedOn['usage'],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reflect failed')
      setReflectResult('')
      setReflectBasedOn(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePlaybook() {
    if (!reflectQuery.trim()) return
    setSavingPlaybook(true)
    setPlaybookMessage('')
    try {
      const name =
        reflectQuery.trim().length > 56
          ? `${reflectQuery.trim().slice(0, 53)}…`
          : reflectQuery.trim()
      const res = await fetch('/api/mental-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankId,
          id: slugPlaybookId(reflectQuery),
          name,
          sourceQuery: reflectQuery.trim(),
          autoRefresh: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPlaybookMessage(String(data.error ?? 'Save failed'))
        return
      }
      setPlaybookMessage('Saved as playbook — generates in Config → Playbooks')
    } catch {
      setPlaybookMessage('Save failed')
    } finally {
      setSavingPlaybook(false)
    }
  }

  return (
    <section className="flex flex-col flex-1 min-h-0">
      <div className="p-4 sm:p-5">
        {error ? (
          <p className="text-xs text-[hsl(var(--error-fg))] mb-3">{error}</p>
        ) : null}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[hsl(var(--secondary))] p-0.5 min-h-[44px]">
            <TabsTrigger value="recall" className="text-xs data-[state=active]:bg-[hsl(var(--canvas))]">
              Recall
            </TabsTrigger>
            <TabsTrigger value="reflect" className="text-xs data-[state=active]:bg-[hsl(var(--canvas))]">
              Reflect
            </TabsTrigger>
          </TabsList>
          <p className="text-xs text-[hsl(var(--vault-muted))] mt-2 leading-relaxed">
            {activeTab === 'recall'
              ? 'Find specific facts with source links and context.'
              : 'Synthesized answer from memories, mental models, and directives.'}
          </p>

          <ScenarioField bankId={bankId} value={scenarioId} onChange={setScenarioId} />

          <TabsContent value="recall" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <label htmlFor="recall-query" className="sr-only">Search query</label>
              <Input
                id="recall-query"
                value={recallQuery}
                onChange={(e) => setRecallQuery(e.target.value)}
                placeholder="What do we know about MegaCorp?"
                className="min-h-[44px] text-[12px]"
                onKeyDown={(e) => e.key === 'Enter' && handleRecall()}
              />
              <Button onClick={handleRecall} disabled={loading} className="shrink-0 min-h-[44px] text-xs px-3">
                {loading ? <Spinner /> : 'Search'}
              </Button>
            </div>
            <ScrollArea className="h-[320px]">
              <ul className="space-y-2">
                {recallResults.map((m, i) => (
                  <RecallResultCard
                    key={m.id ?? i}
                    memory={m}
                    onOpenDocument={onOpenDocument}
                    expandedDocs={expandedDocs}
                    onToggleDocExpand={toggleExpand}
                  />
                ))}
                {recallResults.length === 0 && !loading && searchedRecall && (
                  <div className="text-center text-[hsl(var(--vault-muted))] text-[12px] py-10 space-y-2">
                    <p>No matches for that query.</p>
                    {onBrowseSources ? (
                      <button
                        type="button"
                        className="text-[hsl(var(--vault-active))] hover:underline min-h-[44px]"
                        onClick={onBrowseSources}
                      >
                        Browse Sources
                      </button>
                    ) : null}
                  </div>
                )}
                {recallResults.length === 0 && !loading && !searchedRecall && (
                  <p className="text-center text-[hsl(var(--vault-muted))] text-[12px] py-10">
                    Search for a topic, person, or decision.
                  </p>
                )}
              </ul>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="reflect" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <label htmlFor="reflect-query" className="sr-only">Ask a question</label>
              <Input
                id="reflect-query"
                value={reflectQuery}
                onChange={(e) => setReflectQuery(e.target.value)}
                placeholder="Summarize Q3 risks and who owns each…"
                className="min-h-[44px] text-[12px]"
                onKeyDown={(e) => e.key === 'Enter' && handleReflect()}
              />
              <Button onClick={handleReflect} disabled={loading} className="shrink-0 min-h-[44px] text-xs px-3">
                {loading ? <Spinner /> : 'Ask'}
              </Button>
            </div>
            {reflectResult ? (
              <div className="space-y-3">
                <div className="rounded-sm border border-border bg-[hsl(var(--canvas))] p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs font-medium text-[hsl(var(--vault-muted))] uppercase tracking-widest">
                      Answer
                    </p>
                    {canManagePlaybooks ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs min-h-[44px] shrink-0"
                        disabled={savingPlaybook}
                        onClick={handleSavePlaybook}
                      >
                        {savingPlaybook ? <Spinner /> : 'Save as playbook'}
                      </Button>
                    ) : null}
                  </div>
                  <div className="prose prose-sm prose-slate max-w-none">
                    <MarkdownPreview source={reflectResult} />
                  </div>
                </div>
                {playbookMessage ? (
                  <p
                    className={cn(
                      'text-xs px-2',
                      playbookMessage.includes('failed')
                        ? 'text-[hsl(var(--error-fg))]'
                        : 'text-[hsl(var(--success-fg))]'
                    )}
                  >
                    {playbookMessage}
                  </p>
                ) : null}
                {reflectBasedOn ? <ReflectProvenance basedOn={reflectBasedOn} /> : null}
              </div>
            ) : (
              <p className="text-[12px] text-[hsl(var(--vault-muted))] py-6 text-center leading-relaxed">
                Ask a question. Reflect shows the answer plus mental models, memories, and
                directives used.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
