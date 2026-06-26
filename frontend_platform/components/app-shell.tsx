'use client'

import { ApiPlayground } from './api-playground'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileTree } from './file-tree'
import { KnowledgeGraph } from './knowledge-graph'
import { MemoryEditor } from './memory-editor'
import { SearchPanel } from './search-panel'
import { StatsPanel } from './stats-panel'
import { FileUpload } from './file-upload'
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
  | 'editor'
  | 'upload'
  | 'graph'
  | 'search'
  | 'stats'
  | 'config'
  | 'export'
  | 'playground'

const WORK_VIEWS: { id: ViewType; label: string }[] = [
  { id: 'sources', label: 'Sources' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'editor', label: 'Add note' },
  { id: 'upload', label: 'Upload' },
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
    setActiveView('sources')
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
      <aside
        className={cn(
          'relative flex flex-col border-r border-[hsl(var(--vault-border))] bg-[hsl(var(--vault))] overflow-hidden shrink-0 transition-all duration-200 ease-out will-change-[width,opacity]',
          sidebarOpen ? 'w-60 opacity-100' : 'w-0 opacity-0 border-r-0',
        )}
      >
        <div className="px-3 py-2.5 border-b border-[hsl(var(--vault-border))]">
          <div className="flex items-center gap-2">
            <MarkIcon className="w-4 h-4 text-[hsl(var(--vault-active))]" title="Crewio.ai" />
            <div className="min-w-0">
              <span className="text-[13px] font-medium tracking-tight text-[hsl(var(--foreground))] block truncate">
                Crewio.ai
              </span>
              <span className="text-xs text-[hsl(var(--vault-muted))] block truncate">
                {modeMeta.title}
              </span>
            </div>
          </div>
        </div>

        <div className="px-3 pt-2 pb-1">
          <p className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--vault-muted))]">
            {modeMeta.sidebarLabel}
          </p>
        </div>

        <div className="flex-1 overflow-hidden min-w-0">
          <FileTree
            nodes={treeData}
            activeBank={activeBank}
            activeDocumentId={selectedDocumentId}
            refreshToken={sourcesRefreshToken}
            onSelectBank={handleSelectBank}
            onSelectDocument={handleSelectDocument}
            userRole={user.role}
          />
        </div>

        <div className="px-3 py-2.5 border-t border-[hsl(var(--vault-border))]">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 min-h-[44px] rounded shrink-0 flex items-center justify-center text-xs font-medium bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]"
              aria-hidden
            >
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium truncate">{user.name}</div>
              <div className="text-xs text-[hsl(var(--vault-muted))] truncate">{user.email}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] w-8 text-[hsl(var(--vault-muted))] hover:text-foreground hover:bg-[hsl(var(--secondary))]"
              onClick={handleLogout}
              aria-label="Log out"
            >
              <LeaveIcon className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
            <span
              className={cn(
                'text-xs font-medium px-1.5 py-0.5 rounded-sm shrink-0',
                mode === 'operations'
                  ? 'bg-[hsl(var(--mode-ops-muted))] text-[hsl(var(--mode-ops))]'
                  : mode === 'overview'
                    ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--mode-scope))]'
                    : 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
              )}
            >
              {roleLabel(user.role)}
            </span>
            <span className="text-xs text-[hsl(var(--vault-muted))] truncate">
              {activeBankLabel}
            </span>
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

          {!(activeView === 'sources' && selectedDocumentId) ? (
          <div
            className={cn(
              'px-4 py-1.5 border-t border-border text-xs leading-relaxed',
              isConsultant && isOpsView(activeView)
                ? 'bg-[hsl(var(--mode-ops-muted))]/50 text-[hsl(var(--foreground))]/90'
                : 'bg-[hsl(var(--secondary))]/30 text-[hsl(var(--vault-muted))]'
            )}
          >
            {scopeLine}
          </div>
          ) : null}

          <div
            className="flex gap-1 px-3 py-1 border-t border-border overflow-x-auto items-center"
            role="tablist"
            aria-label="Workspace views"
          >
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
              indexingPending={pendingOps}
              onSelectDocument={setSelectedDocumentId}
              onAddNote={() => goToView('editor')}
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
          {activeView === 'upload' && (
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="max-w-3xl mx-auto px-6 py-6">
              <FileUpload
                bankId={activeBank}
                teamLabel={activeTeam?.label}
                userRole={user.role}
                onSuccess={handleUploadSuccess}
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
              <div className="max-w-3xl mx-auto px-6 py-6">
              <SearchPanel
                bankId={activeBank}
                teamLabel={activeTeam?.label}
                canManagePlaybooks={user.role === 'consultant'}
                onOpenDocument={(docId) => openDocument(activeBank, docId)}
                onBrowseSources={() => goToView('sources')}
              />
              </div>
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
