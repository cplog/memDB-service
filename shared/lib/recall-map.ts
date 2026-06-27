import type { HindsightClient } from '@vectorize-io/hindsight-client'

type RecallResponse = Awaited<ReturnType<HindsightClient['recall']>>
type ChunkData = { id?: string; text?: string; chunk_index?: number; truncated?: boolean }
type RecallResult = NonNullable<RecallResponse['results']>[number]

export interface RecallMemoryItem {
  id: string
  content: string
  score?: number
  metadata?: Record<string, string> | null
  type?: string | null
  documentId?: string | null
  chunkId?: string | null
  chunkText?: string | null
  chunkTruncated?: boolean
  entities?: string[]
  sourceFactIds?: string[]
  sourceFacts?: RecallMemoryItem[]
  occurredStart?: string | null
  occurredEnd?: string | null
  mentionedAt?: string | null
}

function mapOneResult(
  r: RecallResult,
  chunks: Record<string, ChunkData>,
  sourceFactsRaw: Record<string, RecallResult>,
  seen: Set<string>
): RecallMemoryItem {
  const chunkId = r.chunk_id ?? null
  const chunk = chunkId ? chunks[chunkId] : undefined
  const sourceFactIds = r.source_fact_ids ?? undefined

  const item: RecallMemoryItem = {
    id: r.id,
    content: r.text,
    score: (r as { score?: number }).score,
    metadata: r.metadata,
    type: r.type,
    documentId: r.document_id,
    chunkId,
    chunkText: chunk?.text ?? null,
    chunkTruncated: chunk?.truncated,
    entities: r.entities ?? undefined,
    sourceFactIds,
    occurredStart: r.occurred_start ?? null,
    occurredEnd: r.occurred_end ?? null,
    mentionedAt: r.mentioned_at ?? null,
  }

  if (sourceFactIds?.length) {
    item.sourceFacts = sourceFactIds
      .filter((id) => !seen.has(id))
      .map((id) => {
        const sf = sourceFactsRaw[id]
        if (!sf) return null
        seen.add(id)
        return mapOneResult(sf, chunks, sourceFactsRaw, seen)
      })
      .filter((x): x is RecallMemoryItem => x != null)
  }

  return item
}

/** Map Hindsight recall response into portal memory items with chunk + entity provenance. */
export function recallToMemories(response: RecallResponse): RecallMemoryItem[] {
  const chunks = (response.chunks ?? {}) as Record<string, ChunkData>
  const sourceFactsRaw = (response.source_facts ?? {}) as Record<string, RecallResult>
  const seen = new Set<string>()

  return (response.results ?? []).map((r) =>
    mapOneResult(r, chunks, sourceFactsRaw, seen)
  )
}

export function runRecallMapSelfCheck(): void {
  const mapped = recallToMemories({
    results: [
      {
        id: 'f1',
        text: 'Alice works at Acme',
        chunk_id: 'c1',
        document_id: 'meeting-2024',
        entities: ['Alice'],
        type: 'world',
        occurred_start: '2026-06-01T00:00:00Z',
        occurred_end: '2026-06-02T00:00:00Z',
        mentioned_at: '2026-06-03T00:00:00Z',
      },
    ],
    chunks: {
      c1: {
        id: 'c1',
        text: 'Meeting notes: Alice works at Acme corp.',
        chunk_index: 0,
        truncated: false,
      },
    },
  } as RecallResponse)

  if (mapped.length !== 1) throw new Error('recall map: expected one result')
  const m = mapped[0]
  if (m.chunkText !== 'Meeting notes: Alice works at Acme corp.') {
    throw new Error('recall map: chunk text missing')
  }
  if (m.documentId !== 'meeting-2024') throw new Error('recall map: document_id missing')
  if (!m.entities?.includes('Alice')) throw new Error('recall map: entities missing')
  if (m.occurredStart !== '2026-06-01T00:00:00Z') throw new Error('recall map: occurred_start missing')
  if (m.occurredEnd !== '2026-06-02T00:00:00Z') throw new Error('recall map: occurred_end missing')
  if (m.mentionedAt !== '2026-06-03T00:00:00Z') throw new Error('recall map: mentioned_at missing')
}
