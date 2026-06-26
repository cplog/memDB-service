/** Semantic colors for graph nodes and fact types (light workspace). */
export const GRAPH_NODE_COLORS = {
  entity: '#3b82f6',
  memory: '#f97316',
  bank: '#10b981',
} as const

/** Wiki page nodes in the knowledge graph (Obsidian-style). */
export const WIKI_GRAPH_COLORS = {
  index: GRAPH_NODE_COLORS.bank,
  source: GRAPH_NODE_COLORS.memory,
  entity: GRAPH_NODE_COLORS.entity,
} as const

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
    entity: 'text-sky-700 bg-sky-50 border-sky-200',
    memory: 'text-violet-800 bg-violet-50 border-violet-200',
    bank: 'text-teal-800 bg-teal-50 border-teal-200',
  }
  return colors[type]
}
