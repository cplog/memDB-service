'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronIcon } from './hindsight-icons'
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
}

interface FileTreeProps {
  nodes: TreeNode[]
  activeBank: string
  activeDocumentId?: string | null
  refreshToken?: number
  onSelectBank: (bankId: string) => void
  onSelectDocument?: (bankId: string, documentId: string) => void
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
  onSelectBank,
  onSelectDocument,
  userRole,
}: FileTreeProps) {
  const wideAccess = userRole === 'consultant' || userRole === 'manager'
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [vaultOpen, setVaultOpen] = useState(true)
  const [docCache, setDocCache] = useState<Record<string, TreeNode[]>>({})
  const [loadingBanks, setLoadingBanks] = useState<Set<string>>(new Set())
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

  const ensureExpanded = useCallback((ids: string[]) => {
    setExpanded((prev) => new Set([...Array.from(prev), ...ids]))
  }, [])

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  useEffect(() => {
    if (!nodes[0]?.id) return
    ensureExpanded([nodes[0].id, ...bankIds])
    if (wideAccess) {
      for (const bankId of bankIds) void loadDocuments(bankId)
    }
  }, [nodes, bankIds, wideAccess, ensureExpanded, loadDocuments])

  useEffect(() => {
    if (!nodes[0]?.id || wideAccess) return
    ensureExpanded([nodes[0].id, activeBank])
    void loadDocuments(activeBank)
  }, [activeBank, nodes, wideAccess, ensureExpanded, loadDocuments])

  useEffect(() => {
    if (refreshToken <= 0) return
    setDocCache((prev) => {
      const next = { ...prev }
      delete next[activeBank]
      return next
    })
    void loadDocuments(activeBank, true)
  }, [refreshToken, activeBank, loadDocuments])

  const renderNode = (node: TreeNode, depth = 0) => {
    const isExpanded = expanded.has(node.id)
    const isActiveBank = node.bankId === activeBank && node.type === 'bank'
    const isActiveDoc =
      node.type === 'document' &&
      node.documentId === activeDocumentId &&
      node.bankId === activeBank
    const isActive = isActiveBank || isActiveDoc
    const isBank = node.type === 'bank'
    const isDocument = node.type === 'document'
    const isCompany = node.type === 'company'
    const hasExpandable = isCompany || isBank
    const docs = isBank && node.bankId ? docCache[node.bankId] ?? [] : []
    const docsLoaded = isBank && node.bankId ? docCache[node.bankId] !== undefined : false
    const isLoadingDocs = isBank && node.bankId ? loadingBanks.has(node.bankId) : false

    const showSubtitle =
      isDocument &&
      node.documentSubtitle &&
      node.documentSubtitle !== node.name &&
      !node.documentSubtitle.startsWith(node.name)

    return (
      <div key={node.id} className="min-w-0 max-w-full">
        <button
          type="button"
          className={cn(
            'w-full max-w-full min-w-0 flex items-start gap-1.5 py-1 pr-2 rounded-md text-left overflow-hidden group transition-colors',
            isActive
              ? 'text-[hsl(var(--vault-active))] bg-[hsl(var(--accent))]/10'
              : 'text-[hsl(var(--vault-muted))] hover:text-foreground hover:bg-[hsl(var(--secondary))]'
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={(event) => {
            const toggleTarget = (event.target as HTMLElement).closest('[data-tree-toggle]')
            if (toggleTarget && hasExpandable) {
              toggleExpanded(node.id)
              if (isBank && node.bankId) void loadDocuments(node.bankId)
              return
            }
            if (node.type === 'document' && node.bankId && node.documentId) {
              onSelectDocument?.(node.bankId, node.documentId)
              return
            }
            if (isBank && node.bankId) {
              ensureExpanded([nodes[0]?.id ?? '', node.id])
              void loadDocuments(node.bankId)
              onSelectBank(node.bankId)
              return
            }
            if (hasExpandable) {
              toggleExpanded(node.id)
            }
          }}
        >
          {hasExpandable ? (
            <span
              data-tree-toggle
              className="min-h-[28px] w-4 shrink-0 inline-flex items-center justify-center"
              aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            >
              <ChevronIcon
                className={cn('w-3 h-3 opacity-60 transition-transform', isExpanded && 'opacity-90')}
                open={isExpanded}
              />
            </span>
          ) : (
            <span className="w-3 shrink-0" aria-hidden />
          )}
          <span className="min-w-0 flex-1 overflow-hidden">
            <span
              className={cn(
                'block text-sm leading-snug truncate',
                isActive && 'font-medium',
                isBank && !isActive && 'text-foreground/80 font-medium'
              )}
              title={node.name}
            >
              {node.name}
            </span>
            {showSubtitle ? (
              <span
                className="block truncate text-[10px] leading-tight opacity-60 mt-0.5"
                title={node.documentSubtitle}
              >
                {node.documentSubtitle}
              </span>
            ) : null}
          </span>
          {isBank && docsLoaded ? (
            <span className="shrink-0 text-xs tabular-nums opacity-50 group-hover:opacity-70">
              {docs.length}
            </span>
          ) : isLoadingDocs ? (
            <span className="text-xs opacity-40">…</span>
          ) : null}
        </button>

        {isExpanded && isBank && node.bankId ? (
          <div className="mt-0.5">
            {docsLoaded && !docs.length && !isLoadingDocs ? (
              <p
                className="text-xs text-[hsl(var(--vault-muted))] py-1 opacity-60"
                style={{ paddingLeft: `${(depth + 1) * 16 + 28}px` }}
              >
                empty
              </p>
            ) : null}
            {docs.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}

        {isExpanded && isCompany && node.children?.length ? (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        ) : null}
      </div>
    )
  }

  return (
    <ScrollArea className="h-full min-w-0">
      <div className="min-w-0 max-w-full py-3 px-1.5">
        <button
          type="button"
          className="w-full flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[hsl(var(--vault-muted))] px-3 mb-2 opacity-70 hover:opacity-100"
          onClick={() => setVaultOpen((open) => !open)}
          aria-expanded={vaultOpen}
        >
          <ChevronIcon className="w-3 h-3" open={vaultOpen} />
          Vault
        </button>
        {vaultOpen ? (
          <div className="space-y-0.5">
            {nodes.map((node) => renderNode(node))}
          </div>
        ) : null}
      </div>
    </ScrollArea>
  )
}
