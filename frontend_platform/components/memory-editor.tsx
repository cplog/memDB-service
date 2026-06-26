'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronIcon, Spinner } from './hindsight-icons'
import { documentDisplayName } from '@/lib/document-display'
import { parseTeamBankId } from '@/lib/teams'
import { RETAIN_PROCESSING_HINT } from '../../shared/lib/retain-validation'
import { teamBankProfile } from '../../shared/lib/team-banks'
import { ScenarioField } from './scenario-field'

interface DocOption {
  id: string
  label: string
}

interface MemoryEditorProps {
  bankId: string
  teamLabel?: string
  attachDocumentId?: string | null
  onSave: (navigate?: boolean) => void
}

const SOURCE_TYPES = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'email', label: 'Email' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'doc', label: 'Document' },
  { value: 'chat', label: 'Chat' },
  { value: 'other', label: 'Other' },
]

export function MemoryEditor({
  bankId,
  teamLabel,
  attachDocumentId,
  onSave,
}: MemoryEditorProps) {
  const [content, setContent] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [meetingName, setMeetingName] = useState('')
  const [ticketId, setTicketId] = useState('')
  const [sourceDate, setSourceDate] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [docs, setDocs] = useState<DocOption[]>([])
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>(
    attachDocumentId ? 'existing' : 'new'
  )
  const [selectedDocId, setSelectedDocId] = useState(attachDocumentId ?? '')
  const [scenarioId, setScenarioId] = useState('')
  const [retainStrategy, setRetainStrategy] = useState('')

  const strategyOptions = (() => {
    const teamId = parseTeamBankId(bankId)
    if (!teamId) return []
    return Object.keys(teamBankProfile(teamId).retainStrategies ?? {})
  })()

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents?bankId=${encodeURIComponent(bankId)}&limit=50`)
      if (!res.ok) return
      const data = await res.json()
      setDocs(
        (data.items ?? [])
          .map((row: Record<string, unknown>) => {
            const id = String(row.id ?? '')
            const meta = row.document_metadata as Record<string, unknown> | undefined
            return { id, label: documentDisplayName(id, meta) }
          })
          .filter((d: DocOption) => d.id)
      )
    } catch {
      setDocs([])
    }
  }, [bankId])

  useEffect(() => {
    void loadDocs()
  }, [loadDocs])

  useEffect(() => {
    if (attachDocumentId) {
      setTargetMode('existing')
      setSelectedDocId(attachDocumentId)
    }
  }, [attachDocumentId])

  async function handleRetain() {
    if (!content.trim()) return
    setLoading(true)
    setError(null)
    try {
      const useExisting = targetMode === 'existing' && selectedDocId
      const res = await fetch('/api/retain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankId,
          content,
          sessionId: !useExisting ? noteTitle.trim() : undefined,
          documentId: useExisting ? selectedDocId : undefined,
          updateMode: useExisting ? 'append' : undefined,
          scope: 'private',
          sourceType: sourceType || undefined,
          meetingName: meetingName.trim() || undefined,
          ticketId: ticketId.trim() || undefined,
          sourceDate: sourceDate || undefined,
          scenarioId: scenarioId.trim() || undefined,
          retainStrategy: retainStrategy.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(String(data.error ?? `Save failed (${res.status})`))
        return
      }
      setResult(data)
      setContent('')
      if (!useExisting) setNoteTitle('')
      onSave(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setLoading(false)
    }
  }

  const needsTitle = targetMode === 'new' && !noteTitle.trim()
  const hasDetails =
    Boolean(sourceType || sourceDate || meetingName.trim() || ticketId.trim())

  return (
    <section className="border border-border bg-[hsl(var(--card))] p-5 space-y-4 max-w-2xl">
      <div>
        <h1 className="text-[13px] font-medium">Add note</h1>
        <p className="text-[11px] text-[hsl(var(--vault-muted))] mt-0.5 leading-relaxed">
          Plain text for {teamLabel ?? bankId}. Title becomes a stable source id.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={targetMode === 'new' ? 'default' : 'outline'}
          size="sm"
          className="min-h-[44px] text-[11px]"
          onClick={() => setTargetMode('new')}
        >
          New document
        </Button>
        <Button
          type="button"
          variant={targetMode === 'existing' ? 'default' : 'outline'}
          size="sm"
          className="min-h-[44px] text-[11px]"
          onClick={() => setTargetMode('existing')}
        >
          Attach to existing
        </Button>
      </div>

      {targetMode === 'existing' ? (
        <Select value={selectedDocId || undefined} onValueChange={setSelectedDocId}>
          <SelectTrigger className="min-h-[44px] text-[12px]">
            <SelectValue placeholder="Choose source document…" />
          </SelectTrigger>
          <SelectContent>
            {docs.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={noteTitle}
          onChange={(e) => setNoteTitle(e.target.value)}
          placeholder="Title or slug (required), e.g. Q3 planning 2024-03-15"
          className="text-[12px] min-h-[44px]"
          required
        />
      )}

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Meeting notes, decisions, or anything the team should remember…"
        className="min-h-[280px] text-[13px] leading-relaxed resize-y"
      />

      <button
        type="button"
        className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--vault-muted))] hover:text-[hsl(var(--vault-active))] min-h-[44px]"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((o) => !o)}
      >
        <ChevronIcon className="w-3 h-3" open={detailsOpen} />
        Add details (optional)
        {hasDetails && !detailsOpen ? (
          <span className="text-[hsl(var(--vault-active))]">· filled</span>
        ) : null}
      </button>

      {detailsOpen ? (
        <div className="space-y-3 pt-1">
          <ScenarioField
            bankId={bankId}
            value={scenarioId}
            onChange={setScenarioId}
            retainStrategy={retainStrategy}
            onRetainStrategyChange={setRetainStrategy}
            retainStrategyOptions={strategyOptions}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Select value={sourceType || undefined} onValueChange={setSourceType}>
            <SelectTrigger className="min-h-[44px] text-[11px]">
              <SelectValue placeholder="Source type" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={sourceDate}
            onChange={(e) => setSourceDate(e.target.value)}
            className="text-[12px] min-h-[44px]"
            aria-label="Source date"
          />
          <Input
            value={meetingName}
            onChange={(e) => setMeetingName(e.target.value)}
            placeholder="Meeting name"
            className="text-[12px] min-h-[44px]"
          />
          <Input
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            placeholder="Ticket ID"
            className="text-[12px] min-h-[44px]"
          />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-[11px] text-[hsl(var(--error-fg))]">{error}</p>
      ) : null}

      <Button
        onClick={handleRetain}
        disabled={
          loading ||
          !content.trim() ||
          (targetMode === 'existing' && !selectedDocId) ||
          needsTitle
        }
        className="w-full min-h-[44px] text-[12px]"
      >
        {loading ? <Spinner className="mr-2" /> : null}
        {targetMode === 'existing' ? 'Append to source' : `Save to ${teamLabel ?? bankId}`}
      </Button>

      {result ? (
        <div className="flex items-center justify-between bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] rounded-sm px-3 py-2">
          <p className="text-[11px] text-[hsl(var(--success-fg))]">{RETAIN_PROCESSING_HINT}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-[44px] text-[11px] text-[hsl(var(--success-fg))] hover:opacity-80"
            onClick={() => onSave(true)}
          >
            Go to Knowledge
          </Button>
        </div>
      ) : null}
    </section>
  )
}
