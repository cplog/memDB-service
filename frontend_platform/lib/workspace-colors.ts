/** Semantic colors for graph nodes (Hindsight constellation parity). */
export const GRAPH_NODE_COLORS = {
  entity: '#2563eb',
  memory: '#64748b',
  bank: '#475569',
} as const

/** Wiki page nodes in the knowledge graph (Obsidian-style). */
export const WIKI_GRAPH_COLORS = {
  index: GRAPH_NODE_COLORS.bank,
  source: GRAPH_NODE_COLORS.memory,
  entity: GRAPH_NODE_COLORS.entity,
} as const

/** Link-type edge colors — Hindsight constellation: semantic blue, temporal teal, entity amber, causal purple. */
export const GRAPH_LINK_COLORS = {
  semantic: '#2563eb',
  temporal: '#14b8a6',
  entity: '#d97706',
  causal: '#9333ea',
  default: '#94a3b8',
} as const

/** Memory fact node fills — match factTypeStyle dots across the portal. */
export const GRAPH_FACT_COLORS: Record<string, string> = {
  world: '#0ea5e9',
  experience: '#7c3aed',
  observation: '#d97706',
  mental_model: '#0d9488',
  directive: '#e11d48',
  entity: GRAPH_NODE_COLORS.entity,
  memory: GRAPH_NODE_COLORS.memory,
}

export const GRAPH_NODE_TYPE_META = [
  { key: 'world', label: 'World', color: GRAPH_FACT_COLORS.world },
  { key: 'experience', label: 'Experience', color: GRAPH_FACT_COLORS.experience },
  { key: 'observation', label: 'Observation', color: GRAPH_FACT_COLORS.observation },
  { key: 'entity', label: 'Entity', color: GRAPH_NODE_COLORS.entity },
  { key: 'memory', label: 'Other', color: GRAPH_NODE_COLORS.memory },
] as const

export const GRAPH_SURFACE = {
  canvas: '#ffffff',
  edge: 'rgba(113, 113, 122, 0.28)',
  edgeDimmed: 'rgba(113, 113, 122, 0.1)',
  edgeActive: '#10b981',
  label: '#52525b',
} as const

export const GRAPH_LINK_TYPE_META = [
  { key: 'semantic', label: 'Semantic', color: GRAPH_LINK_COLORS.semantic },
  { key: 'temporal', label: 'Temporal', color: GRAPH_LINK_COLORS.temporal },
  { key: 'entity', label: 'Entity', color: GRAPH_LINK_COLORS.entity },
  { key: 'causal', label: 'Causal', color: GRAPH_LINK_COLORS.causal },
] as const

export function graphFactNodeColor(factType?: string, wikiType?: string): string {
  if (factType) {
    const key = factType.toLowerCase().replace(/\s+/g, '_')
    if (GRAPH_FACT_COLORS[key]) return GRAPH_FACT_COLORS[key]
  }
  if (wikiType === 'entity') return GRAPH_NODE_COLORS.entity
  if (wikiType === 'index') return GRAPH_NODE_COLORS.bank
  if (wikiType === 'source') return GRAPH_NODE_COLORS.memory
  return GRAPH_NODE_COLORS.memory
}

export function graphLinkColor(linkType?: string): string {
  if (!linkType) return GRAPH_LINK_COLORS.default
  const key = linkType.toLowerCase() as keyof typeof GRAPH_LINK_COLORS
  return GRAPH_LINK_COLORS[key] ?? GRAPH_LINK_COLORS.default
}

/** RGBA edge color for Sigma — legend swatches use full hex; canvas uses alpha. */
export function graphLinkRgba(linkType?: string, alpha = 0.62): string {
  const hex = graphLinkColor(linkType)
  if (hex.startsWith('rgba')) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function graphNodeSize(val?: number): number {
  const v = Math.max(1, val ?? 3)
  return 3.5 + Math.sqrt(v) * 2.2
}

export type FactType = 'world' | 'experience' | 'observation' | string

/** Memory fact types + reflect provenance layers (mental models, directives). */
export function factTypeStyle(type?: string) {
  switch (type?.toLowerCase()) {
    case 'world':
      return {
        badge: 'bg-sky-50 text-sky-800 border-sky-200',
        dot: 'bg-sky-500',
        label: 'World',
      }
    case 'experience':
      return {
        badge: 'bg-violet-50 text-violet-800 border-violet-200',
        dot: 'bg-violet-600',
        label: 'Experience',
      }
    case 'observation':
      return {
        badge: 'bg-amber-50 text-amber-900 border-amber-200',
        dot: 'bg-amber-600',
        label: 'Observation',
      }
    case 'mental_model':
    case 'mental model':
      return {
        badge: 'bg-teal-50 text-teal-900 border-teal-200',
        dot: 'bg-teal-600',
        label: 'Mental model',
      }
    case 'directive':
      return {
        badge: 'bg-rose-50 text-rose-900 border-rose-200',
        dot: 'bg-rose-500',
        label: 'Directive',
      }
    default:
      return {
        badge: 'bg-slate-50 text-slate-700 border-slate-200',
        dot: 'bg-slate-400',
        label: type ?? 'Fact',
      }
  }
}

export function graphNodeTypeStyle(type: keyof typeof GRAPH_NODE_COLORS) {
  const colors: Record<keyof typeof GRAPH_NODE_COLORS, string> = {
    entity: 'text-blue-700 bg-blue-50 border-blue-200',
    memory: 'text-slate-700 bg-slate-50 border-slate-200',
    bank: 'text-slate-700 bg-slate-50 border-slate-200',
  }
  return colors[type]
}
