'use client'

import { useCallback, useEffect, useState } from 'react'
import Graph from 'graphology'
import { SigmaContainer, useLoadGraph, useRegisterEvents, useSetSettings, useSigma } from '@react-sigma/core'
import '@react-sigma/core/lib/style.css'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import { WIKI_GRAPH_COLORS } from '@/lib/workspace-colors'
import type { WikiGraphNode } from '../../shared/lib/okf-wiki'

const NODE_COLORS: Record<string, string> = {
  source: WIKI_GRAPH_COLORS.source,
  entity: WIKI_GRAPH_COLORS.entity,
  index: WIKI_GRAPH_COLORS.index,
}

const DIMMED_NODE_COLORS: Record<string, string> = {
  source: 'rgba(249, 115, 22, 0.5)',
  entity: 'rgba(59, 130, 246, 0.5)',
  index: 'rgba(16, 185, 129, 0.5)',
}

const UNFOCUSED_NODE_COLORS: Record<string, string> = {
  source: 'rgba(249, 115, 22, 0.35)',
  entity: 'rgba(59, 130, 246, 0.35)',
  index: 'rgba(16, 185, 129, 0.35)',
}

const EDGE_COLOR = 'rgba(100, 116, 139, 0.5)'
const EDGE_DIMMED_COLOR = 'rgba(100, 116, 139, 0.22)'
const EDGE_ACTIVE_COLOR = 'rgba(16, 185, 129, 0.85)'

interface SigmaGraphInnerProps {
  nodes: WikiGraphNode[]
  links: { source: string; target: string }[]
  onNodeClick: (node: WikiGraphNode) => void
  onNodeHover: (nodeId: string | null) => void
  onBackgroundClick?: () => void
  focusId: string | null
  hoverId: string | null
  searchMatchIds: Set<string> | null
  activeId: string | null
  neighborIds: Set<string> | null
  fitToken?: number
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
      const baseColor = NODE_COLORS[node.type] || '#999'
      const isDimmed = searchMatchIds && !searchMatchIds.has(node.id)
      const isNeighbor = !activeId || neighborIds?.has(node.id)
      const isFocused = node.id === focusId
      const isHovered = node.id === hoverId

      let color = baseColor
      let size = Math.max(4, Math.sqrt(node.val ?? 4) * 2.4)

      if (isDimmed) {
        color = DIMMED_NODE_COLORS[node.type] || 'rgba(100, 116, 139, 0.5)'
        size = size * 0.6
      } else if (!isNeighbor && activeId) {
        color = UNFOCUSED_NODE_COLORS[node.type] || 'rgba(100, 116, 139, 0.35)'
        size = size * 0.7
      }

      if (isFocused || isHovered) {
        size = size * 1.3
      }

      graph.addNode(node.id, {
        label: node.label,
        x: Math.cos(i * 2.399963229728653) * Math.sqrt(i + 1) * 5,
        y: Math.sin(i * 2.399963229728653) * Math.sqrt(i + 1) * 5,
        size,
        color,
        wikiType: node.type,
        _wikiNode: node,
        _focused: isFocused,
        _hovered: isHovered,
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
      const isActive = focusId === s || focusId === t || hoverId === s || hoverId === t
      const isDimmed = activeId && !isActive

      graph.addEdge(s, t, {
        size: isActive ? 2 : 1,
        color: isActive ? EDGE_ACTIVE_COLOR : isDimmed ? EDGE_DIMMED_COLOR : EDGE_COLOR,
      })
    }

    loadGraph(graph)

    // Run ForceAtlas2 with inferred settings tuned for wiki graphs
    const sensible = forceAtlas2.inferSettings(graph)
    forceAtlas2.assign(graph, {
      iterations: 300,
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

    sigma?.refresh()
    setLayoutDone(true)
  }, [nodes, links, loadGraph, sigma])

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
      const node = attrs._wikiNode as WikiGraphNode
      if (!node) return

      const baseColor = NODE_COLORS[node.type] || '#999'
      const isDimmed = searchMatchIds && !searchMatchIds.has(nodeId)
      const isNeighbor = !activeId || neighborIds?.has(nodeId)
      const isFocused = nodeId === focusId
      const isHovered = nodeId === hoverId

      let color = baseColor
      let size = Math.max(4, Math.sqrt(node.val ?? 4) * 2.4)

      if (isDimmed) {
        color = DIMMED_NODE_COLORS[node.type] || 'rgba(100, 116, 139, 0.5)'
        size = size * 0.6
      } else if (!isNeighbor && activeId) {
        color = UNFOCUSED_NODE_COLORS[node.type] || 'rgba(100, 116, 139, 0.35)'
        size = size * 0.7
      }

      if (isFocused || isHovered) {
        size = size * 1.3
      }

      graph.setNodeAttribute(nodeId, 'color', color)
      graph.setNodeAttribute(nodeId, 'size', size)
      graph.setNodeAttribute(nodeId, '_focused', isFocused)
      graph.setNodeAttribute(nodeId, '_hovered', isHovered)
    })

    graph.forEachEdge((edgeId, _attrs, source, target) => {
      const isActive = focusId === source || focusId === target || hoverId === source || hoverId === target
      const isDimmed = activeId && !isActive

      graph.setEdgeAttribute(edgeId, 'size', isActive ? 2 : 1)
      graph.setEdgeAttribute(edgeId, 'color', isActive
        ? EDGE_ACTIVE_COLOR
        : isDimmed
          ? EDGE_DIMMED_COLOR
          : EDGE_COLOR
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
      labelDensity: 0.5,
      labelGridCellSize: 60,
      renderLabels: true,
      renderEdgeLabels: false,
      hideEdgesOnMove: false,
      hideLabelsOnMove: true,
      zIndex: true,
      defaultNodeType: 'circle',
      defaultEdgeType: 'line',
      nodeReducer: (nodeId, data) => {
        const res = { ...data }
        if (data._focused || data._hovered) {
          res.zIndex = 10
          res.highlighted = true
        }
        return res
      },
    })
  }, [setSettings])

  return null
}

interface SigmaGraphClientProps extends SigmaGraphInnerProps {}

export function SigmaGraphClient(props: SigmaGraphClientProps) {
  return (
    <SigmaContainer
      style={{ width: '100%', height: '100%' }}
      settings={{
        defaultNodeColor: '#64748b',
        defaultEdgeColor: EDGE_COLOR,
        labelFont: 'system-ui, -apple-system, sans-serif',
        labelSize: 11,
        labelColor: { color: '#334155' },
        zIndex: true,
        labelDensity: 0.5,
        labelGridCellSize: 60,
        labelRenderedSizeThreshold: 8,
        renderLabels: true,
        hideLabelsOnMove: true,
      }}
    >
      <SigmaGraphInner {...props} />
    </SigmaContainer>
  )
}
