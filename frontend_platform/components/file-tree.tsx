'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ChevronIcon, DocIcon, TeamIcon } from './hindsight-icons'
import { documentTreeLabels } from '@/lib/document-display'

interface TreeNode {
  id: string
  name: string
  type: 'root' | 'company' | 'team' | 'bank' | 'document'
  children?: TreeNode[]
  bankId?: string
  documentId?: string
  documentSubtitle?: string
  count?: number
  updatedAt?: string
  tags?: string[]
  factCount?: number
}

interface FileTreeProps {
  nodes: TreeNode[]
  activeBank: string
  activeDocumentId?: string | null
  refreshToken?: number
  searchQuery?: string
  onSelectBank: (bankId: string) => void
  onSelectDocument?: (bankId: string, documentId: string) => void
  onDeleteDocument?: (bankId: string, documentId: string) => void
  userRole: string
}

function collectBankIds(nodeList: TreeNode[]): string[] {
  const ids: string[] = []
  for (const node of nodeList) {
    if (node.type === 'bank' && node.bankId) ids.push(node.bankId)
    if (node.children?.length) ids.push(...collectBankIds(node.children))
  }
  return ids
}

export function FileTree({
  nodes,
  activeBank,
  activeDocumentId,
  refreshToken = 0,
  searchQuery = '',
  onSelectBank,
  onSelectDocument,
  onDeleteDocument,
  userRole,
}: FileTreeProps) {
  const wideAccess = userRole === 'consultant' || userRole === 'manager'
  const [docCache, setDocCache] = useState<Record<string, TreeNode[]>>({})
  const [loadingBanks, setLoadingBanks] = useState<Set<string>>(new Set())
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const inflightRef = useRef<Set<string>>(new Set())
  const docCacheRef = useRef(docCache)
  docCacheRef.current = docCache

  const bankIds = useMemo(() => collectBankIds(nodes), [nodes])

  const loadDocuments = useCallback(async (bankId: string, force = false) => {
    if (!force && (docCacheRef.current[bankId] || inflightRef.current.has(bankId))) return
    inflightRef.current.add(bankId)
    setLoadingBanks((prev) => new Set(prev).add(bankId))
    try {
      const res = await fetch(`/api/documents?bankId=${encodeURIComponent(bankId)}&limit=50`)
      if (!res.ok) return
      const data = await res.json()
      const children = (data.items ?? [])
        .map((row: Record<string, unknown>) => {
          const id = String(row.id ?? '')
          const meta = row.document_metadata as Record<string, unknown> | undefined
          const labels = documentTreeLabels(id, meta)
          return {
            id: `${bankId}::${id}`,
            name: labels.primary,
            documentSubtitle: labels.secondary,
            type: 'document' as const,
            bankId,
            documentId: id,
            updatedAt: String(row.updated_at ?? ''),
            tags: Array.isArray(row.tags) ? row.tags as string[] : [],
            factCount: Number(row.memory_unit_count ?? 0),
          }
        })
        .filter((n: TreeNode) => n.documentId)
      setDocCache((prev) => ({ ...prev, [bankId]: children }))
    } finally {
      inflightRef.current.delete(bankId)
      setLoadingBanks((prev) => {
        const next = new Set(prev)
        next.delete(bankId)
        return next
      })
    }
  }, [])

  // Load all docs for wide-access users on mount
  useEffect(() => {
    if (wideAccess) {
      for (const bankId of bankIds) void loadDocuments(bankId)
    }
  }, [bankIds, wideAccess, loadDocuments])

  // Load docs for single-bank users when bank changes
  useEffect(() => {
    if (wideAccess) return
    void loadDocuments(activeBank)
  }, [activeBank, wideAccess, loadDocuments])

  // Refresh on token change
  useEffect(() => {
    if (refreshToken <= 0) return
    setDocCache((prev) => {
      const next = { ...prev }
      delete next[activeBank]
      return next
    })
    void loadDocuments(activeBank, true)
  }, [refreshToken, activeBank, loadDocuments])

  // Filter docs based on search query
  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return docCache
    const q = searchQuery.toLowerCase()
    const result: Record<string, TreeNode[]> = {}
    for (const [bankId, docs] of Object.entries(docCache)) {
      result[bankId] = docs.filter((doc) => {
        const matchesName = doc.name.toLowerCase().includes(q)
        const matchesTags = doc.tags?.some((t) => t.toLowerCase().includes(q))
        const matchesSubtitle = doc.documentSubtitle?.toLowerCase().includes(q)
        return matchesName || matchesTags || matchesSubtitle
      })
    }
    return result
  }, [docCache, searchQuery])

  // Format relative date
  const formatRelativeDate = (dateStr: string) => {
    if (!dateStr) return null
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)
      if (diffMins < 1) return 'just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays < 7) return `${diffDays}d ago`
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return null
    }
  }

  const banks = useMemo(() => {
    const result: { bank: TreeNode; docs: TreeNode[] }[] = []
    for (const node of nodes) {
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'bank' && child.bankId) {
            result.push({
              bank: child,
              docs: filteredDocs[child.bankId] ?? [],
            })
          }
        }
      }
    }
    return result
  }, [nodes, filteredDocs])

  return (
    <ScrollArea className="h-full min-w-0">
      <div className="min-w-0 max-w-full py-2 px-2">
        {banks.length === 0 && searchQuery.trim() ? (
          <p className="px-2.5 py-4 text-[11px] text-[hsl(var(--vault-muted))] opacity-50 text-center">
            No matches for &ldquo;{searchQuery}&rdquo;
          </p>
        ) : (
          banks.map(({ bank, docs }) => {
            const isActiveBank = bank.bankId === activeBank
            const isLoading = bank.bankId ? loadingBanks.has(bank.bankId) : false

            return (
              <div key={bank.id} className="mb-1">
                {/* Bank header */}
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors group',
                    isActiveBank
                      ? 'text-[hsl(var(--vault-active))]'
                      : 'text-[hsl(var(--vault-muted))] hover:text-foreground hover:bg-[hsl(var(--secondary))]'
                  )}
                  onClick={() => {
                    onSelectBank(bank.bankId!)
                  }}
                >
                  <TeamIcon className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                  <span className="text-[13px] font-medium truncate flex-1">{bank.name}</span>
                  {isLoading ? (
                    <span className="text-[11px] opacity-40">…</span>
                  ) : docs.length > 0 ? (
                    <span className="text-[11px] tabular-nums opacity-40 group-hover:opacity-60">
                      {docs.length}
                    </span>
                  ) : null}
                </button>

                {/* Documents */}
                <div className="ml-2 mt-0.5 space-y-px">
                  {docs.length === 0 && !isLoading ? (
                    <p className="px-2.5 py-1.5 text-[11px] text-[hsl(var(--vault-muted))] opacity-50">
                      No documents
                    </p>
                  ) : (
                    docs.map((doc) => {
                      const isActive =
                        doc.documentId === activeDocumentId && doc.bankId === activeBank
                      const showSubtitle =
                        doc.documentSubtitle &&
                        doc.documentSubtitle !== doc.name &&
                        !doc.documentSubtitle.startsWith(doc.name)
                      const isDeleting = deletingDocId === doc.id

                      return (
                        <div key={doc.id} className="relative group">
                          <button
                            type="button"
                            className={cn(
                              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors',
                              isActive
                                ? 'bg-[hsl(var(--accent))]/10 text-[hsl(var(--vault-active))] font-medium'
                                : 'text-[hsl(var(--vault-muted))] hover:text-foreground hover:bg-[hsl(var(--secondary))]'
                            )}
                            onClick={() => onSelectDocument?.(doc.bankId!, doc.documentId!)}
                          >
                            <DocIcon className={cn('w-3.5 h-3.5', isActive ? 'opacity-80' : 'opacity-50 group-hover:opacity-70')} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] leading-snug truncate">
                                {doc.name}
                              </span>
                              <span className="flex items-center gap-1.5 mt-px">
                                {showSubtitle ? (
                                  <span className="block text-[11px] leading-tight opacity-50 truncate">
                                    {doc.documentSubtitle}
                                  </span>
                                ) : null}
                                {doc.factCount != null && doc.factCount > 0 ? (
                                  <span className="text-[10px] text-[hsl(var(--vault-muted))] tabular-nums shrink-0">
                                    {doc.factCount} facts
                                  </span>
                                ) : null}
                                {doc.updatedAt ? (
                                  <span className="text-[10px] text-[hsl(var(--vault-muted))] tabular-nums shrink-0" title={doc.updatedAt}>
                                    {formatRelativeDate(doc.updatedAt)}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          </button>
                          {/* Delete button on hover */}
                          {onDeleteDocument && doc.bankId && doc.documentId ? (
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isDeleting ? (
                                <div className="flex items-center gap-1 bg-[hsl(var(--card))] border border-[hsl(var(--error-border))] rounded px-1.5 py-0.5">
                                  <span className="text-[10px] text-[hsl(var(--error-fg))]">Delete?</span>
                                  <button
                                    type="button"
                                    className="text-[10px] text-[hsl(var(--error-fg))] font-medium hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onDeleteDocument(doc.bankId!, doc.documentId!)
                                      setDeletingDocId(null)
                                    }}
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    className="text-[10px] text-[hsl(var(--vault-muted))] hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setDeletingDocId(null)
                                    }}
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="w-6 h-6 text-[hsl(var(--vault-muted))] hover:text-[hsl(var(--error-fg))] hover:bg-[hsl(var(--error-bg))]"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeletingDocId(doc.id)
                                  }}
                                  aria-label={`Delete ${doc.name}`}
                                >
                                  <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                    <path d="M4 4l8 8M12 4l-8 8" />
                                  </svg>
                                </Button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </ScrollArea>
  )
}
