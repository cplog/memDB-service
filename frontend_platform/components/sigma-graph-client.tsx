'use client'

import { useCallback, useEffect, useState } from 'react'
import Graph from 'graphology'
import { SigmaContainer, useLoadGraph, useRegisterEvents, useSetSettings, useSigma } from '@react-sigma/core'
import '@react-sigma/core/lib/style.css'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import {
  GRAPH_SURFACE,
  graphFactNodeColor,
  graphLinkRgba,
  graphNodeSize,
} from '@/lib/workspace-colors'
import type { WikiGraphNode } from '../../shared/lib/okf-wiki'

type DisplayNode = WikiGraphNode & { factType?: string; fullText?: string }

function nodeBaseColor(node: DisplayNode): string {
  return graphFactNodeColor(node.factType, node.type)
}

function fadeColor(hex: string, alpha: number): string {
  if (hex.startsWith('rgba')) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function edgeBaseColor(linkType?: string, alpha = 0.62): string {
  return graphLinkRgba(linkType, alpha)
}

function edgeActiveColor(linkType?: string): string {
  return graphLinkRgba(linkType, 0.92)
}

interface SigmaGraphInnerProps {
  nodes: DisplayNode[]
  links: { source: string; target: string; type?: string }[]
  onNodeClick: (node: WikiGraphNode) => void
  onNodeHover: (nodeId: string | null) => void
  onBackgroundClick?: () => void
  focusId: string | null
  hoverId: string | null
  searchMatchIds: Set<string> | null
  activeId: string | null
  neighborIds: Set<string> | null
  fitToken?: number
  layout?: 'force' | 'constellation'
  maxNodes?: number
  showLabels?: boolean
  linkTypesVisible?: Set<string>
}

function SigmaGraphInner({
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
  layout = 'force',
  maxNodes,
  showLabels = true,
  linkTypesVisible,
}: SigmaGraphInnerProps) {
  const loadGraph = useLoadGraph()
  const sigma = useSigma()
  const setSettings = useSetSettings()
  const registerEvents = useRegisterEvents()
  const [layoutDone, setLayoutDone] = useState(false)

  // Build graph
  useEffect(() => {
    if (!nodes.length) return

    const graph = new Graph()

    // Add nodes with attributes — initial positions required by Sigma
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i]
      const baseColor = nodeBaseColor(node)
      const size = graphNodeSize(node.val)

      graph.addNode(node.id, {
        label: node.label,
        x: Math.cos(i * 2.399963229728653) * Math.sqrt(i + 1) * 5,
        y: Math.sin(i * 2.399963229728653) * Math.sqrt(i + 1) * 5,
        size,
        color: baseColor,
        wikiType: node.type,
        _wikiNode: node,
        _focused: false,
        _hovered: false,
      })
    }

    // Add edges
    const edgeSet = new Set<string>()
    for (const link of links) {
      const key = link.source < link.target ? `${link.source}--${link.target}` : `${link.target}--${link.source}`
      if (edgeSet.has(key)) continue
      edgeSet.add(key)

      if (!graph.hasNode(link.source) || !graph.hasNode(link.target)) continue

      const s = link.source
      const t = link.target
      const linkType = link.type?.toLowerCase()

      graph.addEdge(s, t, {
        size: 1,
        color: edgeBaseColor(linkType),
        _linkType: linkType,
      })
    }

    loadGraph(graph)

    // ponytail: constellation = fixed spiral (fast); force = ForceAtlas2 (slow, denser)
    if (layout === 'force') {
      const sensible = forceAtlas2.inferSettings(graph)
      forceAtlas2.assign(graph, {
        iterations: graph.order > 60 ? 120 : 300,
        settings: {
          ...sensible,
          gravity: 0.04,
          scalingRatio: 14,
          strongGravityMode: true,
          slowDown: 2,
          barnesHutOptimize: true,
          barnesHutTheta: 0.5,
          edgeWeightInfluence: 0.5,
          linLogMode: true,
          outboundAttractionDistribution: true,
        },
      })
    }

    sigma?.refresh()
    setLayoutDone(true)
  }, [nodes, links, loadGraph, sigma, layout])

  // Fit graph to canvas after layout so nodes use the viewport (ponytail: camera reset, not bigger container)
  useEffect(() => {
    if (!sigma || !layoutDone) return
    sigma.getCamera().animatedReset({ duration: 400 })
  }, [sigma, layoutDone, nodes.length, links.length])

  // Update node/edge visuals when focus/hover/search changes
  useEffect(() => {
    if (!sigma) return
    const graph = sigma.getGraph()
    if (!graph) return

    graph.forEachNode((nodeId, attrs) => {
      const node = attrs._wikiNode as DisplayNode
      if (!node) return

      const baseColor = nodeBaseColor(node)
      const isDimmed = searchMatchIds && !searchMatchIds.has(nodeId)
      const isNeighbor = !activeId || neighborIds?.has(nodeId)
      const isFocused = nodeId === focusId
      const isHovered = nodeId === hoverId

      let color = baseColor
      let size = graphNodeSize(node.val)

      if (isDimmed) {
        color = fadeColor(baseColor, 0.35)
        size = size * 0.6
      } else if (!isNeighbor && activeId) {
        color = fadeColor(baseColor, 0.25)
        size = size * 0.7
      }

      if (isFocused || isHovered) {
        size = size * 1.35
        color = baseColor
      }

      graph.setNodeAttribute(nodeId, 'color', color)
      graph.setNodeAttribute(nodeId, 'size', size)
      graph.setNodeAttribute(nodeId, '_focused', isFocused)
      graph.setNodeAttribute(nodeId, '_hovered', isHovered)
    })

    graph.forEachEdge((edgeId, attrs, source, target) => {
      const isActive = focusId === source || focusId === target || hoverId === source || hoverId === target
      const isDimmed = activeId && !isActive
      const base = edgeBaseColor(attrs._linkType as string | undefined)

      graph.setEdgeAttribute(edgeId, 'size', isActive ? 2.5 : 1)
      graph.setEdgeAttribute(edgeId, 'color', isActive
        ? edgeActiveColor(attrs._linkType as string | undefined)
        : isDimmed
          ? GRAPH_SURFACE.edgeDimmed
          : base
      )
    })

    sigma.refresh()
  }, [sigma, focusId, hoverId, searchMatchIds, activeId, neighborIds])

  // Register events
  useEffect(() => {
    registerEvents({
      clickNode: (event) => {
        const nodeId = event.node
        const graph = sigma?.getGraph()
        if (!graph) return
        const node = graph.getNodeAttributes(nodeId)._wikiNode as WikiGraphNode
        if (node) onNodeClick(node)
      },
      enterNode: (event) => {
        onNodeHover(event.node)
      },
      leaveNode: () => {
        onNodeHover(null)
      },
      clickStage: () => {
        onNodeHover(null)
        onBackgroundClick?.()
      },
    })
  }, [registerEvents, sigma, onNodeClick, onNodeHover, onBackgroundClick])

  // Fit camera when parent requests full-graph view
  useEffect(() => {
    if (!sigma || fitToken <= 0) return
    sigma.getCamera().animatedReset({ duration: 350 })
  }, [fitToken, sigma])

  // Sigma settings
  useEffect(() => {
    setSettings({
      labelRenderedSizeThreshold: 8,
      labelDensity: 0.4,
      labelGridCellSize: 80,
      renderLabels: showLabels,
      renderEdgeLabels: false,
      hideEdgesOnMove: true,
      hideLabelsOnMove: true,
      zIndex: true,
      defaultNodeType: 'circle',
      defaultEdgeType: 'line',
      labelColor: { color: GRAPH_SURFACE.label },
      nodeReducer: (nodeId, data) => {
        const res = { ...data }
        if (data._focused || data._hovered) {
          res.zIndex = 10
          res.highlighted = true
        }
        return res
      },
    })
  }, [setSettings, showLabels])

  return null
}

interface SigmaGraphClientProps extends SigmaGraphInnerProps {}

export function SigmaGraphClient(props: SigmaGraphClientProps) {
  const { showLabels = true } = props
  return (
    <SigmaContainer
      style={{ width: '100%', height: '100%', background: GRAPH_SURFACE.canvas }}
      settings={{
        defaultNodeColor: GRAPH_SURFACE.label,
        defaultEdgeColor: GRAPH_SURFACE.edge,
        labelFont: 'system-ui, -apple-system, sans-serif',
        labelSize: 12,
        labelColor: { color: GRAPH_SURFACE.label },
        zIndex: true,
        labelDensity: 0.4,
        labelGridCellSize: 80,
        labelRenderedSizeThreshold: 8,
        renderLabels: showLabels,
        hideLabelsOnMove: true,
        hideEdgesOnMove: true,
      }}
    >
      <SigmaGraphInner {...props} />
    </SigmaContainer>
  )
}
