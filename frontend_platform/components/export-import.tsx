'use client'

import { cn } from '@/lib/utils'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from './hindsight-icons'
import { WikiViewer } from './wiki-viewer'
import type { OkfWikiBundle } from '../../shared/lib/okf-wiki'

interface ExportImportProps {
  bankId: string
  bankLabel?: string
}

export function ExportImport({ bankId, bankLabel }: ExportImportProps) {
  const [exporting, setExporting] = useState(false)
  const [exportingWiki, setExportingWiki] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exportData, setExportData] = useState('')
  const [importData, setImportData] = useState('')
  const [message, setMessage] = useState('')
  const [wikiBundle, setWikiBundle] = useState<OkfWikiBundle | null>(null)
  const [showWiki, setShowWiki] = useState(false)

  async function handleExport() {
    setExporting(true)
    setMessage('')
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId }),
      })
      const data = await res.json()

      if (res.ok) {
        setExportData(JSON.stringify(data, null, 2))

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${bankId}-export-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)

        setMessage('Export downloaded successfully')
      } else {
        setMessage(data.error || 'Export failed')
      }
    } catch {
      setMessage('Error during export')
    } finally {
      setExporting(false)
    }
  }

  async function handleExportWiki(downloadOnly = false) {
    setExportingWiki(true)
    setMessage('')
    try {
      const res = await fetch('/api/export-wiki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId, bankLabel }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Wiki export failed')
        return
      }

      setWikiBundle({
        index: data.index,
        files: data.files,
        pages: data.pages ?? [],
        bankId: data.bankId ?? bankId,
        bankLabel: data.bankLabel ?? bankLabel,
      } as OkfWikiBundle)
      if (!downloadOnly) setShowWiki(true)

      const lines = Object.entries(data.files as Record<string, string>).map(
        ([path, content]) => `<!-- FILE: ${path} -->\n${content}`
      )
      const blob = new Blob([lines.join('\n\n---\n\n')], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${bankId}-wiki-${new Date().toISOString().slice(0, 10)}.mdbundle.txt`
      a.click()
      URL.revokeObjectURL(url)

      setMessage(`Wiki export: ${Object.keys(data.files).length} pages`)
    } catch {
      setMessage('Error during wiki export')
    } finally {
      setExportingWiki(false)
    }
  }

  async function handleImport() {
    if (!importData.trim()) {
      setMessage('Please paste JSON data to import')
      return
    }

    setImporting(true)
    setMessage('')
    try {
      const parsed = JSON.parse(importData)

      if (!parsed.memories || !Array.isArray(parsed.memories)) {
        setMessage('Invalid format: missing memories array')
        return
      }

      const res = await fetch('/api/banks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId: `${bankId}-imported-${Date.now()}` }),
      })

      if (res.ok) {
        setMessage(
          `Import validated: ${parsed.memories.length} memories ready. Create new bank to proceed.`
        )
        setImportData('')
      } else {
        setMessage('Failed to prepare import')
      }
    } catch {
      setMessage('Invalid JSON format')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-sm font-medium tracking-tight">Export & Import</h1>
          <p className="text-xs text-[hsl(var(--vault-muted))] mt-1">
            Backup, migrate, or restore bank data
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px] font-normal">
          {bankId}
        </Badge>
      </div>

      <div className="space-y-6">
        {/* Export bank */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--vault-muted))]">
              Export bank
            </h2>
          </div>
          <p className="text-xs text-[hsl(var(--vault-muted))] leading-relaxed">
            Download all memories, entities, and mental models as JSON for backup or migration.
          </p>
          <Button onClick={handleExport} disabled={exporting} className="text-xs min-h-[44px]">
            {exporting ? <Spinner className="mr-2" /> : null}
            Export and download
          </Button>
          {exportData ? (
            <Textarea
              value={exportData.slice(0, 500) + (exportData.length > 500 ? '...' : '')}
              readOnly
              className="h-24 text-[11px] font-mono"
            />
          ) : null}
        </div>

        {/* Export wiki */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--vault-muted))]">
              Export wiki (OKF)
            </h2>
            <Badge variant="outline" className="text-[10px] font-normal">
              sources + entities
            </Badge>
          </div>
          <p className="text-xs text-[hsl(var(--vault-muted))] leading-relaxed">
            Generate read-only Markdown pages under <code className="text-[11px]">sources/</code>{' '}
            and <code className="text-[11px]">entities/</code> with OKF-style frontmatter and
            provenance links. Uses stable <code className="text-[11px]">document_id</code> slugs.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void handleExportWiki(false)}
              disabled={exportingWiki}
              className="text-xs min-h-[44px]"
            >
              {exportingWiki ? <Spinner className="mr-2" /> : null}
              Export wiki
            </Button>
            {wikiBundle ? (
              <Button
                variant="outline"
                onClick={() => setShowWiki((v) => !v)}
                className="text-xs min-h-[44px]"
              >
                {showWiki ? 'Hide preview' : 'Preview in portal'}
              </Button>
            ) : null}
          </div>
          {showWiki && wikiBundle ? <WikiViewer bundle={wikiBundle} /> : null}
        </div>

        {/* Import */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--vault-muted))]">
              Import bank
            </h2>
            <Badge variant="outline" className="text-[10px] font-normal">
              New bank
            </Badge>
          </div>
          <div className="bg-[hsl(var(--warning-bg))] border border-[hsl(var(--warning-border))] rounded-md p-3 text-xs text-[hsl(var(--warning-fg))] leading-relaxed">
            Import creates a new bank. Paste previously exported JSON below. This cannot be undone.
          </div>
          <Textarea
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            placeholder="Paste exported JSON here…"
            className="h-40 text-[11px] font-mono"
          />
          <Button onClick={handleImport} disabled={importing} variant="secondary" className="text-xs min-h-[44px]">
            {importing ? <Spinner className="mr-2" /> : null}
            Validate import
          </Button>
        </div>
      </div>

      {message ? (
        <div
          className={cn(
            'text-xs p-3 rounded-md border',
            message.includes('success') || message.includes('validated') || message.includes('Wiki export')
              ? 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success-fg))] border-[hsl(var(--success-border))]'
              : 'bg-[hsl(var(--error-bg))] text-[hsl(var(--error-fg))] border-[hsl(var(--error-border))]'
          )}
        >
          {message}
        </div>
      ) : null}
    </div>
  )
}
