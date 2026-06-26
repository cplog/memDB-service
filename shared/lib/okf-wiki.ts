/** OKF-style wiki bundle from Hindsight documents + facts + entities (pure formatter). */

export interface OkfDocumentInput {
  id: string
  original_text?: string | null
  memory_unit_count?: number
  nodes_by_fact_type?: Record<string, number> | null
  created_at?: string
  updated_at?: string
  tags?: string[] | null
  document_metadata?: Record<string, unknown> | null
}

export interface OkfMemoryInput {
  id: string
  text?: string
  fact_type?: string
  document_id?: string
  entities?: string[]
}

export interface OkfEntityInput {
  id: string
  canonical_name: string
  mention_count?: number
}

export type OkfWikiPageType = 'Index' | 'Source' | 'Entity'

export interface OkfWikiPageMeta {
  path: string
  title: string
  type: OkfWikiPageType
  id?: string
  count?: number
  tags?: string[]
}

export interface OkfWikiBundle {
  bankId: string
  bankLabel?: string
  index: string
  files: Record<string, string>
  pages: OkfWikiPageMeta[]
}

function slugify(id: string): string {
  const s = id.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return s || 'doc'
}

function sourcePath(documentId: string): string {
  return `sources/${slugify(documentId)}.md`
}

function yamlLine(key: string, value: unknown): string {
  if (value == null) return `${key}: null`
  if (typeof value === 'object' && !Array.isArray(value)) {
    return `${key}: ${JSON.stringify(value)}`
  }
  if (Array.isArray(value)) {
    if (!value.length) return `${key}: []`
    return `${key}:\n${value.map((v) => `  - ${JSON.stringify(v)}`).join('\n')}`
  }
  return `${key}: ${JSON.stringify(value)}`
}

function frontmatter(fields: Record<string, unknown>): string {
  return `---\n${Object.entries(fields).map(([k, v]) => yamlLine(k, v)).join('\n')}\n---`
}

function docTitle(doc: OkfDocumentInput): string {
  const meta = doc.document_metadata
  if (meta && typeof meta.original_filename === 'string') return meta.original_filename
  return doc.id
}

/** Parse OKF frontmatter block into plain fields (values are JSON-decoded when possible). */
export function parseOkfFrontmatter(source: string): Record<string, unknown> {
  if (!source.startsWith('---')) return {}
  const end = source.indexOf('\n---', 3)
  if (end === -1) return {}
  const block = source.slice(4, end)
  const out: Record<string, unknown> = {}
  for (const line of block.split('\n')) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const raw = line.slice(idx + 1).trim()
    if (!key) continue
    try {
      out[key] = JSON.parse(raw)
    } catch {
      out[key] = raw.replace(/^"|"$/g, '')
    }
  }
  return out
}

export function stripOkfFrontmatter(source: string): string {
  if (!source.startsWith('---')) return source
  const end = source.indexOf('\n---', 3)
  if (end === -1) return source
  return source.slice(end + 4).trimStart()
}

/** Split markdown body into text runs and [[path|label]] wiki links. */
export function splitWikiLinkMarkdown(
  source: string
): Array<
  | { kind: 'text'; text: string }
  | { kind: 'link'; path: string; label: string }
> {
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
  const parts: Array<
    | { kind: 'text'; text: string }
    | { kind: 'link'; path: string; label: string }
  > = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    if (m.index > last) {
      parts.push({ kind: 'text', text: source.slice(last, m.index) })
    }
    const path = m[1].trim()
    const label = (m[2] ?? path).trim()
    parts.push({ kind: 'link', path, label })
    last = m.index + m[0].length
  }
  if (last < source.length) {
    parts.push({ kind: 'text', text: source.slice(last) })
  }
  return parts.length ? parts : [{ kind: 'text', text: source }]
}

/** Build read-only OKF wiki pages keyed by relative path. */
export function buildOkfWikiExport(input: {
  bankId: string
  bankLabel?: string
  documents: OkfDocumentInput[]
  memories: OkfMemoryInput[]
  entities?: OkfEntityInput[]
}): OkfWikiBundle {
  const files: Record<string, string> = {}
  const pages: OkfWikiPageMeta[] = []
  const docPaths = new Map<string, string>()

  for (const doc of input.documents) {
    const path = sourcePath(doc.id)
    docPaths.set(doc.id, path)
    const factsForDoc = input.memories.filter((m) => m.document_id === doc.id)
    const factsBlock =
      factsForDoc.length > 0
        ? `\n\n## Extracted facts\n\n${factsForDoc
            .map(
              (f) =>
                `- (${f.fact_type ?? 'fact'}) ${f.text ?? ''} · id \`${f.id}\``
            )
            .join('\n')}`
        : ''

    const title = docTitle(doc)
    files[path] = [
      frontmatter({
        type: 'Source',
        title,
        id: doc.id,
        bank_id: input.bankId,
        memory_unit_count: doc.memory_unit_count ?? 0,
        nodes_by_fact_type: doc.nodes_by_fact_type ?? {},
        created_at: doc.created_at ?? null,
        updated_at: doc.updated_at ?? null,
        tags: doc.tags ?? [],
      }),
      '',
      doc.original_text?.trim() || '_No source text retained._',
      factsBlock,
    ].join('\n')
    pages.push({
      path,
      title,
      type: 'Source',
      id: doc.id,
      count: doc.memory_unit_count ?? factsForDoc.length,
      tags: doc.tags ?? [],
    })
  }

  for (const ent of input.entities ?? []) {
    const entPath = `entities/${slugify(ent.id)}.md`
    const related = input.memories.filter((m) =>
      (m.entities ?? []).some(
        (e) => e.toLowerCase() === ent.canonical_name.toLowerCase()
      )
    )
    const byDoc = new Map<string, OkfMemoryInput[]>()
    for (const m of related) {
      if (!m.document_id) continue
      const list = byDoc.get(m.document_id) ?? []
      list.push(m)
      byDoc.set(m.document_id, list)
    }

    const sourceLines = Array.from(byDoc.entries()).map(([docId, facts]) => {
      const link = docPaths.get(docId) ?? sourcePath(docId)
      return `- [[${link}|${docTitle({ id: docId, document_metadata: null })}]] (${facts.length} facts)`
    })

    files[entPath] = [
      frontmatter({
        type: 'Entity',
        title: ent.canonical_name,
        id: ent.id,
        mention_count: ent.mention_count ?? related.length,
        bank_id: input.bankId,
      }),
      '',
      `## Facts mentioning ${ent.canonical_name}`,
      '',
      related.length
        ? related
            .map((f) => {
              const src = f.document_id
                ? ` · source [[${docPaths.get(f.document_id) ?? sourcePath(f.document_id)}]]`
                : ''
              return `- ${f.text ?? ''}${src}`
            })
            .join('\n')
        : '_No linked facts in export batch._',
      '',
      '## Sources',
      '',
      sourceLines.length ? sourceLines.join('\n') : '_No source documents._',
    ].join('\n')
    pages.push({
      path: entPath,
      title: ent.canonical_name,
      type: 'Entity',
      id: ent.id,
      count: ent.mention_count ?? related.length,
    })
  }

  const indexLines = [
    frontmatter({
      type: 'Index',
      title: input.bankLabel ?? input.bankId,
      bank_id: input.bankId,
      source_count: input.documents.length,
      entity_count: input.entities?.length ?? 0,
    }),
    '',
    '## Sources',
    '',
    ...input.documents.map((d) => {
      const parts = [
        `- [[${docPaths.get(d.id)}|${docTitle(d)}]] (${d.memory_unit_count ?? 0} facts)`,
      ]
      if (d.tags?.length) parts.push(`tags: ${d.tags.join(', ')}`)
      if (d.updated_at) {
        try {
          parts.push(`updated ${new Date(d.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`)
        } catch { /* ignore invalid date */ }
      }
      return parts.join(' · ')
    }),
    '',
    '## Entities',
    '',
    ...(input.entities ?? []).map(
      (e) => `- [[entities/${slugify(e.id)}.md|${e.canonical_name}]]`
    ),
  ]

  files['index.md'] = indexLines.join('\n')
  pages.unshift({
    path: 'index.md',
    title: input.bankLabel ?? input.bankId,
    type: 'Index',
    count: input.documents.length,
  })

  return {
    bankId: input.bankId,
    bankLabel: input.bankLabel,
    index: 'index.md',
    files,
    pages,
  }
}

export type WikiGraphPageType = 'index' | 'source' | 'entity'

export interface WikiGraphNode {
  id: string
  label: string
  type: WikiGraphPageType
  documentId?: string
  entityId?: string
  val: number
}

export interface WikiGraphLink {
  source: string
  target: string
  type: 'wiki'
}

export interface WikiGraphData {
  nodes: WikiGraphNode[]
  links: WikiGraphLink[]
}

function wikiPageType(type: OkfWikiPageType): WikiGraphPageType {
  if (type === 'Index') return 'index'
  if (type === 'Source') return 'source'
  return 'entity'
}

/** Obsidian-style graph: wiki pages as nodes, [[links]] as edges (not raw memory facts). */
export function buildWikiGraphFromBundle(bundle: OkfWikiBundle): WikiGraphData {
  const pages = bundle.pages ?? []
  const pathSet = new Set(pages.map((p) => p.path))
  const degree = new Map<string, number>()
  const bump = (id: string, n = 1) => degree.set(id, (degree.get(id) ?? 0) + n)

  const links: WikiGraphLink[] = []
  const seen = new Set<string>()

  for (const [fromPath, content] of Object.entries(bundle.files)) {
    if (!pathSet.has(fromPath)) continue
    for (const part of splitWikiLinkMarkdown(content)) {
      if (part.kind !== 'link') continue
      const target = part.path.trim()
      if (!pathSet.has(target) || target === fromPath) continue
      const key = `${fromPath}\0${target}`
      if (seen.has(key)) continue
      seen.add(key)
      links.push({ source: fromPath, target, type: 'wiki' })
      bump(fromPath)
      bump(target)
    }
  }

  const nodes: WikiGraphNode[] = pages.map((p) => {
    const deg = degree.get(p.path) ?? 0
    return {
      id: p.path,
      label: p.title,
      type: wikiPageType(p.type),
      documentId: p.type === 'Source' ? p.id : undefined,
      entityId: p.type === 'Entity' ? p.id : undefined,
      val: 4 + Math.min(deg, 12),
    }
  })

  return { nodes, links }
}

export function runOkfWikiSelfCheck(): void {
  const bundle = buildOkfWikiExport({
    bankId: 'team-product',
    bankLabel: 'Product',
    documents: [
      {
        id: 'meeting-2024-03-15',
        original_text: '# Kickoff\n\nAlice joined the team.',
        memory_unit_count: 1,
        nodes_by_fact_type: { world: 1 },
        created_at: '2024-03-15T10:00:00Z',
        updated_at: '2024-03-15T10:00:00Z',
        tags: ['scope:shared'],
      },
    ],
    memories: [
      {
        id: 'mem-1',
        text: 'Alice joined the team',
        fact_type: 'world',
        document_id: 'meeting-2024-03-15',
        entities: ['Alice'],
      },
    ],
    entities: [{ id: 'ent-alice', canonical_name: 'Alice', mention_count: 1 }],
  })

  const source = bundle.files['sources/meeting-2024-03-15.md']
  if (!source?.includes('id: "meeting-2024-03-15"')) {
    throw new Error('okf-wiki: source frontmatter id missing')
  }
  if (!source.includes('Alice joined the team')) {
    throw new Error('okf-wiki: source body missing original_text')
  }
  if (!bundle.files['entities/ent-alice.md']?.includes('Alice')) {
    throw new Error('okf-wiki: entity page missing')
  }
  if (!bundle.files['index.md']?.includes('meeting-2024-03-15')) {
    throw new Error('okf-wiki: index missing source link')
  }
  const indexPage = bundle.pages.find((p) => p.path === 'index.md')
  if (!indexPage || indexPage.type !== 'Index') {
    throw new Error('okf-wiki: pages metadata missing index')
  }
  const sourcePage = bundle.pages.find((p) => p.type === 'Source')
  if (!sourcePage?.id) {
    throw new Error('okf-wiki: pages metadata missing source id')
  }
  const links = splitWikiLinkMarkdown(
    '- [[sources/meeting-2024-03-15.md|Kickoff]] (1 facts)'
  )
  if (links.length !== 3 || links[1].kind !== 'link') {
    throw new Error('okf-wiki: wiki link split failed')
  }

  const graph = buildWikiGraphFromBundle(bundle)
  if (graph.nodes.length < 3) {
    throw new Error('okf-wiki: wiki graph missing pages')
  }
  if (!graph.links.some((l) => l.source === 'index.md')) {
    throw new Error('okf-wiki: wiki graph missing index links')
  }
  if (!graph.nodes.some((n) => n.id === 'entities/ent-alice.md')) {
    throw new Error('okf-wiki: wiki graph missing entity node')
  }
}
