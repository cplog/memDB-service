'use client'

import { useState, useCallback, useId, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from './hindsight-icons'
import { cn } from '@/lib/utils'
import { documentDisplayName } from '@/lib/document-display'
import { parseTeamBankId } from '@/lib/teams'
import { RETAIN_PROCESSING_HINT } from '../../shared/lib/retain-validation'
import { teamBankProfile } from '../../shared/lib/team-banks'
import { ScenarioField } from './scenario-field'

const MAX_BYTES = 100 * 1024 * 1024
const ACCEPT =
  '.pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp'

export interface UploadResultItem {
  file: string
  success: boolean
  operationIds?: string[]
  error?: string
}

interface FileUploadProps {
  bankId: string
  teamLabel?: string
  userRole?: string
  /** Inline under Sources toolbar vs full Add → Upload page */
  variant?: 'page' | 'inline'
  replaceDocumentId?: string | null
  onSuccess?: (results: UploadResultItem[]) => void
}

function fileExtLabel(filename: string): string {
  const ext = filename.split('.').pop()?.toUpperCase()
  return ext && ext.length <= 5 ? ext : 'FILE'
}

export function FileUpload({
  bankId,
  teamLabel,
  userRole,
  variant = 'page',
  replaceDocumentId,
  onSuccess,
}: FileUploadProps) {
  const inputId = useId()
  const [files, setFiles] = useState<File[]>([])
  const [parser, setParser] = useState('markitdown')
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UploadResultItem[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [attachMode, setAttachMode] = useState<'new' | 'existing'>(
    replaceDocumentId ? 'existing' : 'new'
  )
  const [docs, setDocs] = useState<{ id: string; label: string }[]>([])
  const [selectedDocId, setSelectedDocId] = useState(replaceDocumentId ?? '')
  const [sourceType, setSourceType] = useState('')
  const [meetingName, setMeetingName] = useState('')
  const [ticketId, setTicketId] = useState('')
  const [sourceDate, setSourceDate] = useState('')
  const [scenarioId, setScenarioId] = useState('')
  const [retainStrategy, setRetainStrategy] = useState('')

  const strategyOptions = (() => {
    const teamId = parseTeamBankId(bankId)
    if (!teamId) return []
    return Object.keys(teamBankProfile(teamId).retainStrategies ?? {})
  })()

  useEffect(() => {
    if (replaceDocumentId) {
      setAttachMode('existing')
      setSelectedDocId(replaceDocumentId)
    }
  }, [replaceDocumentId])

  useEffect(() => {
    fetch(`/api/documents?bankId=${encodeURIComponent(bankId)}&limit=50`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) =>
        setDocs(
          (data.items ?? [])
            .map((row: Record<string, unknown>) => {
              const id = String(row.id ?? '')
              const meta = row.document_metadata as Record<string, unknown> | undefined
              return { id, label: documentDisplayName(id, meta) }
            })
            .filter((d: { id: string }) => d.id)
        )
      )
      .catch(() => setDocs([]))
  }, [bankId])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }, [])

  const addFiles = useCallback((incoming: File[]) => {
    const valid: File[] = []
    const rejected: string[] = []
    for (const f of incoming) {
      if (f.size > MAX_BYTES) rejected.push(`${f.name} (over 100MB)`)
      else valid.push(f)
    }
    if (valid.length) setFiles((prev) => [...prev, ...valid])
    if (rejected.length) {
      setResults([
        {
          file: rejected.join(', '),
          success: false,
          error: 'File exceeds 100MB limit',
        },
      ])
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      if (e.dataTransfer.files?.length) {
        addFiles(Array.from(e.dataTransfer.files))
      }
    },
    [addFiles]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(Array.from(e.target.files))
      e.target.value = ''
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleUpload() {
    if (files.length === 0) return
    setUploading(true)
    setResults([])
    const newResults: UploadResultItem[] = []

    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bankId', bankId)
        formData.append('parser', parser)
        if (attachMode === 'existing' && selectedDocId) {
          formData.append('documentId', selectedDocId)
        }
        if (sourceType) formData.append('sourceType', sourceType)
        if (meetingName.trim()) formData.append('meetingName', meetingName.trim())
        if (ticketId.trim()) formData.append('ticketId', ticketId.trim())
        if (sourceDate) formData.append('sourceDate', sourceDate)
        if (scenarioId.trim()) formData.append('scenarioId', scenarioId.trim())
        if (retainStrategy.trim()) formData.append('retainStrategy', retainStrategy.trim())

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        newResults.push({
          file: file.name,
          success: res.ok,
          operationIds: data.operation_ids as string[] | undefined,
          error: res.ok ? undefined : String(data.error ?? `HTTP ${res.status}`),
        })
      } catch (e) {
        newResults.push({
          file: file.name,
          success: false,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }

    setResults(newResults)
    setFiles([])
    setUploading(false)

    const ok = newResults.filter((r) => r.success)
    if (ok.length && variant === 'inline') {
      onSuccess?.(ok)
    } else if (ok.length) {
      // In full page mode, we don't call onSuccess immediately so the user can see the success message
      // We will call it when they click "Go to Sources"
      onSuccess?.(ok)
    }
  }

  const isInline = variant === 'inline'

  return (
    <section
      className={cn(
        isInline
          ? 'border border-border rounded-sm bg-[hsl(var(--secondary))]/20 p-4 space-y-4'
          : 'border border-border bg-[hsl(var(--card))] p-5 space-y-4 max-w-2xl'
      )}
    >
      {!isInline ? (
        <div>
          <h1 className="text-[13px] font-medium">Upload files</h1>
          <p className="text-xs text-[hsl(var(--vault-muted))] mt-0.5 flex flex-wrap items-center gap-2">
            Retained for {teamLabel ?? bankId}
            <Badge variant="secondary" className="text-xs font-normal">
              {bankId}
            </Badge>
          </p>
          <p className="text-xs text-[hsl(var(--vault-muted))] mt-2 leading-relaxed">
            Uploaded files appear under the Sources tab. {RETAIN_PROCESSING_HINT}
          </p>
        </div>
      ) : (
        <p className="text-xs text-[hsl(var(--vault-muted))] leading-relaxed">
          Drop files here to add sources. They appear in the list below after indexing.
        </p>
      )}

      {!replaceDocumentId ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={attachMode === 'new' ? 'default' : 'outline'}
              size="sm"
              className="min-h-[36px] text-xs"
              onClick={() => setAttachMode('new')}
            >
              New source
            </Button>
            <Button
              type="button"
              variant={attachMode === 'existing' ? 'default' : 'outline'}
              size="sm"
              className="min-h-[36px] text-xs"
              onClick={() => setAttachMode('existing')}
            >
              Replace existing
            </Button>
          </div>
          {attachMode === 'existing' ? (
            <Select value={selectedDocId || undefined} onValueChange={setSelectedDocId}>
              <SelectTrigger className="min-h-[44px] text-xs">
                <SelectValue placeholder="Choose document to replace…" />
              </SelectTrigger>
              <SelectContent>
                {docs.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Select value={sourceType || undefined} onValueChange={setSourceType}>
          <SelectTrigger className="min-h-[40px] text-xs">
            <SelectValue placeholder="Source type (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="ticket">Ticket</SelectItem>
            <SelectItem value="doc">Document</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="date"
          value={sourceDate}
          onChange={(e) => setSourceDate(e.target.value)}
          className="rounded-sm border border-border bg-[hsl(var(--canvas))] px-2 py-1.5 text-xs min-h-[40px]"
          aria-label="Source date"
        />
        <input
          id="upload-meeting-name"
          value={meetingName}
          onChange={(e) => setMeetingName(e.target.value)}
          placeholder="Meeting name (optional)"
          className="rounded-sm border border-border bg-[hsl(var(--canvas))] px-2 py-1.5 text-xs min-h-[40px]"
          aria-label="Meeting name"
        />
        <input
          id="upload-ticket-id"
          value={ticketId}
          onChange={(e) => setTicketId(e.target.value)}
          placeholder="Ticket ID (optional)"
          className="rounded-sm border border-border bg-[hsl(var(--canvas))] px-2 py-1.5 text-xs min-h-[40px]"
          aria-label="Ticket ID"
        />
      </div>

      <ScenarioField
        bankId={bankId}
        value={scenarioId}
        onChange={setScenarioId}
        retainStrategy={retainStrategy}
        onRetainStrategyChange={setRetainStrategy}
        retainStrategyOptions={strategyOptions}
      />

      {userRole === 'consultant' ? (
        <div className="flex items-center gap-3">
          <span className="text-xs text-[hsl(var(--vault-muted))]">Parser</span>
          <Select value={parser} onValueChange={setParser}>
            <SelectTrigger className="w-44 min-h-[44px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="markitdown">markitdown (default)</SelectItem>
              <SelectItem value="iris">iris (higher quality)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          'border border-dashed rounded-sm p-6 text-center transition-colors',
          dragActive
            ? 'border-[hsl(var(--vault-active))] bg-[hsl(var(--accent))]/30'
            : 'border-border hover:border-[hsl(var(--vault-muted))]/50 bg-[hsl(var(--canvas))]'
        )}
      >
        <p className="text-[12px] text-[hsl(var(--vault-muted))]">
          Drag files here, or{' '}
          <label
            htmlFor={inputId}
            className="text-[hsl(var(--vault-active))] cursor-pointer hover:underline"
          >
            browse
          </label>
        </p>
        <p className="text-xs text-[hsl(var(--vault-muted))] mt-1 opacity-70">
          PDF, DOCX, TXT, MD, CSV, images · max 100MB
        </p>
        <input
          id={inputId}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          onChange={handleFileSelect}
        />
      </div>

      {files.length > 0 ? (
        <ul className="space-y-1.5">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 rounded-sm border border-border bg-[hsl(var(--canvas))] px-3 py-2"
            >
              <span className="text-xs font-medium tracking-wider text-[hsl(var(--vault-muted))] w-8 shrink-0 tabular-nums">
                {fileExtLabel(file.name)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] truncate">{file.name}</div>
                <div className="text-xs text-[hsl(var(--vault-muted))]">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-[hsl(var(--vault-muted))] hover:text-[hsl(var(--error-fg))] text-xs min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={`Remove ${file.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        onClick={handleUpload}
        disabled={
          uploading ||
          files.length === 0 ||
          (attachMode === 'existing' && !selectedDocId && !replaceDocumentId)
        }
        className="w-full min-h-[44px] text-[12px]"
      >
        {uploading ? <Spinner className="mr-2" /> : null}
        Upload {files.length || ''} file{files.length === 1 ? '' : 's'}
      </Button>

      {results.length > 0 ? (
        <ul className="space-y-1.5">
          {results.map((r, i) => (
            <li
              key={`${r.file}-${i}`}
              className={cn(
                'rounded-sm px-3 py-2 text-[12px] border',
                r.success
                  ? 'bg-[hsl(var(--success-bg))] border-[hsl(var(--success-border))] text-[hsl(var(--success-fg))]'
                  : 'bg-[hsl(var(--error-bg))] border-[hsl(var(--error-border))] text-[hsl(var(--error-fg))]'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.file}</span>
                {r.success && !isInline ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px] text-xs text-[hsl(var(--success-fg))] hover:opacity-80"
                    onClick={() => onSuccess?.([])} // trigger navigation in full page mode
                  >
                    Go to Sources
                  </Button>
                ) : null}
              </div>
              {r.success ? (
                <p className="text-xs mt-1 opacity-90">{RETAIN_PROCESSING_HINT}</p>
              ) : (
                <p className="text-xs mt-1">{r.error}</p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
