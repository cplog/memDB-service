'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import {
  graphFactNodeColor,
  graphLinkRgba,
  graphNodeSize,
  GRAPH_SURFACE,
} from '@/lib/workspace-colors'
import type { WikiGraphNode } from '../../shared/lib/okf-wiki'

cytoscape.use(fcose)

type DisplayNode = WikiGraphNode & { factType?: string; fullText?: string }


function useIsDarkMode() {
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

interface CytoscapeGraphClientProps {
  nodes: DisplayNode[]
  links: { source: string; target: string; type?: string; weight?: number }[]
  onNodeClick: (node: WikiGraphNode) => void
  onNodeHover: (nodeId: string | null) => void
  onBackgroundClick?: () => void
  focusId: string | null
  hoverId: string | null
  searchMatchIds: Set<string> | null
  activeId: string | null
  neighborIds: Set<string> | null
  fitToken?: number
  layout?: 'force' | 'cluster' | 'spiral' | 'constellation'
  maxNodes?: number
  showLabels?: boolean
  linkTypesVisible?: Set<string>
}

export function CytoscapeGraphClient({
  nodes,
  links,
  onNodeClick,
  onNodeHover,
  onBackgroundClick,
  focusId,
  hoverId,
  searchMatchIds,
  activeId,
  neighborIds,
  fitToken = 0,
  layout: layoutMode = 'force',
  showLabels = true,
}: CytoscapeGraphClientProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const isDark = useIsDarkMode()
  const [isLoading, setIsLoading] = useState(true)

  const dataSignature = useMemo(() => {
    return JSON.stringify({
      nodeCount: nodes.length,
      linkCount: links.length,
      nodeIds: nodes.map((n) => n.id).sort().join(','),
      isDark,
      layoutMode,
      showLabels,
    })
  }, [nodes, links, isDark, layoutMode, showLabels])

  useEffect(() => {
    if (!containerRef.current || !nodes.length) return
    if (cyRef.current) {
      cyRef.current.destroy()
      cyRef.current = null
    }

    setIsLoading(true)

    const cyNodes = nodes.map((n) => {
      const baseColor = graphFactNodeColor(n.factType, n.type)
      const size = graphNodeSize(n.val)
      return {
        data: {
          id: n.id,
          label: n.label,
          color: baseColor,
          size,
          factType: n.factType,
          fullText: n.fullText,
          _node: n,
        },
      }
    })

    const maxWeight = Math.max(1, ...links.map((l) => l.weight ?? 1))
    const cyEdges = links.map((l, i) => ({
      data: {
        id: `e-${i}`,
        source: l.source,
        target: l.target,
        type: l.type || 'semantic',
        color: graphLinkRgba(l.type, 0.62),
        weight: l.weight ?? 1,
        width: 0.5 + 3 * Math.sqrt((l.weight ?? 1) / maxWeight),
      },
    }))

    const textColor = isDark ? '#e4e4e7' : '#18181b'
    const textBg = isDark ? 'rgba(9,9,11,0.85)' : 'rgba(255,255,255,0.9)'

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...cyNodes, ...cyEdges],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            width: 'data(size)',
            height: 'data(size)',
            label: showLabels ? 'data(label)' : '',
            color: textColor,
            'text-valign': 'bottom',
            'text-halign': 'center',
            'font-size': '8px',
            'font-weight': 500,
            'text-margin-y': 3,
            'text-wrap': 'wrap',
            'text-max-width': '80px',
            'text-background-color': textBg,
            'text-background-opacity': 1,
            'text-background-padding': '2px',
            'text-background-shape': 'roundrectangle',
            'border-width': 1,
            'border-color': isDark ? '#ffffff20' : '#00000015',
            'border-opacity': 0.3,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#0074d9',
            'border-opacity': 1,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 'data(width)',
            'line-color': 'data(color)',
            'curve-style': 'bezier',
            opacity: isDark ? 0.5 : 0.6,
          },
        },
        {
          selector: '.dimmed',
          style: { opacity: 0.15 },
        },
        {
          selector: '.focused',
          style: {
            'border-width': 4,
            'border-color': '#ff6b35',
            'border-opacity': 1,
            'z-index': 999,
          },
        },
        {
          selector: '.connected',
          style: {
            'border-width': 2,
            'border-color': '#0074d9',
            'border-opacity': 0.8,
            opacity: 1,
          },
        },
        {
          selector: 'edge.connection',
          style: {
            width: 2.5,
            opacity: 1,
            'z-index': 100,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'overlay-opacity': 0,
            'overlay-padding': 0,
          },
        },
      ],
      layout: { name: 'preset' },
      selectionType: 'single',
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    })

    // force: force-directed (fcose) — pulls connected nodes together, shows real clusters
    if (layoutMode === 'force') {
      // ponytail: higher gravity for sparse graphs (entity co-occurrence) so connected nodes
      // actually cluster instead of spreading into a grid. Denser graphs (memory) use lower gravity.
      const density = links.length / Math.max(nodes.length, 1)
      const gravity = density < 2 ? 0.25 : 0.05
      const idealEdgeLength = density < 2 ? 120 : 250
      cy.layout({
        name: 'fcose',
        quality: 'default',
        randomize: true,
        animate: true,
        animationDuration: 1200,
        nodeSeparation: 120,
        idealEdgeLength: () => idealEdgeLength,
        edgeElasticity: () => 0.1,
        nestingFactor: 0.1,
        gravity,
        gravityRangeCompound: 1.5,
        gravityCompound: 1.0,
        gravityRange: 3.8,
        numIter: 2500,
        nodeOverlap: 30,
        avoidOverlap: true,
        nodeDimensionsIncludeLabels: true,
        padding: 20,
        tile: true,
        tilingPaddingVertical: 30,
        tilingPaddingHorizontal: 30,
        uniformNodeDimensions: false,
        packComponents: false,
      } as cytoscape.LayoutOptions).run()
    } else if (layoutMode === 'cluster') {
      // cluster by factType: group nodes of same type together, then layout within groups
      const groups = new Map<string, DisplayNode[]>()
      for (const n of nodes) {
        const key = n.factType || n.type || 'unknown'
        const arr = groups.get(key) || []
        arr.push(n)
        groups.set(key, arr)
      }
      const groupKeys = Array.from(groups.keys())
      const groupRadius = Math.max(200, nodes.length * 8)
      const nodePositions = new Map<string, { x: number; y: number }>()
      groupKeys.forEach((key, gi) => {
        const groupNodes = groups.get(key)!
        const angle = (gi / Math.max(groupKeys.length, 1)) * 2 * Math.PI
        const cx = Math.cos(angle) * groupRadius
        const cy = Math.sin(angle) * groupRadius
        groupNodes.forEach((n, ni) => {
          const na = (ni / Math.max(groupNodes.length, 1)) * 2 * Math.PI
          const nr = Math.sqrt(ni + 1) * 40
          nodePositions.set(n.id, { x: cx + Math.cos(na) * nr, y: cy + Math.sin(na) * nr })
        })
      })
      cy.layout({
        name: 'preset',
        positions: (node: cytoscape.NodeSingular) => nodePositions.get(node.id()) || { x: 0, y: 0 },
      } as cytoscape.LayoutOptions).run()
    } else {
      // spiral: Fibonacci spiral layout (also handles 'constellation')
      cy.layout({
        name: 'preset',
        positions: (_node: cytoscape.NodeSingular) => {
          const i = nodes.findIndex((n) => n.id === _node.id())
          if (i < 0) return { x: 0, y: 0 }
          const angle = i * 2.399963229728653
          const radius = Math.sqrt(i + 1) * 30
          return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
        },
      } as cytoscape.LayoutOptions).run()
    }

    cy.fit(undefined, 80)
    cyRef.current = cy
    setIsLoading(false)

    // --- Events ---
    cy.on('tap', 'node', (evt) => {
      const node = evt.target.data('_node') as WikiGraphNode
      if (node) onNodeClick(node)
    })

    cy.on('mouseover', 'node', (evt) => {
      onNodeHover(evt.target.id())
    })

    cy.on('mouseout', 'node', () => {
      onNodeHover(null)
    })

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        onNodeHover(null)
        onBackgroundClick?.()
      }
    })

    // Double-click focus mode (from Hindsight graph-2d.tsx)
    cy.on('dblclick', 'node', (evt) => {
      const focusedId = evt.target.id()
      cy.elements().removeClass('dimmed focused connected connection')
      const neighborhood = evt.target.neighborhood()
      cy.elements().addClass('dimmed')
      evt.target.removeClass('dimmed').addClass('focused')
      neighborhood.nodes().removeClass('dimmed').addClass('connected')
      neighborhood.edges().removeClass('dimmed').addClass('connection')
      cy.animate({
        fit: { eles: evt.target.union(neighborhood), padding: 100 },
        center: { eles: evt.target },
      }, { duration: 600 })
    })

    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [dataSignature])

  // Update visuals when focus/hover/search changes
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    cy.nodes().forEach((node) => {
      const nid = node.id()
      const isDimmed = searchMatchIds && !searchMatchIds.has(nid)
      const isNeighbor = !activeId || neighborIds?.has(nid)
      const isFocused = nid === focusId
      const isHovered = nid === hoverId

      if (isDimmed) {
        node.style('opacity', 0.35)
      } else if (!isNeighbor && activeId) {
        node.style('opacity', 0.25)
      } else {
        node.style('opacity', isFocused || isHovered ? 1 : 0.85)
      }

      if (isFocused || isHovered) {
        node.style({
          'border-width': 2,
          'border-color': '#ff6b35',
          'border-opacity': 1,
          'z-index': 10,
        })
      } else {
        node.style({
          'border-width': 1,
          'border-color': isDark ? '#ffffff20' : '#00000015',
          'border-opacity': 0.3,
          'z-index': 1,
        })
      }
    })

    cy.edges().forEach((edge) => {
      const isActive = focusId === edge.data('source') || focusId === edge.data('target') ||
                       hoverId === edge.data('source') || hoverId === edge.data('target')
      const isDimmed = activeId && !isActive
      edge.style('opacity', isDimmed ? 0.1 : isActive ? 0.9 : 0.5)
      edge.style('width', isActive ? 2.5 : 1)
    })
  }, [focusId, hoverId, searchMatchIds, activeId, neighborIds, isDark])

  // Fit on fitToken change
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || fitToken <= 0) return
    cy.animate({ fit: { eles: cy.elements(), padding: 80 } }, { duration: 350 })
  }, [fitToken])

  // Resize handler
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    const handleResize = () => {
      cy.resize()
      cy.fit(undefined, 80)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const bg = isDark
    ? 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)'
    : 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)'

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[hsl(var(--accent))]" />
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{
          backgroundImage: bg,
          backgroundSize: '20px 20px',
          backgroundColor: isDark ? '#09090b' : '#f8fafc',
        }}
      />
    </div>
  )
}
