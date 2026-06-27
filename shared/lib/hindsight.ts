import {
  HindsightClient,
  createClient,
  createConfig,
  sdk,
} from '@vectorize-io/hindsight-client'
import type { PortalUser } from './auth'
import type { MemoryScope } from './memory-scope'
import { scopeTagsForQuery } from './memory-scope'
import type { RetainRequestBody } from './retain-validation'
import { documentIdFromFilename } from './document-display'
import { recallToMemories, type RecallMemoryItem } from './recall-map'
import { buildRetainOptions } from './retain-validation'
import { appendScenarioTag } from './scenario'

export { recallToMemories, type RecallMemoryItem }

let client: HindsightClient | null = null

function baseUrl(): string {
  return (
    process.env.HINDSIGHT_API_URL ||
    process.env.HINDSIGHT_URL ||
    'http://localhost:8888'
  )
}

function apiKey(): string | undefined {
  const key = process.env.HINDSIGHT_API_KEY
  return key || undefined
}

export function getHindsightClient(): HindsightClient {
  if (!client) {
    client = new HindsightClient({ baseUrl: baseUrl(), apiKey: apiKey() })
  }
  return client
}

function getSdk() {
  return createClient(
    createConfig({
      baseUrl: baseUrl(),
      headers: apiKey() ? { Authorization: `Bearer ${apiKey()}` } : {},
    })
  )
}

export async function listBanks() {
  const { data, error } = await sdk.listBanks({ client: getSdk() })
  if (error) throw new Error(String(error))
  return data
}

export async function getBankStats(bankId: string) {
  const { data, error } = await sdk.getAgentStats({
    client: getSdk(),
    path: { bank_id: bankId },
  })
  if (error) throw new Error(String(error))
  return data
}

export async function exportBank(bankId: string) {
  const sdkClient = getSdk()
  const [docResult, entityResult, mmResult] = await Promise.all([
    sdk.exportDocuments({ client: sdkClient, path: { bank_id: bankId } }),
    sdk.listEntities({ client: sdkClient, path: { bank_id: bankId }, query: { limit: 1000 } }),
    sdk.listMentalModels({
      client: sdkClient,
      path: { bank_id: bankId },
      query: { detail: 'full', limit: 200 },
    }),
  ])
  if (docResult.error) throw new Error(String(docResult.error))
  if (entityResult.error) throw new Error(String(entityResult.error))
  if (mmResult.error) throw new Error(String(mmResult.error))
  return {
    documents: docResult.data,
    entities: entityResult.data,
    mentalModels: mmResult.data,
  }
}

export async function retainForUser(
  user: PortalUser,
  scope: MemoryScope,
  body: RetainRequestBody
) {
  const options = buildRetainOptions(user, scope, body)
  return getHindsightClient().retain(scope.bankId, body.content, {
    context: options.context,
    timestamp: options.timestamp,
    metadata: options.metadata,
    documentId: options.documentId,
    tags: options.tags,
    async: options.async,
    observationScopes: options.observationScopes,
    strategy: options.retainStrategy,
    updateMode: body.updateMode ?? (body.documentId ? 'replace' : undefined),
  })
}

export async function updateDocumentContent(
  user: PortalUser,
  scope: MemoryScope,
  bankId: string,
  documentId: string,
  content: string
) {
  const doc = await getDocumentForBank(bankId, documentId)
  const metadata: Record<string, string> = {}
  const prior = doc?.document_metadata as Record<string, unknown> | null | undefined
  if (prior) {
    for (const [k, v] of Object.entries(prior)) {
      if (typeof v === 'string') metadata[k] = v
    }
  }
  metadata.edited_in_portal = 'true'
  return retainForUser(user, scope, {
    content,
    documentId,
    updateMode: 'replace',
    context: `Document edit — ${user.name}`,
    metadata,
  })
}

export async function recallForScope(
  scope: MemoryScope,
  query: string,
  budget: 'low' | 'mid' = 'mid',
  options?: {
    includeChunks?: boolean
    includeEntities?: boolean
    includeSourceFacts?: boolean
    maxChunkTokens?: number
    scenarioId?: string | null
    queryTimestamp?: string
    trace?: boolean
  }
) {
  const filtered = scopeTagsForQuery(scope, options?.scenarioId)
  return getHindsightClient().recall(scope.bankId, query, {
    tags: filtered.tags,
    tagsMatch: filtered.tagsMatch,
    budget,
    maxTokens: 4096,
    includeChunks: options?.includeChunks ?? true,
    includeEntities: options?.includeEntities ?? true,
    includeSourceFacts: options?.includeSourceFacts ?? true,
    maxChunkTokens: options?.maxChunkTokens ?? 4096,
    queryTimestamp: options?.queryTimestamp,
    trace: options?.trace,
  })
}

export async function reflectForScope(
  scope: MemoryScope,
  query: string,
  budget: 'low' | 'mid' = 'mid',
  options?: { scenarioId?: string | null }
) {
  const filtered = scopeTagsForQuery(scope, options?.scenarioId)
  return getHindsightClient().reflect(scope.bankId, query, {
    tags: filtered.tags,
    tagsMatch: filtered.tagsMatch,
    budget,
    includeFacts: true,
  })
}

export async function getMemoriesTimeseriesForBank(
  bankId: string,
  options?: {
    period?: '7d' | '30d' | '90d'
    timeField?: 'created_at' | 'occurred_start' | 'mentioned_at'
  }
) {
  const { data, error } = await sdk.getMemoriesTimeseries({
    client: getSdk(),
    path: { bank_id: bankId },
    query: {
      period: options?.period ?? '30d',
      time_field: options?.timeField ?? 'created_at',
    },
  })
  if (error) throw new Error(String(error))
  return data
}

export async function getBankConfig(bankId: string) {
  return getHindsightClient().getBankConfig(bankId)
}

export async function getBankProfile(bankId: string) {
  return getHindsightClient().getBankProfile(bankId)
}

export async function updateBankName(bankId: string, name: string) {
  return getHindsightClient().createBank(bankId, { name })
}

export async function updateBankConfig(
  bankId: string,
  updates: Record<string, unknown>
) {
  return getHindsightClient().updateBankConfig(bankId, updates as Parameters<
    HindsightClient['updateBankConfig']
  >[1])
}

export async function listMentalModelsForBank(
  bankId: string,
  options?: {
    tags?: string[]
    detail?: 'metadata' | 'content' | 'full'
    limit?: number
    offset?: number
  }
) {
  const { data, error } = await sdk.listMentalModels({
    client: getSdk(),
    path: { bank_id: bankId },
    query: {
      tags: options?.tags,
      detail: options?.detail ?? 'content',
      limit: options?.limit,
      offset: options?.offset,
    },
  })
  if (error) throw new Error(String(error))
  return data
}

export async function createMentalModelForBank(
  bankId: string,
  name: string,
  sourceQuery: string,
  options?: {
    id?: string
    tags?: string[]
    maxTokens?: number
    refreshAfterConsolidation?: boolean
  }
) {
  return getHindsightClient().createMentalModel(bankId, name, sourceQuery, {
    id: options?.id,
    tags: options?.tags,
    maxTokens: options?.maxTokens,
    trigger: options?.refreshAfterConsolidation
      ? { refreshAfterConsolidation: true }
      : undefined,
  })
}

export async function getMentalModelForBank(bankId: string, mentalModelId: string) {
  return getHindsightClient().getMentalModel(bankId, mentalModelId)
}

export async function refreshMentalModelForBank(bankId: string, mentalModelId: string) {
  return getHindsightClient().refreshMentalModel(bankId, mentalModelId)
}

export async function clearMentalModelForBank(bankId: string, mentalModelId: string) {
  return getHindsightClient().clearMentalModel(bankId, mentalModelId)
}

export async function updateMentalModelForBank(
  bankId: string,
  mentalModelId: string,
  options: {
    name?: string
    sourceQuery?: string
    tags?: string[]
    maxTokens?: number
    refreshAfterConsolidation?: boolean
  }
) {
  return getHindsightClient().updateMentalModel(bankId, mentalModelId, {
    name: options.name,
    sourceQuery: options.sourceQuery,
    tags: options.tags,
    maxTokens: options.maxTokens,
    trigger:
      options.refreshAfterConsolidation !== undefined
        ? { refreshAfterConsolidation: options.refreshAfterConsolidation }
        : undefined,
  })
}

export async function deleteMentalModelForBank(bankId: string, mentalModelId: string) {
  return getHindsightClient().deleteMentalModel(bankId, mentalModelId)
}

export async function uploadFiles(
  bankId: string,
  files: File[],
  user: PortalUser,
  scope: MemoryScope,
  options?: {
    parser?: string
    documentIds?: (string | undefined)[]
    sourceType?: string
    meetingName?: string
    ticketId?: string
    sourceDate?: string
    scenarioId?: string
    retainStrategy?: string
  }
) {
  const hs = getHindsightClient()
  const usedIds = new Set<string>()
  const parser = options?.parser ?? 'markitdown'
  const sourceDate = options?.sourceDate
    ? (() => {
        const d = new Date(options.sourceDate!)
        return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
      })()
    : undefined
  const contextParts: string[] = [`File upload — ${user.name}`]
  if (options?.sourceType) contextParts.push(`Source: ${options.sourceType}`)
  if (options?.meetingName?.trim()) {
    contextParts.push(`Meeting: ${options.meetingName.trim()}`)
  }
  if (options?.ticketId?.trim()) contextParts.push(`Ticket: ${options.ticketId.trim()}`)
  const uploadContext = contextParts.join(' · ')

  return hs.retainFiles(bankId, files, {
    context: uploadContext,
    filesMetadata: files.map((file, i) => {
      const name = file instanceof File ? file.name : 'upload'
      const document_id =
        options?.documentIds?.[i] ?? documentIdFromFilename(name, usedIds)
      usedIds.add(document_id)
      const metadata: Record<string, string> = {
        original_filename: name,
        source_company: user.companySlug,
        source_team: scope.teamId,
        source_user: user.email,
        retained_by: user.id,
        parser,
      }
      if (options?.sourceType) metadata.source_type = options.sourceType
      if (options?.meetingName?.trim()) metadata.meeting_name = options.meetingName.trim()
      if (options?.ticketId?.trim()) metadata.ticket_id = options.ticketId.trim()
      if (sourceDate) metadata.source_date = sourceDate
      if (options?.scenarioId) metadata.scenario_id = options.scenarioId
      return {
        document_id,
        context: uploadContext,
        tags: appendScenarioTag([...scope.tags, 'scope:private'], options?.scenarioId),
        metadata,
        strategy: options?.retainStrategy,
      }
    }),
  })
}

export async function deleteDocumentForBank(bankId: string, documentId: string) {
  const { data, error } = await sdk.deleteDocument({
    client: getSdk(),
    path: { bank_id: bankId, document_id: documentId },
  })
  if (error) throw new Error(String(error))
  return data
}

export async function getBankGraphData(
  bankId: string,
  options?: { type?: string; q?: string; limit?: number }
) {
  const { data, error } = await sdk.getGraph({
    client: getSdk(),
    path: { bank_id: bankId },
    query: {
      limit: options?.limit ?? 500,
      type: options?.type,
      q: options?.q,
    },
  })
  if (error) throw new Error(String(error))
  return data
}

export async function listDocumentsForBank(
  bankId: string,
  options?: {
    limit?: number
    offset?: number
    q?: string
    tags?: string[]
    tagsMatch?: 'any' | 'all' | 'any_strict' | 'all_strict'
  }
) {
  const { data, error } = await sdk.listDocuments({
    client: getSdk(),
    path: { bank_id: bankId },
    query: {
      limit: options?.limit,
      offset: options?.offset,
      q: options?.q,
      tags: options?.tags,
      tags_match: options?.tagsMatch,
    },
  })
  if (error) throw new Error(String(error))
  return data
}

export async function updateDocumentTagsForBank(
  bankId: string,
  documentId: string,
  tags: string[]
) {
  return getHindsightClient().updateDocument(bankId, documentId, { tags })
}

export async function listEntitiesForBank(
  bankId: string,
  options?: { limit?: number; offset?: number }
) {
  const { data, error } = await sdk.listEntities({
    client: getSdk(),
    path: { bank_id: bankId },
    query: { limit: options?.limit, offset: options?.offset },
  })
  if (error) throw new Error(String(error))
  return data
}

export async function getEntityForBank(bankId: string, entityId: string) {
  const { data, error } = await sdk.getEntity({
    client: getSdk(),
    path: { bank_id: bankId, entity_id: entityId },
  })
  if (error) {
    const msg = String(error)
    // ponytail: SDK not-found shapes vary — treat as missing entity, not 500
    if (/404|not found|unknown entity/i.test(msg)) return null
    throw new Error(msg)
  }
  return data ?? null
}

export async function getDocumentForBank(bankId: string, documentId: string) {
  return getHindsightClient().getDocument(bankId, documentId)
}

export async function listMemoriesForBank(
  bankId: string,
  options?: {
    limit?: number
    offset?: number
    documentId?: string
    q?: string
  }
) {
  return getHindsightClient().listMemories(bankId, {
    limit: options?.limit,
    offset: options?.offset,
    documentId: options?.documentId,
    q: options?.q,
    state: 'valid',
  })
}

export async function updateMemoryForBank(
  bankId: string,
  memoryId: string,
  updates: { text?: string; state?: 'valid' | 'invalidated'; reason?: string }
) {
  const { data, error } = await sdk.updateMemory({
    client: getSdk(),
    path: { bank_id: bankId, memory_id: memoryId },
    body: updates,
  })
  if (error) throw new Error(String(error))
  return data
}
