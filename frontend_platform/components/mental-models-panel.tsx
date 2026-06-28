'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Spinner } from './hindsight-icons'
import { MarkdownPreview } from './markdown-field'
import { cn } from '@/lib/utils'

interface MentalModelItem {
  id: string
  name: string
  source_query?: string | null
  content?: string | null
  tags?: string[]
  last_refreshed_at?: string | null
  is_stale?: boolean | null
  trigger?: { refresh_after_consolidation?: boolean } | null
}

interface HistoryEntry {
  previous_content?: string | null
  changed_at: string
}

interface MentalModelsPanelProps {
  bankId: string
}

function slugId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'playbook'
  )
}

export function MentalModelsPanel({ bankId }: MentalModelsPanelProps) {
  const [items, setItems] = useState<MentalModelItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const [detail, setDetail] = useState<'metadata' | 'content' | 'full'>('content')
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [modelId, setModelId] = useState('')
  const [sourceQuery, setSourceQuery] = useState('')
  const [tags, setTags] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/mental-models?bankId=${encodeURIComponent(bankId)}&detail=${detail}`
      )
      const data = await res.json()
      setItems(data.items ?? [])
    } catch (e) {
      console.error(e)
      setMessage('Failed to load playbooks')
    } finally {
      setLoading(false)
    }
  }, [bankId, detail])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate() {
    if (!name.trim() || !sourceQuery.trim()) return
    setBusyId('create')
    setMessage('')
    try {
      const res = await fetch('/api/mental-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankId,
          id: modelId.trim() || slugId(name),
          name: name.trim(),
          sourceQuery: sourceQuery.trim(),
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          autoRefresh,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(String(data.error ?? 'Create failed'))
        return
      }
      setMessage('Playbook created — content generates in background')
      setShowCreate(false)
      setName('')
      setModelId('')
      setSourceQuery('')
      setTags('')
      await load()
    } catch {
      setMessage('Create failed')
    } finally {
      setBusyId(null)
    }
  }

  async function loadHistory(id: string) {
    if (historyOpenId === id) {
      setHistoryOpenId(null)
      return
    }
    setHistoryLoading(true)
    setHistoryOpenId(id)
    try {
      const res = await fetch(
        `/api/mental-models/${id}/history?bankId=${encodeURIComponent(bankId)}`
      )
      const data = await res.json()
      setHistoryData(Array.isArray(data) ? data : data?.items ?? [])
    } catch {
      setHistoryData([])
    } finally {
      setHistoryLoading(false)
    }
  }

  async function runAction(id: string, action: 'refresh' | 'clear' | 'delete') {
    setBusyId(id)
    setMessage('')
    try {
      const method = action === 'delete' ? 'DELETE' : 'POST'
      const path =
        action === 'delete'
          ? `/api/mental-models/${id}?bankId=${encodeURIComponent(bankId)}`
          : `/api/mental-models/${id}/${action}`
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: action === 'delete' ? undefined : JSON.stringify({ bankId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setMessage(String(data.error ?? `${action} failed`))
        return
      }
      setMessage(
        action === 'refresh'
          ? 'Refresh started'
          : action === 'clear'
            ? 'Content cleared'
            : 'Playbook deleted'
      )
      await load()
    } catch {
      setMessage(`${action} failed`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section>
      <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-border bg-[hsl(var(--card))]">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-medium tracking-tight">Playbooks</h2>
          <p className="text-xs text-[hsl(var(--vault-muted))] mt-1 leading-relaxed max-w-md">
            Mental models are cached Reflect answers. Reflect pulls them in automatically when
            relevant -- use them for renewal playbooks, critical paths, and standing priorities.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="text-xs min-h-[44px] shrink-0"
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? 'Cancel' : 'New playbook'}
        </Button>
        <select
          value={detail}
          onChange={(e) => setDetail(e.target.value as 'metadata' | 'content' | 'full')}
          className="h-9 text-xs rounded-md border border-border bg-[hsl(var(--canvas))] px-2 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--vault-active))]"
        >
          <option value="metadata">Metadata</option>
          <option value="content">Content</option>
          <option value="full">Full</option>
        </select>
      </div>
      <div className="p-5 space-y-4">
        {showCreate ? (
          <div className="rounded-sm border border-border bg-[hsl(var(--canvas))] p-4 space-y-3">
            <div className="space-y-2">
              <Label className="text-sm">Name</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (!modelId) setModelId(slugId(e.target.value))
                }}
                placeholder="MegaCorp renewal playbook"
                className="min-h-[44px] text-[12px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">ID (optional)</Label>
              <Input
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="megacorp-renewal-playbook"
                className="min-h-[44px] text-[12px] font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Source query</Label>
              <Textarea
                value={sourceQuery}
                onChange={(e) => setSourceQuery(e.target.value)}
                placeholder="What blocks MegaCorp renewal and who owns each mitigation?"
                className="min-h-[72px] text-[12px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Tags (comma-separated)</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="account:megacorp, q3"
                className="min-h-[44px] text-[12px]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Auto-refresh after consolidation</Label>
                <p className="text-xs text-[hsl(var(--vault-muted))]">
                  Regenerate when new memories consolidate
                </p>
              </div>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            </div>
            <Button
              onClick={handleCreate}
              disabled={busyId === 'create' || !name.trim() || !sourceQuery.trim()}
              className="w-full min-h-[44px] text-[12px]"
            >
              {busyId === 'create' ? <Spinner className="mr-2" /> : null}
              Create playbook
            </Button>
          </div>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-5" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-[12px] text-[hsl(var(--vault-muted))] text-center py-8 leading-relaxed">
            No playbooks yet. Create one from a standing question your team asks often.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((m) => (
              <li
                key={m.id}
                className="rounded-sm border border-border bg-[hsl(var(--canvas))] overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full text-left px-3 py-3 min-h-[44px] flex items-start justify-between gap-2"
                  onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                  aria-expanded={expandedId === m.id}
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate">{m.name}</p>
                    <p className="text-xs text-[hsl(var(--vault-muted))] truncate mt-0.5">
                      {m.source_query ?? m.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {m.is_stale ? (
                      <Badge variant="secondary" className="text-xs">
                        stale
                      </Badge>
                    ) : null}
                    {m.trigger?.refresh_after_consolidation ? (
                      <Badge variant="outline" className="text-xs">
                        auto
                      </Badge>
                    ) : null}
                  </div>
                </button>
                {expandedId === m.id ? (
                  <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                    {m.content ? (
                      <div className="prose prose-sm prose-slate max-w-none">
                        <MarkdownPreview source={m.content} />
                      </div>
                    ) : (
                      <p className="text-xs text-[hsl(var(--vault-muted))] italic">
                        Content generating… refresh in a minute if blank.
                      </p>
                    )}
                    {m.tags?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {m.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs min-h-[44px]"
                        disabled={busyId === m.id}
                        onClick={() => runAction(m.id, 'refresh')}
                      >
                        Refresh
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs min-h-[44px]"
                        disabled={busyId === m.id}
                        onClick={() => runAction(m.id, 'clear')}
                      >
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs min-h-[44px]"
                        disabled={historyLoading && historyOpenId !== m.id}
                        onClick={() => loadHistory(m.id)}
                      >
                        {historyOpenId === m.id ? 'Hide history' : 'History'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs min-h-[44px] text-[hsl(var(--error-fg))]"
                        disabled={busyId === m.id}
                        onClick={() => runAction(m.id, 'delete')}
                      >
                        Delete
                      </Button>
                    </div>
                    {historyOpenId === m.id ? (
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--vault-muted))] mb-2">
                          Revision history
                        </p>
                        {historyLoading ? (
                          <Spinner className="size-4" />
                        ) : historyData.length === 0 ? (
                          <p className="text-xs text-[hsl(var(--vault-muted))] italic">No history</p>
                        ) : (
                          <ul className="space-y-2 max-h-40 overflow-y-auto">
                            {historyData.map((entry, i) => (
                              <li key={i} className="text-xs">
                                <p className="text-[hsl(var(--vault-muted))]">
                                  {new Date(entry.changed_at).toLocaleString()}
                                </p>
                                {entry.previous_content ? (
                                  <div className="mt-1 rounded border border-border bg-[hsl(var(--card))] p-2 text-[11px] leading-relaxed line-clamp-3">
                                    {entry.previous_content.slice(0, 300)}
                                    {entry.previous_content.length > 300 ? '…' : ''}
                                  </div>
                                ) : (
                                  <p className="italic text-[hsl(var(--vault-muted))]">First version</p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {message ? (
          <div
            className={cn(
              'text-[12px] p-2 rounded-sm',
              message.includes('failed') || message.includes('Failed')
                ? 'bg-[hsl(var(--error-bg))] text-[hsl(var(--error-fg))]'
                : 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success-fg))]'
            )}
          >
            {message}
          </div>
        ) : null}
      </div>
    </section>
  )
}
