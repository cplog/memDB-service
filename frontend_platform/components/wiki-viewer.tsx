'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { MarkdownPreview } from './markdown-field'
import { Spinner } from './hindsight-icons'
import {
  parseOkfFrontmatter,
  splitWikiLinkMarkdown,
  stripOkfFrontmatter,
  type OkfWikiBundle,
  type OkfWikiPageMeta,
} from '../../shared/lib/okf-wiki'

interface WikiViewerProps {
  bundle: OkfWikiBundle | null
  loading?: boolean
  error?: string | null
  onClose?: () => void
  onOpenDocument?: (documentId: string) => void
  onOpenEntity?: (entityId: string, entityName: string) => void
}

function pageMeta(
  bundle: OkfWikiBundle,
  path: string
): OkfWikiPageMeta | undefined {
  return bundle.pages?.find((p) => p.path === path)
}

function WikiBody({
  body,
  onNavigate,
}: {
  body: string
  onNavigate: (path: string) => void
}) {
  const lines = useMemo(() => body.split('\n'), [body])
  let section = ''
  return (
    <div className="wiki-body space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        const heading = line.match(/^##\s+(.+)$/)
        if (heading) {
          section = heading[1].toLowerCase()
          return (
            <h3
              key={`heading-${i}`}
              className="pt-8 pb-2 text-base font-semibold tracking-tight text-foreground first:pt-0"
            >
              {heading[1]}
            </h3>
          )
        }

        const parts = splitWikiLinkMarkdown(line)
        const hasLink = parts.some((part) => part.kind === 'link')
        if (!hasLink) {
          if (!line.trim()) return null
          return (
            <div key={`md-${i}`} className="wiki-md-chunk">
              <MarkdownPreview source={line} />
            </div>
          )
        }

        const linkPart = parts.find((part) => part.kind === 'link')
        const linkLabel = linkPart?.kind === 'link' ? linkPart.label : ''
        const linkPath = linkPart?.kind === 'link' ? linkPart.path : ''
        const textMeta = parts
          .filter((part) => part.kind !== 'link')
          .map((part) => part.text)
          .join('')
          .replace(/^\s*-\s*/, '')
          .trim()

        if (section === 'entities') {
          return (
            <button
              key={`entity-${i}`}
              type="button"
              onClick={() => onNavigate(linkPath)}
              className="mr-2 mt-2 inline-flex rounded-full border border-border bg-[hsl(var(--secondary))]/60 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-[hsl(var(--vault-active))] hover:text-[hsl(var(--vault-active))]"
            >
              {linkLabel}
            </button>
          )
        }

        if (section === 'sources') {
          const meta = textMeta
            .split(' · ')
            .map((part) => part.trim())
            .filter(Boolean)
          const facts = meta.find((part) => /^\(\d+ facts?\)$/.test(part))
          const updated = meta.find((part) => part.startsWith('updated '))
          const tags = meta
            .find((part) => part.startsWith('tags: '))
            ?.replace(/^tags:\s*/, '')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 4)

          return (
            <div
              key={`source-${i}`}
              className="group rounded-lg border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-[hsl(var(--secondary))]/40"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <button
                  type="button"
                  onClick={() => onNavigate(linkPath)}
                  className="font-medium text-[hsl(var(--vault-active))] underline-offset-2 hover:underline"
                >
                  {linkLabel}
                </button>
                {facts ? (
                  <span className="text-xs font-medium text-foreground/70">{facts.replace(/[()]/g, '')}</span>
                ) : null}
                {updated ? (
                  <span className="text-xs text-[hsl(var(--vault-muted))]">{updated}</span>
                ) : null}
              </div>
              {tags?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[hsl(var(--secondary))] px-2 py-0.5 text-[11px] text-[hsl(var(--vault-muted))]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )
        }

        const rowParts = parts.map((part, j) => {
          if (part.kind === 'link') {
            return (
              <button
                key={`${part.path}-${i}-${j}`}
                type="button"
                onClick={() => onNavigate(part.path)}
                className="font-medium text-[hsl(var(--vault-active))] underline underline-offset-2 hover:opacity-80"
              >
                {part.label}
              </button>
            )
          }
          return part.text.replace(/^\s*-\s*/, '')
        })

        return (
          <div key={`link-line-${i}`} className="border-b border-border/70 py-3 text-sm leading-relaxed">
            {rowParts}
          </div>
        )
      })}
    </div>
  )
}

export function WikiViewer({
  bundle,
  loading,
  error,
  onClose,
  onOpenDocument,
  onOpenEntity,
}: WikiViewerProps) {
  const [activePath, setActivePath] = useState<string | null>(null)

  const pages = bundle?.pages ?? []
  const indexPath = bundle?.index ?? 'index.md'
  const current = activePath ?? indexPath
  const rawBody = current && bundle ? bundle.files[current] ?? '' : ''
  const meta = rawBody ? parseOkfFrontmatter(rawBody) : {}
  const page = bundle ? pageMeta(bundle, current) : undefined
  const title =
    page?.title ??
    (typeof meta.title === 'string' ? meta.title : current ?? 'Wiki')
  const body = stripOkfFrontmatter(rawBody)

  if (loading) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center text-sm text-[hsl(var(--error-fg))] px-6 text-center">
        {error}
      </div>
    )
  }

  if (!bundle) {
    return (
      <p className="text-sm text-[hsl(var(--vault-muted))] py-8 text-center">
        No wiki pages yet. Retain sources and facts to build linked pages.
      </p>
    )
  }

  const pageType = page?.type ?? (meta.type as string | undefined)
  const pageId = page?.id ?? (typeof meta.id === 'string' ? meta.id : undefined)

  return (
    <div className="flex flex-1 min-h-0 overflow-y-auto bg-[hsl(var(--canvas))]">
      <article className="w-full px-6 py-8 lg:px-12 lg:py-10 max-w-[76ch] mx-auto">
        <div className="flex items-center justify-between gap-4 mb-7">
          <p className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--vault-muted))]">
            {pages.length} linked pages
          </p>
          {onClose ? (
            <Button variant="ghost" size="sm" className="text-xs" onClick={onClose}>
              Close
            </Button>
          ) : null}
        </div>
          <header className="mb-7">
            <h2 className="text-2xl font-semibold tracking-tight leading-snug text-foreground">{title}</h2>
            {pageType ? (
              <p className="text-sm text-[hsl(var(--vault-muted))] mt-2 capitalize font-medium">
                {String(pageType).toLowerCase()}
                {page?.count != null ? ` · ${page.count}` : ''}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3 mt-5">
              {pageType === 'Source' && pageId && onOpenDocument ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm"
                  onClick={() => onOpenDocument(pageId)}
                >
                  Open in Sources
                </Button>
              ) : null}
              {pageType === 'Entity' && pageId && onOpenEntity ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm"
                  onClick={() => onOpenEntity(pageId, title)}
                >
                  Open entity detail
                </Button>
              ) : null}
            </div>
          </header>
          {body ? (
            <div className="prose prose-sm prose-slate max-w-none">
              <WikiBody body={body} onNavigate={(path) => setActivePath(path)} />
            </div>
          ) : (
            <p className="text-sm text-[hsl(var(--vault-muted))]">Empty page.</p>
          )}
      </article>
    </div>
  )
}
