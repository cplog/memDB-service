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
  const readerRef = useRef<HTMLDivElement>(null)

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
    readerRef.current?.scrollTo({ top: 0 })
  }, [activeId])

  useEffect(() => {
    readerRef.current?.scrollTo({ top: 0 })
  }, [detail?.id])

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
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-1.5 border-b bg-[hsl(var(--card))] sm:px-5">
        <div className="min-w-0 flex-1 flex items-baseline gap-2">
          <span className="text-sm font-medium tracking-tight">Sources</span>
          <span className="text-xs text-[hsl(var(--vault-muted))] truncate">
            {teamLabel ?? bankId}
          </span>
        </div>
        {onToggleUpload ? (
          <Button
            size="sm"
            variant="secondary"
            className="text-sm min-h-[36px]"
            onClick={onToggleUpload}
          >
            {uploadOpen ? 'Close upload' : 'Upload'}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="text-sm min-h-[36px] text-[hsl(var(--vault-muted))]"
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

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <article className="absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-[hsl(var(--canvas))]">
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
            <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_17rem]">
              {/* Metadata rail — right on xl, compact strip above reader on smaller screens */}
              <aside className="order-1 shrink-0 border-b border-border bg-[hsl(var(--vault))]/30 px-4 py-3 xl:order-2 xl:border-b-0 xl:border-l xl:overflow-y-auto xl:overscroll-contain">
                <div className="source-meta-rail space-y-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-widest text-[hsl(var(--vault-muted))] mb-1">
                      Source
                    </p>
                    <h2 className="text-sm font-medium leading-snug break-words text-foreground">
                      {documentDisplayName(detail.id, detail.document_metadata)}
                    </h2>
                    {documentDisplayName(detail.id, detail.document_metadata) !== detail.id ? (
                      <p className="text-[10px] text-[hsl(var(--vault-muted))] mt-1 break-all font-mono opacity-70">
                        {detail.id}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {editing ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 text-xs"
                          disabled={saving || !draft.trim()}
                          onClick={() => void handleSaveEdit()}
                        >
                          {saving ? <Spinner className="mr-1.5" /> : null}
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
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
                          className="h-8 text-xs"
                          disabled={replacing || deleting}
                          onClick={startEdit}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs text-[hsl(var(--error-fg))] border-[hsl(var(--error-border))] hover:bg-[hsl(var(--error-bg))]"
                          disabled={replacing || deleting}
                          onClick={() => setDeleteOpen(true)}
                        >
                          {deleting ? <Spinner className="mr-1.5" /> : null}
                          Delete
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0">
                      {detail.memory_unit_count} facts
                    </Badge>
                    {detail.nodes_by_fact_type &&
                      Object.entries(detail.nodes_by_fact_type).map(([k, v]) => (
                        <Badge
                          key={k}
                          variant="outline"
                          className={cn(
                            'text-[10px] capitalize font-medium px-2 py-0',
                            factTypeStyle(k).badge
                          )}
                        >
                          {factTypeStyle(k).label} {v}
                        </Badge>
                      ))}
                  </div>

                  <p className="text-[11px] text-[hsl(var(--vault-muted))]">
                    Updated {formatDate(detail.updated_at)}
                  </p>
                  {saveSuccess ? (
                    <p className="text-[11px] font-medium text-[hsl(var(--success-fg))]">
                      Saved — updating extracted knowledge
                    </p>
                  ) : null}

                  <div className="flex flex-col gap-1">
                    {onViewKnowledge && detail.memory_unit_count > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 justify-start px-2 text-xs text-[hsl(var(--vault-active))]"
                        onClick={onViewKnowledge}
                      >
                        View facts
                      </Button>
                    ) : null}
                    {onContinueSource ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 justify-start px-2 text-xs text-[hsl(var(--vault-active))]"
                        onClick={() => onContinueSource(detail.id)}
                      >
                        Continue this source
                      </Button>
                    ) : null}
                    {!editing ? (
                      <>
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
                          className="h-8 px-2 text-left text-xs text-[hsl(var(--vault-muted))] hover:text-[hsl(var(--vault-active))] transition-colors"
                          disabled={replacing}
                          onClick={() => replaceInputRef.current?.click()}
                        >
                          {replacing ? <Spinner className="inline mr-1.5" /> : null}
                          Replace file
                        </button>
                      </>
                    ) : null}
                  </div>

                  {(detail.tags?.length || userRole === 'consultant') ? (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <p className="text-[10px] font-medium uppercase tracking-widest text-[hsl(var(--vault-muted))]">
                        Tags
                      </p>
                      {userRole === 'consultant' ? (
                        <div className="flex flex-col gap-1.5">
                          <input
                            value={tagDraft}
                            onChange={(e) => setTagDraft(e.target.value)}
                            placeholder="scope:shared"
                            className="h-8 rounded-md border border-border bg-[hsl(var(--canvas))] px-2 text-xs"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 text-xs"
                            disabled={savingTags}
                            onClick={() => void handleSaveTags()}
                          >
                            {savingTags ? <Spinner /> : 'Save tags'}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(detail.tags ?? []).map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px] font-normal px-2 py-0">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </aside>

              {/* Reader — primary focus */}
              <div
                ref={readerRef}
                className="order-2 min-h-0 overflow-y-auto overscroll-contain xl:order-1"
              >
                <div className="source-reader mx-auto w-full max-w-[78ch] px-4 py-5 sm:px-8 lg:px-10">
                  {editing ? (
                    <>
                      <p className="text-sm text-[hsl(var(--vault-muted))] mb-4 leading-relaxed">
                        Editing rebuilds extracted facts. Searchable in a few minutes.
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
                </div>
              </div>
            </div>
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
