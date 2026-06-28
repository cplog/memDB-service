import { getBankGraphData, getBankStats, getHindsightClient } from './hindsight'

export interface GraphNode {
  id: string
  label: string
  type: 'entity' | 'memory' | 'bank'
  val?: number
  factType?: string
  fullText?: string
  documentId?: string
}

export interface GraphLink {
  source: string
  target: string
  type: string
  weight?: number
}

export interface TableRow {
  id: string
  text: string
  date: string
  entities: string[]
  context: string
  factType?: string
}

export interface LinkTypeCounts {
  semantic: number
  temporal: number
  entity: number
  causal: number
  other: number
}

export interface BankGraphResponse {
  nodes: GraphNode[]
  links: GraphLink[]
  tableRows: TableRow[]
  linkTypeCounts: LinkTypeCounts
  meta: {
    totalMemories: number
    pendingOperations: number
    totalNodes: number
    totalLinks: number
    truncated: boolean
    source: 'native' | 'legacy'
  }
}

const MEMORY_CAP = 150
const FACT_TYPES = new Set(['world', 'experience', 'observation'])

function countLinkTypes(links: GraphLink[]): LinkTypeCounts {
  const counts: LinkTypeCounts = { semantic: 0, temporal: 0, entity: 0, causal: 0, other: 0 }
  for (const l of links) {
    const t = l.type.toLowerCase()
    if (t === 'semantic') counts.semantic++
    else if (t === 'temporal') counts.temporal++
    else if (t === 'entity') counts.entity++
    else if (t === 'causal') counts.causal++
    else counts.other++
  }
  return counts
}

function mapTableRow(raw: Record<string, unknown>): TableRow {
  const entities = Array.isArray(raw.entities)
    ? (raw.entities as unknown[]).map(String)
    : typeof raw.entities === 'string'
      ? raw.entities.split(',').map((s) => s.trim()).filter(Boolean)
      : []
  return {
    id: String(raw.id ?? ''),
    text: String(raw.text ?? ''),
    date: String(raw.date ?? raw.created_at ?? ''),
    entities,
    context: String(raw.context ?? ''),
    factType: String(raw.fact_type ?? raw.factType ?? '').toLowerCase() || undefined,
  }
}

/** ponytail: entities field is CSV string or array depending on Hindsight version */
export function parseEntityNames(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map((e) =>
        typeof e === 'string' ? e : String((e as { text?: string }).text ?? e)
      )
      .filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

function entityId(name: string): string {
  return `entity:${name.toLowerCase().replace(/\s+/g, '-')}`
}

function truncate(text: string, max = 48): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

/** Hindsight returns flat OpenAPI nodes/edges or Cytoscape `{ data: {...} }` wrappers. */
function unwrapGraphRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const data = raw.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>
  }
  return raw
}

interface MemoryRow {
  id?: string
  text?: string
  fact_type?: string
  entities?: unknown
  document_id?: string
}

async function fetchMemories(bankId: string): Promise<MemoryRow[]> {
  const client = getHindsightClient()
  const items: MemoryRow[] = []
  let offset = 0
  const limit = 50

  while (items.length < MEMORY_CAP) {
    const page = await client.listMemories(bankId, {
      limit,
      offset,
      state: 'valid',
    })
    const batch = (page.items ?? []) as MemoryRow[]
    if (!batch.length) break
    items.push(...batch)
    offset += batch.length
    if (batch.length < limit || items.length >= page.total) break
  }

  return items.slice(0, MEMORY_CAP)
}

function mapNativeNode(raw: Record<string, unknown>): GraphNode {
  const n = unwrapGraphRecord(raw)
  const nodeType = String(n.type ?? 'memory').toLowerCase()
  const label = String(n.label ?? n.text ?? n.id ?? '')
  const factTypeRaw = String(n.fact_type ?? n.factType ?? '').toLowerCase()
  const isEntity = nodeType === 'entity'
  const isFact = FACT_TYPES.has(nodeType)
  const factType = isFact
    ? nodeType
    : factTypeRaw && FACT_TYPES.has(factTypeRaw)
      ? factTypeRaw
      : undefined
  return {
    id: String(n.id),
    label: truncate(label),
    type: isEntity ? 'entity' : 'memory',
    factType,
    fullText: String(n.text ?? n.label ?? label),
    documentId:
      typeof n.document_id === 'string' ? n.document_id : undefined,
    val: typeof n.val === 'number' ? n.val : 3,
  }
}

function applyGraphDegrees(nodes: GraphNode[], links: GraphLink[]): GraphNode[] {
  const degree = new Map<string, number>()
  for (const l of links) {
    degree.set(l.source, (degree.get(l.source) ?? 0) + 1)
    degree.set(l.target, (degree.get(l.target) ?? 0) + 1)
  }
  return nodes.map((n) => ({
    ...n,
    val: 2 + Math.min(degree.get(n.id) ?? 0, 14),
  }))
}

function enrichNodesFromTableRows(nodes: GraphNode[], tableRows: TableRow[]): GraphNode[] {
  if (!tableRows.length) return nodes
  const rowById = new Map(tableRows.map((r) => [r.id, r]))
  return nodes.map((n) => {
    const row = rowById.get(n.id)
    if (!row) return n
    return {
      ...n,
      factType: n.factType ?? row.factType,
      fullText: n.fullText || row.text,
    }
  })
}

async function buildBankGraphNative(
  bankId: string,
  options?: {
    type?: string
    q?: string
    limit?: number
    tags?: string[]
    tagsMatch?: string
    documentId?: string
  }
): Promise<BankGraphResponse> {
  const [graph, stats] = await Promise.all([
    getBankGraphData(bankId, { limit: options?.limit ?? 500, ...options }),
    getBankStats(bankId).catch(() => null),
  ])

  const nodes = (graph.nodes ?? []).map((n) =>
    mapNativeNode(n as Record<string, unknown>)
  )
  const links: GraphLink[] = (graph.edges ?? [])
    .map((e) => {
      const edge = unwrapGraphRecord(e as Record<string, unknown>)
      const source = edge.source ?? edge.from
      const target = edge.target ?? edge.to
      return {
        source: String(source ?? ''),
        target: String(target ?? ''),
        type: String(edge.linkType ?? edge.type ?? 'link'),
        weight: typeof edge.weight === 'number' ? edge.weight : undefined,
      }
    })
    .filter(
      (l) =>
        l.source &&
        l.target &&
        l.source !== 'undefined' &&
        l.target !== 'undefined' &&
        l.source !== l.target
    )

  const totalUnits = graph.total_units ?? nodes.length
  const truncated = totalUnits > nodes.length
  const tableRows = (graph.table_rows ?? []).map((r) =>
    mapTableRow(r as Record<string, unknown>)
  )
  const enriched = enrichNodesFromTableRows(
    applyGraphDegrees(nodes, links),
    tableRows
  )

  return {
    nodes: enriched,
    links,
    tableRows,
    linkTypeCounts: countLinkTypes(links),
    meta: {
      totalMemories: stats?.total_documents ?? totalUnits,
      pendingOperations: stats?.pending_operations ?? 0,
      totalNodes: stats?.total_nodes ?? nodes.length,
      totalLinks: stats?.total_links ?? links.length,
      truncated,
      source: 'native',
    },
  }
}

async function buildBankGraphLegacy(
  bankId: string,
  bankLabel: string
): Promise<BankGraphResponse> {
  const [memories, stats] = await Promise.all([
    fetchMemories(bankId),
    getBankStats(bankId).catch(() => null),
  ])

  const nodes: GraphNode[] = [
    { id: bankId, label: bankLabel, type: 'bank', val: 8 },
  ]
  const links: GraphLink[] = []
  const entityNodes = new Map<string, GraphNode>()
  const degree = new Map<string, number>()

  const bump = (id: string, n = 1) => degree.set(id, (degree.get(id) ?? 0) + n)

  for (const mem of memories) {
    const memId = mem.id
    if (!memId || !mem.text) continue

    nodes.push({
      id: memId,
      label: truncate(mem.text),
      type: 'memory',
      factType: mem.fact_type,
      fullText: mem.text,
      documentId: mem.document_id,
      val: 3,
    })
    links.push({ source: bankId, target: memId, type: 'contains' })
    bump(bankId)
    bump(memId)

    for (const name of parseEntityNames(mem.entities)) {
      const eid = entityId(name)
      if (!entityNodes.has(eid)) {
        entityNodes.set(eid, { id: eid, label: name, type: 'entity', val: 4 })
      }
      links.push({ source: memId, target: eid, type: 'mentions' })
      bump(memId)
      bump(eid)
    }
  }

  for (const en of Array.from(entityNodes.values())) {
    en.val = 3 + Math.min(degree.get(en.id) ?? 0, 12)
    nodes.push(en)
  }

  for (const n of nodes) {
    if (n.type === 'memory') {
      n.val = 2 + Math.min(degree.get(n.id) ?? 0, 10)
    }
  }

  const totalMemories = stats?.total_documents ?? memories.length

  return {
    nodes,
    links,
    tableRows: [],
    linkTypeCounts: countLinkTypes(links),
    meta: {
      totalMemories,
      pendingOperations: stats?.pending_operations ?? 0,
      totalNodes: stats?.total_nodes ?? entityNodes.size + memories.length,
      totalLinks: stats?.total_links ?? links.length,
      truncated: totalMemories > memories.length,
      source: 'legacy',
    },
  }
}

/** Native Hindsight /graph with legacy listMemories fallback. */
export async function buildBankGraph(
  bankId: string,
  bankLabel: string,
  options?: {
    type?: string
    q?: string
    limit?: number
    tags?: string[]
    tagsMatch?: string
    documentId?: string
  }
): Promise<BankGraphResponse> {
  try {
    const native = await buildBankGraphNative(bankId, options)
    if (native.nodes.length > 0) return native
  } catch {
    // ponytail: fallback when remote API lacks /graph or returns empty
  }
  return buildBankGraphLegacy(bankId, bankLabel)
}

/** Runnable check — node --import tsx shared/lib/bank-graph.selfcheck.ts */
export function runBankGraphSelfCheck(): void {
  const names = parseEntityNames('Project Titan, MegaCorp, David')
  if (names.length !== 3 || names[0] !== 'Project Titan') {
    throw new Error('parseEntityNames CSV failed')
  }
  const arr = parseEntityNames(['Alice', { text: 'Bob' }])
  if (arr.length !== 2) throw new Error('parseEntityNames array failed')

  const flatNode = mapNativeNode({
    id: '1',
    label: 'Alice works at Google',
    type: 'world',
  })
  if (flatNode.id !== '1' || flatNode.label !== 'Alice works at Google') {
    throw new Error('mapNativeNode flat failed')
  }

  const wrappedNode = mapNativeNode({
    data: {
      id: '2',
      label: 'Bob went hiking',
      text: 'Bob went hiking in the Alps',
      type: 'experience',
    },
  })
  if (wrappedNode.id !== '2' || !wrappedNode.fullText?.includes('Alps')) {
    throw new Error('mapNativeNode cytoscape wrapper failed')
  }

  const flat = unwrapGraphRecord({ from: 'a', to: 'b', type: 'semantic' })
  const wrapped = unwrapGraphRecord({
    data: { source: 'x', target: 'y', linkType: 'temporal' },
  })
  if (flat.from !== 'a' || wrapped.source !== 'x' || wrapped.linkType !== 'temporal') {
    throw new Error('unwrapGraphRecord failed')
  }

  const row = mapTableRow({ id: 'r1', text: 'Hello world', date: '2026-01-01', entities: ['Alice', 'Bob'], context: 'Meeting notes' })
  if (row.id !== 'r1' || row.entities.length !== 2 || row.context !== 'Meeting notes') {
    throw new Error('mapTableRow failed')
  }

  const counts = countLinkTypes([
    { source: 'a', target: 'b', type: 'semantic' },
    { source: 'b', target: 'c', type: 'temporal' },
    { source: 'c', target: 'd', type: 'semantic' },
    { source: 'd', target: 'e', type: 'causal' },
  ])
  if (counts.semantic !== 2 || counts.temporal !== 1 || counts.causal !== 1 || counts.entity !== 0) {
    throw new Error('countLinkTypes failed')
  }
}
