'use client'

import { ApiPlayground } from './api-playground'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileTree } from './file-tree'
import { KnowledgeGraph } from './knowledge-graph'
import { MemoryEditor } from './memory-editor'
import { SearchPanel } from './search-panel'
import { StatsPanel } from './stats-panel'
import { TimelinePanel } from './timeline-panel'
import { AdminSettings } from './admin-settings'
import { ExportImport } from './export-import'
import { DocumentsPanel } from './documents-panel'
import { MemoriesPanel } from './memories-panel'
import { EntityDetail } from './entity-detail'
import { Button } from '@/components/ui/button'
import { MarkIcon, SidebarIcon, LeaveIcon } from './hindsight-icons'
import { useRouter } from 'next/navigation'
import { teamBankId, sharedBankId, parseTeamBankId, type TeamDef } from '@/lib/teams'
import { documentDisplayName } from '@/lib/document-display'
import {
  workspaceMode,
  roleLabel,
  MODE_META,
  isOpsView,
} from '@/lib/workspace-mode'
import { cn } from '@/lib/utils'
import { useScramblePlaceholder } from '@/hooks/use-scramble-text'

interface AppShellProps {
  user: {
    id: string
    name: string
    email: string
    role: string
    companySlug: string
  }
  teams: TeamDef[]
}

type ViewType =
  | 'sources'
  | 'knowledge'
  | 'timeline'
  | 'editor'
  | 'graph'
  | 'search'
  | 'stats'
  | 'config'
  | 'export'
  | 'playground'

const WORK_VIEWS: { id: ViewType; label: string }[] = [
  { id: 'sources', label: 'Sources' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'editor', label: 'Add note' },
  { id: 'search', label: 'Query' },
  { id: 'graph', label: 'Graph' },
  { id: 'playground', label: 'API' },
]

const OPS_VIEWS: { id: ViewType; label: string }[] = [
  { id: 'stats', label: 'Stats' },
  { id: 'config', label: 'Config' },
  { id: 'export', label: 'Export' },
]

export function AppShell({ user, teams }: AppShellProps) {
  const cs = user.companySlug
  const firstBank = teams[0] ? teamBankId(teams[0].id, cs) : teamBankId('product', cs)
  const [activeBank, setActiveBank] = useState(firstBank)
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // ponytail: default sidebar closed on mobile (<768px), open on desktop
    if (typeof window !== 'undefined') return window.innerWidth >= 768
    return true
  })
  const [activeView, setActiveView] = useState<ViewType>('sources')
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [pendingOps, setPendingOps] = useState(0)
  const [sourcesRefreshToken, setSourcesRefreshToken] = useState(0)
  const [sourcesUploadOpen, setSourcesUploadOpen] = useState(false)
  const [attachDocumentId, setAttachDocumentId] = useState<string | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<{
    id: string
    name: string
  } | null>(null)
  const router = useRouter()
  const mode = workspaceMode(user.role)
  const modeMeta = MODE_META[mode]
  const isConsultant = user.role === 'consultant'

  const placeholderPhrases = [
    'Search documents…',
    'Find by name…',
    'Filter by tags…',
    'Query your vault…',
  ]
  const { placeholder: scramblePlaceholder } = useScramblePlaceholder(placeholderPhrases, 4000)

  const activeTeam = teams.find((t) => teamBankId(t.id, cs) === activeBank)
  const activeBankLabel =
    activeTeam?.label ??
    (sharedBankId(cs) === activeBank ? 'Shared' : parseTeamBankId(activeBank) ?? activeBank)

  const scopeLine =
    isConsultant && isOpsView(activeView)
      ? modeMeta.opsScopeLine
      : modeMeta.scopeLine

  const showBankId = isConsultant && !selectedDocumentId

  const treeData = useMemo(() => {
    const bankNodes = teams.map((t) => ({
      id: teamBankId(t.id, cs),
      name: t.label,
      type: 'bank' as const,
      bankId: teamBankId(t.id, cs),
    }))
    const shared = sharedBankId(cs)
    if (shared && (user.role === 'consultant' || user.role === 'manager')) {
      bankNodes.push({
        id: shared,
        name: 'Shared',
        type: 'bank' as const,
        bankId: shared,
      })
    }
    return [
      {
        id: cs,
        name: mode === 'workspace' ? 'Teams' : cs.toUpperCase(),
        type: 'company' as const,
        children: bankNodes,
      },
    ]
  }, [cs, teams, user.role, mode])

  const goToView = useCallback((view: ViewType) => {
    setActiveView(view)
    if (view !== 'sources') setSourcesUploadOpen(false)
  }, [])

  const refreshPendingOps = useCallback(() => {
    fetch('/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankId: activeBank }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setPendingOps(Number(data.pending_operations ?? 0))
      })
      .catch(() => {})
  }, [activeBank])

  const handleUploadSuccess = useCallback(
    (results?: unknown[]) => {
      if (results && results.length === 0) {
        setActiveView('sources')
        return
      }
      setSourcesRefreshToken((t) => t + 1)
      refreshPendingOps()
    },
    [refreshPendingOps]
  )

  const openSourcesUpload = useCallback(() => {
    setActiveView('sources')
    setSourcesUploadOpen(true)
  }, [])

  const openDocument = useCallback((bankId: string, documentId: string) => {
    setActiveBank(bankId)
    setSelectedDocumentId(documentId)
    setSelectedEntity(null)
    setActiveView('knowledge')
  }, [])

  const openEntity = useCallback((entityId: string, entityName: string) => {
    setSelectedEntity({ id: entityId, name: entityName })
  }, [])

  const continueSource = useCallback((documentId: string) => {
    setAttachDocumentId(documentId)
    setActiveView('editor')
  }, [])

  const addToDocument = useCallback((documentId: string) => {
    setAttachDocumentId(documentId)
    setActiveView('editor')
  }, [])

  const handleSelectBank = useCallback((bankId: string) => {
    setActiveBank(bankId)
    setSelectedDocumentId(null)
  }, [])

  const handleSelectDocument = useCallback((bankId: string, documentId: string) => {
    openDocument(bankId, documentId)
  }, [openDocument])

  const handleDeleteDocument = useCallback(async (bankId: string, documentId: string) => {
    try {
      const res = await fetch(`/api/documents/${documentId}?bankId=${encodeURIComponent(bankId)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setSelectedDocumentId((prev) => (prev === documentId ? null : prev))
        setSourcesRefreshToken((t) => t + 1)
      }
    } catch {
      // Silently fail — user can retry
    }
  }, [])

  const handleAddNote = useCallback(() => {
    setAttachDocumentId(null)
    goToView('editor')
  }, [goToView])

  const handleOnSave = useCallback((navigate?: boolean) => {
    refreshPendingOps()
    if (navigate) goToView('knowledge')
  }, [refreshPendingOps, goToView])

  useEffect(() => {
    let cancelled = false
    fetch('/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankId: activeBank }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setPendingOps(Number(data.pending_operations ?? 0))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [activeBank, activeView])

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl + K → focus search (Query tab)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        goToView('search')
        return
      }
      // Number keys 1-7 switch tabs (no modifier, not in input/textarea)
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
        const num = parseInt(e.key, 10)
        if (num >= 1 && num <= WORK_VIEWS.length) {
          goToView(WORK_VIEWS[num - 1].id)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToView])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const docBreadcrumb = selectedDocumentId
    ? documentDisplayName(selectedDocumentId)
    : null

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-[hsl(var(--primary))] focus:text-[hsl(var(--primary-foreground))] focus:px-4 focus:py-2 focus:rounded-md"
      >
        Skip to main content
      </a>
    <div
      data-workspace-mode={mode}
      className={cn(
        'h-[100dvh] w-full overflow-hidden flex bg-[hsl(var(--canvas))] text-foreground',
      )}
    >
      {/* Mobile backdrop */}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          'flex flex-col border-r border-[hsl(var(--vault-border))] bg-[hsl(var(--vault))] overflow-hidden shrink-0 transition-all duration-200 ease-out will-change-[width,opacity]',
          'fixed inset-y-0 left-0 z-40 md:relative md:z-auto',
          sidebarOpen ? 'w-60 opacity-100' : 'w-0 opacity-0 border-r-0',
        )}
      >
        <div className="px-3 py-3 border-b border-[hsl(var(--vault-border))]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[hsl(var(--accent))] flex items-center justify-center" aria-hidden>
              <MarkIcon className="w-4 h-4 text-[hsl(var(--accent-foreground))]" />
            </div>
            <div className="min-w-0">
              <span className="text-[13px] font-semibold tracking-tight text-[hsl(var(--foreground))] block truncate">
                Crewio.ai
              </span>
              <span className="text-[11px] text-[hsl(var(--vault-muted))] block truncate">
                {modeMeta.title}
              </span>
            </div>
          </div>
        </div>

        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--vault-muted))] opacity-60">
              {modeMeta.sidebarLabel}
            </p>
            {pendingOps > 0 ? (
              <span className="text-[10px] text-[hsl(var(--warning-fg))] bg-[hsl(var(--warning-bg))] border border-[hsl(var(--warning-border))] px-1.5 py-0.5 rounded tabular-nums">
                {pendingOps} indexing
              </span>
            ) : null}
          </div>
        </div>

        <div className="px-3 pb-2">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--vault-muted))]"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" />
            </svg>
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder={scramblePlaceholder}
              className="w-full h-8 pl-8 pr-2 text-[12px] rounded-md border border-[hsl(var(--vault-border))] bg-[hsl(var(--canvas))] text-foreground placeholder:text-[hsl(var(--vault-muted))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--vault-active))]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden min-w-0">
          <FileTree
            nodes={treeData}
            activeBank={activeBank}
            activeDocumentId={selectedDocumentId}
            refreshToken={sourcesRefreshToken}
            searchQuery={sidebarSearch}
            onSelectBank={handleSelectBank}
            onSelectDocument={handleSelectDocument}
            onDeleteDocument={isConsultant ? handleDeleteDocument : undefined}
            userRole={user.role}
          />
        </div>

        <div className="px-3 py-2.5 border-t border-[hsl(var(--vault-border))]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-medium bg-[hsl(var(--accent))]/15 text-[hsl(var(--vault-active))]"
              aria-hidden
            >
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium truncate leading-tight">{user.name}</div>
              <div className="text-[11px] text-[hsl(var(--vault-muted))] truncate">{user.email}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-[hsl(var(--vault-muted))] hover:text-foreground hover:bg-[hsl(var(--secondary))]"
              onClick={handleLogout}
              aria-label="Log out"
            >
              <LeaveIcon className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      <main id="main-content" className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <header className="shrink-0 border-b border-border bg-[hsl(var(--card))]">
          <div className="flex items-center gap-2 px-4 h-10">
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-[hsl(var(--vault-muted))] hover:text-foreground"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <SidebarIcon className="w-3.5 h-3.5" />
            </Button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0 text-[13px]">
              <span className="font-medium truncate">{activeBankLabel}</span>
              {docBreadcrumb ? (
                <>
                  <span className="text-[hsl(var(--vault-muted))]">/</span>
                  <span className="text-[hsl(var(--vault-muted))] truncate text-xs">
                    {docBreadcrumb}
                  </span>
                </>
              ) : showBankId ? (
                <span className="text-xs text-[hsl(var(--vault-muted))] truncate hidden sm:inline font-mono ml-1 opacity-70">
                  {activeBank}
                </span>
              ) : null}
            </nav>

            {pendingOps > 0 ? (
              <span className="ml-auto text-xs text-[hsl(var(--warning-fg))] bg-[hsl(var(--warning-bg))] border border-[hsl(var(--warning-border))] px-2 py-0.5 rounded shrink-0">
                Indexing {pendingOps}
              </span>
            ) : null}
          </div>

          {isOpsView(activeView) ? (
          <div
            className={cn(
              'px-4 py-1.5 border-t border-border text-xs leading-relaxed',
              'bg-[hsl(var(--mode-ops-muted))]/50 text-[hsl(var(--foreground))]/90'
            )}
          >
            {scopeLine}
          </div>
          ) : null}

          <div
            className={cn(
              'flex gap-1 px-3 py-1 border-t border-border overflow-x-auto items-center',
              selectedDocumentId && activeView === 'sources' && 'py-0.5'
            )}
            role="tablist"
            aria-label="Workspace views"
          >
            {selectedDocumentId && activeView === 'sources' ? (
              /* Compact mode: show only active tab with a back-to-tabs affordance */
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setSelectedDocumentId(null)}
                  className="text-[hsl(var(--vault-muted))] hover:text-foreground transition-colors shrink-0"
                  aria-label="Back to tab list"
                >
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M10 3.5 5.5 8l4.5 4.5" />
                  </svg>
                </button>
                <span className="text-xs font-medium text-foreground truncate min-h-[32px] flex items-center">
                  {WORK_VIEWS.find((v) => v.id === activeView)?.label ?? activeView}
                </span>
              </div>
            ) : (
              <>
                {WORK_VIEWS.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    role="tab"
                    aria-selected={activeView === view.id}
                    onClick={() => goToView(view.id)}
                    className={cn(
                      'px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap min-h-[36px]',
                      activeView === view.id
                        ? 'border-[hsl(var(--mode-scope))] text-foreground'
                        : 'border-transparent text-[hsl(var(--vault-muted))] hover:text-foreground/80'
                    )}
                  >
                    {view.label}
                  </button>
                ))}

                {isConsultant ? (
                  <>
                    <span className="w-px h-4 bg-border mx-1 shrink-0 self-center" aria-hidden />
                    <span className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--mode-ops))] px-1 shrink-0 self-center">
                      Ops
                    </span>
                    {OPS_VIEWS.map((view) => (
                      <button
                        key={view.id}
                        type="button"
                        role="tab"
                        aria-selected={activeView === view.id}
                        onClick={() => goToView(view.id)}
                        className={cn(
                          'px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap min-h-[36px]',
                          activeView === view.id
                            ? 'border-[hsl(var(--mode-ops))] text-foreground'
                            : 'border-transparent text-[hsl(var(--vault-muted))] hover:text-[hsl(var(--mode-ops))]/80'
                        )}
                      >
                        {view.label}
                      </button>
                    ))}
                  </>
                ) : null}
              </>
            )}
          </div>
        </header>

        <div
          className={cn(
            'flex-1 overflow-hidden bg-[hsl(var(--canvas))] flex flex-col min-h-0',
            isConsultant && isOpsView(activeView) && 'bg-[hsl(var(--vault))]/20'
          )}
        >
          {activeView === 'sources' && (
            <DocumentsPanel
              bankId={activeBank}
              teamLabel={activeTeam?.label}
              userRole={user.role}
              selectedDocumentId={selectedDocumentId}
              refreshToken={sourcesRefreshToken}
              uploadOpen={sourcesUploadOpen}
              onSelectDocument={setSelectedDocumentId}
              onToggleUpload={() => setSourcesUploadOpen((o) => !o)}
              onUploadComplete={handleUploadSuccess}
              onViewKnowledge={() => goToView('knowledge')}
              onContinueSource={continueSource}
            />
          )}
          {activeView === 'knowledge' && (
            <MemoriesPanel
              bankId={activeBank}
              teamLabel={activeTeam?.label}
              documentId={selectedDocumentId}
              onOpenDocument={(docId) => openDocument(activeBank, docId)}
              onSelectEntity={openEntity}
              onAddNote={handleAddNote}
              onUpload={openSourcesUpload}
              onAddToDocument={addToDocument}
            />
          )}
          {activeView === 'timeline' && (
            <TimelinePanel
              bankId={activeBank}
              onSelectEntity={openEntity}
              onOpenDocument={(docId) => openDocument(activeBank, docId)}
            />
          )}
          {activeView === 'editor' && (
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="max-w-3xl mx-auto px-6 py-6">
              <MemoryEditor
                bankId={activeBank}
                teamLabel={activeTeam?.label}
                attachDocumentId={attachDocumentId}
                onSave={handleOnSave}
              />
              </div>
            </div>
          )}
          {activeView === 'graph' && (
            <KnowledgeGraph
              bankId={activeBank}
              bankLabel={activeBankLabel}
              userRole={user.role}
              onOpenDocument={(docId) => openDocument(activeBank, docId)}
              onSelectEntity={openEntity}
            />
          )}
          {activeView === 'search' && (
            <div className="flex-1 min-h-0 overflow-auto">
              <SearchPanel
                bankId={activeBank}
                teamLabel={activeTeam?.label}
                canManagePlaybooks={user.role === 'consultant'}
                onOpenDocument={(docId) => openDocument(activeBank, docId)}
                onBrowseSources={() => goToView('sources')}
              />
            </div>
          )}
          {activeView === 'stats' && (
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="max-w-3xl mx-auto px-6 py-6">
              <StatsPanel bankId={activeBank} />
              </div>
            </div>
          )}
          {activeView === 'config' && (
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="max-w-3xl mx-auto px-6 py-6">
              <AdminSettings bankId={activeBank} />
              </div>
            </div>
          )}
          {activeView === 'export' && (
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="max-w-3xl mx-auto px-6 py-6">
              <ExportImport bankId={activeBank} bankLabel={activeBankLabel} />
              </div>
            </div>
          )}
          {activeView === 'playground' && (
            <div className="flex-1 min-h-0 overflow-auto">
              <ApiPlayground bankId={activeBank} />
            </div>
          )}
        </div>

        {selectedEntity ? (
          <EntityDetail
            bankId={activeBank}
            entityId={selectedEntity.id}
            entityName={selectedEntity.name}
            onClose={() => setSelectedEntity(null)}
            onOpenDocument={(docId) => openDocument(activeBank, docId)}
          />
        ) : null}
      </main>
    </div>
    </>
  )
}
