'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from './hindsight-icons'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MarkdownPreview } from './markdown-field'
import { FileUpload } from './file-upload'
import {
  documentDisplayName,
} from '@/lib/document-display'
import { factTypeStyle } from '@/lib/workspace-colors'

interface DocSummary {
  id: string
  created_at?: string
  updated_at?: string
  memory_unit_count?: number
  nodes_by_fact_type?: Record<string, number> | null
  tags?: string[] | null
}

interface DocumentDetail {
  id: string
  original_text: string | null
  memory_unit_count: number
  created_at: string
  updated_at: string
  nodes_by_fact_type?: Record<string, number> | null
  document_metadata?: Record<string, unknown> | null
  tags?: string[] | null
}

interface DocumentsPanelProps {
  bankId: string
  teamLabel?: string
  userRole?: string
  selectedDocumentId?: string | null
  refreshToken?: number
  uploadOpen?: boolean
  indexingPending?: number
  onSelectDocument?: (documentId: string | null) => void
  onAddNote?: () => void
  onToggleUpload?: () => void
  onUploadComplete?: () => void
  onViewKnowledge?: () => void
  onContinueSource?: (documentId: string) => void
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function DocumentsPanel({
  bankId,
  teamLabel,
  userRole,
  selectedDocumentId,
  refreshToken = 0,
  uploadOpen = false,
  indexingPending = 0,
  onSelectDocument,
  onAddNote,
  onToggleUpload,
  onUploadComplete,
  onViewKnowledge,
  onContinueSource,
}: DocumentsPanelProps) {
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [detail, setDetail] = useState<DocumentDetail | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(selectedDocumentId ?? null)
  const [replacing, setReplacing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const [savingTags, setSavingTags] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const loadList = useCallback(async () => {
    setLoadingList(true)
    setError(null)
    try {
      const params = new URLSearchParams({ bankId, limit: '50' })
      const res = await fetch(`/api/documents?${params}`)
      if (!res.ok) throw new Error(`Could not load documents (${res.status})`)
      const data = await res.json()
      const items = (data.items ?? [])
        .map((row: Record<string, unknown>) => ({
          id: String(row.id ?? ''),
          created_at: row.created_at as string | undefined,
          updated_at: row.updated_at as string | undefined,
          memory_unit_count: row.memory_unit_count as number | undefined,
          nodes_by_fact_type: row.nodes_by_fact_type as Record<string, number> | null | undefined,
          tags: row.tags as string[] | null | undefined,
        }))
        .filter((d: DocSummary) => d.id)
      setDocs(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load documents')
      setDocs([])
    } finally {
      setLoadingList(false)
    }
  }, [bankId])

  const loadDetail = useCallback(
    async (documentId: string) => {
      setLoadingDetail(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/documents/${encodeURIComponent(documentId)}?bankId=${encodeURIComponent(bankId)}`
        )
        if (res.status === 404) {
          setDetail(null)
          setActiveId(null)
          onSelectDocument?.(null)
          return
        }
        if (!res.ok) throw new Error(`Could not open document (${res.status})`)
        setDetail(await res.json())
      } catch (e) {
        setDetail(null)
        setError(e instanceof Error ? e.message : 'Could not open document')
      } finally {
        setLoadingDetail(false)
      }
    },
    [bankId, onSelectDocument]
  )

  useEffect(() => {
    setError(null)
    setActiveId(null)
    setDetail(null)
    loadList()
  }, [bankId, loadList])

  useEffect(() => {
    if (refreshToken > 0) loadList()
  }, [refreshToken, loadList])

  useEffect(() => {
    if (loadingList) return
    if (!selectedDocumentId) {
      setActiveId(null)
      return
    }
    if (docs.some((d) => d.id === selectedDocumentId)) {
      setActiveId(selectedDocumentId)
    } else {
      setActiveId(null)
      setDetail(null)
      setError(null)
      onSelectDocument?.(null)
    }
  }, [selectedDocumentId, docs, loadingList, onSelectDocument])

  useEffect(() => {
    if (activeId) loadDetail(activeId)
    else {
      setDetail(null)
      setError(null)
    }
  }, [activeId, loadDetail])

  useEffect(() => {
    setTagDraft((detail?.tags ?? []).join(', '))
  }, [detail])

  async function handleSaveTags() {
    if (!activeId || userRole !== 'consultant') return
    setSavingTags(true)
    setError(null)
    try {
      const tags = tagDraft
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const res = await fetch(`/api/documents/${encodeURIComponent(activeId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId, tags }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(String(data.error ?? `Tag update failed (${res.status})`))
      await loadDetail(activeId)
      await loadList()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update tags')
    } finally {
      setSavingTags(false)
    }
  }

  useEffect(() => {
    setEditing(false)
    setDraft('')
  }, [activeId])

  function startEdit() {
    if (!detail) return
    setDraft(detail.original_text ?? '')
    setEditing(true)
    setError(null)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft('')
    setError(null)
  }

  async function handleSaveEdit() {
    if (!activeId || !detail || !draft.trim()) return
    setSaving(true)
    setError(null)
    setSaveSuccess(false)
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(activeId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId, content: draft.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(String(data.error ?? `Save failed (${res.status})`))
      setEditing(false)
      setSaveSuccess(true)
      await loadDetail(activeId)
      onUploadComplete?.()
      setTimeout(() => setSaveSuccess(false), 5000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save changes')
    } finally {
      setSaving(false)
    }
  }

  async function handleReplaceFile(file: File) {
    if (!activeId || !detail) return
    setReplacing(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bankId', bankId)
      formData.append('documentId', detail.id)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(String(data.error ?? `Replace failed (${res.status})`))
      onUploadComplete?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not replace file')
    } finally {
      setReplacing(false)
    }
  }

  async function confirmDelete() {
    if (!activeId || !detail) return
    setDeleteOpen(false)
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/documents/${encodeURIComponent(activeId)}?bankId=${encodeURIComponent(bankId)}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(String(data.error ?? `Delete failed (${res.status})`))
      setActiveId(null)
      setDetail(null)
      onSelectDocument?.(null)
      await loadList()
      onUploadComplete?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete document')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-4 px-6 py-4 border-b bg-[hsl(var(--card))]">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-medium tracking-tight">Sources</h1>
          <p className="text-sm text-[hsl(var(--vault-muted))] mt-1">
            {teamLabel ?? bankId}
          </p>
        </div>
        {onToggleUpload ? (
          <Button
            size="sm"
            variant="secondary"
            className="text-sm"
            onClick={onToggleUpload}
          >
            {uploadOpen ? 'Close upload' : 'Upload'}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="text-sm text-[hsl(var(--vault-muted))]"
          onClick={loadList}
          disabled={loadingList}
          aria-label="Refresh documents"
        >
          {loadingList ? <Spinner /> : 'Refresh'}
        </Button>
      </div>

      {indexingPending > 0 ? (
        <div className="px-6 py-2 bg-[hsl(var(--warning-bg))] border-b border-[hsl(var(--warning-border))] text-sm font-medium text-[hsl(var(--warning-fg))]">
          Indexing {indexingPending} upload{indexingPending === 1 ? '' : 's'}. Processing — searchable in a few minutes.
        </div>
      ) : null}

      {uploadOpen ? (
        <div className="px-6 py-4 border-b bg-[hsl(var(--secondary))]/30">
          <FileUpload
            variant="inline"
            bankId={bankId}
            teamLabel={teamLabel}
            userRole={userRole}
            onSuccess={() => onUploadComplete?.()}
          />
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-auto">
        <article className="min-h-full bg-[hsl(var(--canvas))]">
          {error && activeId && !loadingDetail ? (
            <div className="p-6">
              <p className="text-sm text-[hsl(var(--error-fg))]">{error}</p>
              <Button variant="outline" size="sm" className="mt-4 text-sm" onClick={loadList}>
                Retry
              </Button>
            </div>
          ) : !activeId ? (
            <div className="flex flex-col items-center justify-center flex-1 px-6 py-20 text-center gap-4">
              <p className="text-base text-[hsl(var(--vault-muted))] max-w-md leading-relaxed">
                Select a source from the vault sidebar to read retained text and extracted facts.
              </p>
              {docs.length === 0 && !loadingList ? (
                <div className="flex flex-wrap gap-3 justify-center mt-2">
                  {onToggleUpload ? (
                    <Button variant="secondary" size="sm" className="text-sm" onClick={onToggleUpload}>
                      Upload
                    </Button>
                  ) : null}
                  {onAddNote ? (
                    <Button variant="outline" size="sm" className="text-sm" onClick={onAddNote}>
                      Add note
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : loadingDetail ? (
            <div className="flex justify-center py-24">
              <Spinner className="w-6 h-6 text-[hsl(var(--vault-muted))]" />
            </div>
          ) : detail ? (
            <>
              <div className="sticky top-0 z-10 bg-[hsl(var(--canvas))]/95 backdrop-blur border-b">
                <div className="px-4 py-3 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-semibold tracking-tight break-words text-foreground">
                      {documentDisplayName(detail.id, detail.document_metadata)}
                    </h2>
                    {documentDisplayName(detail.id, detail.document_metadata) !== detail.id ? (
                      <p className="text-xs text-[hsl(var(--vault-muted))] mt-1 break-all font-mono opacity-70">{detail.id}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {editing ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="text-sm"
                          disabled={saving || !draft.trim()}
                          onClick={() => void handleSaveEdit()}
                        >
                          {saving ? <Spinner className="mr-2" /> : null}
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-sm"
                          disabled={saving}
                          onClick={cancelEdit}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-sm"
                          disabled={replacing || deleting}
                          onClick={startEdit}
                        >
                          Edit text
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-sm text-[hsl(var(--error-fg))] border-[hsl(var(--error-border))] hover:bg-[hsl(var(--error-bg))]"
                          disabled={replacing || deleting}
                          onClick={() => setDeleteOpen(true)}
                        >
                          {deleting ? <Spinner className="mr-2" /> : null}
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 mt-3">
                  <Badge variant="secondary" className="text-xs font-medium px-2.5 py-0.5">
                    {detail.memory_unit_count} facts
                  </Badge>
                  {detail.nodes_by_fact_type &&
                    Object.entries(detail.nodes_by_fact_type).map(([k, v]) => (
                      <Badge
                        key={k}
                        variant="outline"
                        className={cn(
                          'text-xs capitalize font-medium px-2.5 py-0.5',
                          factTypeStyle(k).badge
                        )}
                      >
                        {factTypeStyle(k).label} {v}
                      </Badge>
                    ))}
                  {detail.nodes_by_fact_type?.observation ? (
                    <span className="text-xs text-[hsl(var(--vault-muted))] w-full lg:w-auto">
                      Observations are consolidated beliefs linked to this source — not extra uploads.
                    </span>
                  ) : null}
                  <span className="text-xs text-[hsl(var(--vault-muted))] lg:ml-auto">
                    Updated {formatDate(detail.updated_at)}
                  </span>
                  {saveSuccess ? (
                    <span className="text-sm font-medium text-[hsl(var(--success-fg))] ml-3">
                      Saved — updating extracted knowledge
                    </span>
                  ) : null}
                  {onViewKnowledge && detail.memory_unit_count > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-sm ml-auto text-[hsl(var(--vault-active))]"
                      onClick={onViewKnowledge}
                    >
                      View facts
                    </Button>
                  ) : null}
                  {onContinueSource ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-sm text-[hsl(var(--vault-active))]"
                      onClick={() => onContinueSource(detail.id)}
                    >
                      Continue this source
                    </Button>
                  ) : null}
                </div>
                {(detail.tags?.length || userRole === 'consultant') ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {userRole === 'consultant' ? (
                      <div className="flex w-full max-w-xl gap-2">
                        <input
                          value={tagDraft}
                          onChange={(e) => setTagDraft(e.target.value)}
                          placeholder="scope:shared, project:alpha"
                          className="min-h-[36px] flex-1 rounded-md border border-border bg-[hsl(var(--canvas))] px-3 py-1.5 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-sm shrink-0"
                          disabled={savingTags}
                          onClick={() => void handleSaveTags()}
                        >
                          {savingTags ? <Spinner /> : 'Save'}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(detail.tags ?? []).map((t) => (
                          <Badge key={t} variant="outline" className="text-xs font-normal px-2.5 py-0.5">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
                </div>
              </div>
              <div className="px-4 py-6 sm:px-6 lg:px-8">
                <div className="source-reader mx-auto w-full max-w-[78ch]">
                {editing ? (
                  <>
                    <p className="text-sm text-[hsl(var(--vault-muted))] mb-4 leading-relaxed">
                      Editing the raw text will rebuild extracted facts. Processing — searchable in a few minutes.
                    </p>
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="min-h-[60vh] text-base leading-relaxed resize-y p-4"
                    />
                  </>
                ) : (
                  <div className="prose prose-slate max-w-none">
                    <MarkdownPreview source={detail.original_text ?? ''} />
                  </div>
                )}
                {!editing ? (
                  <div className="pt-6 mt-8 border-t border-border flex items-center gap-4">
                    <input
                      ref={replaceInputRef}
                      type="file"
                      className="sr-only"
                      accept=".pdf,.doc,.docx,.txt,.md,.pptx,.xlsx,.csv,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (file) void handleReplaceFile(file)
                      }}
                    />
                    <button
                      type="button"
                      className="text-sm font-medium text-[hsl(var(--vault-muted))] hover:text-[hsl(var(--vault-active))] transition-colors"
                      disabled={replacing}
                      onClick={() => replaceInputRef.current?.click()}
                    >
                      {replacing ? <Spinner className="inline mr-2" /> : null}
                      Replace file
                    </button>
                    <p className="text-xs text-[hsl(var(--vault-muted))] opacity-80">
                      Replaces source text and rebuilds extracted facts.
                    </p>
                  </div>
                ) : null}
                </div>
              </div>
            </>
          ) : null}
        </article>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-[hsl(var(--card))] border-border max-w-md p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-semibold">Delete source?</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-[hsl(var(--vault-muted))] mt-2">
              {detail
                ? `"${documentDisplayName(detail.id, detail.document_metadata)}" and ${detail.memory_unit_count} extracted facts will be removed from this team bank. This cannot be undone.`
                : 'This source and its extracted facts will be removed.'}
            </DialogDescription>
          </DialogHeader>
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
              Delete source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
