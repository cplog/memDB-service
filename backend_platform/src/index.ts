import { serve } from '@hono/node-server'
import { Hono, type Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import {
  canExportBank,
  canManageBanks,
  canUpdateBankConfig,
  createSession,
  getUserByEmail,
} from '../../shared/lib/auth.js'
import { buildBankGraph } from '../../shared/lib/bank-graph.js'
import { HttpError, requireScope, requireUser } from '../../shared/lib/guard.js'
import {
  exportBank,
  getBankConfig,
  getBankProfile,
  getBankStats,
  deleteDocumentForBank,
  getDocumentForBank,
  getEntityForBank,
  listBanks,
  listDocumentsForBank,
  listEntitiesForBank,
  listMemoriesForBank,
  updateMemoryForBank,
  listMentalModelsForBank,
  createMentalModelForBank,
  getMentalModelForBank,
  refreshMentalModelForBank,
  clearMentalModelForBank,
  updateMentalModelForBank,
  deleteMentalModelForBank,
  recallForScope,
  recallToMemories,
  reflectForScope,
  retainForUser,
  updateDocumentContent,
  updateDocumentTagsForBank,
  updateBankConfig,
  updateBankName,
  uploadFiles,
} from '../../shared/lib/hindsight.js'
import { buildOkfWikiExport } from '../../shared/lib/okf-wiki.js'
import {
  RetainValidationError,
  type RetainRequestBody,
} from '../../shared/lib/retain-validation.js'
import { resolveMemoryScopeByTeam } from '../../shared/lib/memory-scope.js'
import { ensureTeamBank, ensureTeamBankForUser } from '../../shared/lib/team-banks.js'
import {
  getAccessibleBankIds,
  getAccessibleTeams,
  parseTeamBankId,
  teamBankId,
  teamsForCompany,
} from '../../shared/lib/teams.js'

const app = new Hono()
const SESSION = 'portal-session'

function err(c: Context, e: unknown) {
  if (e instanceof HttpError) {
    return c.json({ error: e.message }, e.status as 401 | 403 | 400 | 500)
  }
  const message = e instanceof Error ? e.message : 'Internal error'
  return c.json({ error: message }, 500)
}

async function user(c: Context) {
  return requireUser(getCookie(c, SESSION))
}

app.onError((e, c) => err(c, e))

app.get('/health', (c) => c.json({ ok: true, service: 'db-mem-api' }))

app.post('/api/auth/login', async (c) => {
  const { email } = await c.req.json<{ email?: string }>()
  const portalUser = getUserByEmail(email ?? '')
  if (!portalUser) throw new HttpError(401, 'Invalid credentials')

  const token = await createSession(portalUser)
  setCookie(c, SESSION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return c.json({ success: true, user: portalUser })
})

app.post('/api/auth/logout', (c) => {
  deleteCookie(c, SESSION, { path: '/' })
  return c.json({ success: true })
})

app.get('/api/teams', async (c) => {
  const u = await user(c)
  const teams = getAccessibleTeams(u).map((t) => ({
    ...t,
    bankId: teamBankId(t.id, u.companySlug),
  }))
  return c.json({ teams, companySlug: u.companySlug })
})

app.get('/api/banks', async (c) => {
  const u = await user(c)
  const allowed = new Set(getAccessibleBankIds(u))
  const data = await listBanks()
  const items = data?.banks ?? []
  const remoteIds = items.map(
    (b: { bank_id?: string; id?: string }) => b.bank_id ?? b.id ?? ''
  )
  const visible = remoteIds.filter((id: string) => id && allowed.has(id))
  return c.json({
    banks: visible.length ? visible : getAccessibleBankIds(u),
    teams: getAccessibleTeams(u),
  })
})

app.put('/api/banks', async (c) => {
  const u = await user(c)
  if (!canManageBanks(u)) throw new HttpError(403, 'Forbidden')

  const { teamId } = await c.req.json<{ teamId?: string }>()
  if (!teamId) throw new HttpError(400, 'teamId required')

  const team = teamsForCompany(u.companySlug).find((t) => t.id === teamId)
  if (!team) throw new HttpError(400, 'Unknown team')

  resolveMemoryScopeByTeam(u, teamId)
  await ensureTeamBank(team, u.companySlug)
  return c.json({ bankId: teamBankId(teamId, u.companySlug), team })
})

app.get('/api/banks/:bankId/graph', async (c) => {
  const u = await user(c)
  const bankId = c.req.param('bankId')
  requireScope(u, bankId)
  const teamLabel = parseTeamBankId(bankId) ?? bankId
  return c.json(await buildBankGraph(bankId, teamLabel))
})

async function buildWikiBundleForBank(bankId: string, bankLabel?: string) {
  const docList = await listDocumentsForBank(bankId, { limit: 100, offset: 0 })
  const docItems = docList?.items ?? []
  const documents = await Promise.all(
    docItems.map(async (row) => {
      const id = String((row as { id?: string }).id ?? '')
      if (!id) return null
      const full = await getDocumentForBank(bankId, id)
      return full ?? { id, ...(row as object) }
    })
  )

  const memories: Array<Record<string, unknown>> = []
  let offset = 0
  const pageSize = 100
  while (memories.length < 500) {
    const page = await listMemoriesForBank(bankId, {
      limit: pageSize,
      offset,
    })
    const batch = page?.items ?? []
    if (!batch.length) break
    memories.push(...batch)
    offset += batch.length
    if (batch.length < pageSize || memories.length >= (page.total ?? memories.length)) {
      break
    }
  }

  const entitiesPage = await listEntitiesForBank(bankId, { limit: 200, offset: 0 })

  return buildOkfWikiExport({
    bankId,
    bankLabel,
    documents: documents.filter(Boolean).map((d) => ({
      id: String((d as { id?: string }).id ?? ''),
      original_text: (d as { original_text?: string | null }).original_text,
      memory_unit_count: (d as { memory_unit_count?: number }).memory_unit_count,
      nodes_by_fact_type: (d as { nodes_by_fact_type?: Record<string, number> })
        .nodes_by_fact_type,
      created_at: (d as { created_at?: string }).created_at,
      updated_at: (d as { updated_at?: string }).updated_at,
      tags: (d as { tags?: string[] }).tags,
      document_metadata: (d as { document_metadata?: Record<string, unknown> })
        .document_metadata,
    })),
    memories: memories.map((m) => ({
      id: String(m.id ?? ''),
      text: m.text as string | undefined,
      fact_type: m.fact_type as string | undefined,
      document_id: m.document_id as string | undefined,
      entities: Array.isArray(m.entities)
        ? (m.entities as string[])
        : typeof m.entities === 'string'
          ? m.entities.split(',').map((s) => s.trim())
          : undefined,
    })),
    entities: (entitiesPage?.items ?? []).map((e) => ({
      id: String(e.id),
      canonical_name: e.canonical_name,
      mention_count: e.mention_count,
    })),
  })
}

app.get('/api/banks/:bankId/wiki', async (c) => {
  const u = await user(c)
  const bankId = c.req.param('bankId')
  const bankLabel = c.req.query('bankLabel') || undefined
  requireScope(u, bankId)
  return c.json(await buildWikiBundleForBank(bankId, bankLabel))
})

app.get('/api/documents', async (c) => {
  const u = await user(c)
  const bankId = c.req.query('bankId')
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)
  const limit = Math.min(Number(c.req.query('limit') || 50), 100)
  const offset = Number(c.req.query('offset') || 0)
  const q = c.req.query('q') || undefined
  const tagsRaw = c.req.query('tags')
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined
  const tagsMatch = c.req.query('tagsMatch') as
    | 'any'
    | 'all'
    | 'any_strict'
    | 'all_strict'
    | undefined
  return c.json(
    await listDocumentsForBank(bankId, { limit, offset, q, tags, tagsMatch })
  )
})

app.get('/api/documents/:documentId', async (c) => {
  const u = await user(c)
  const bankId = c.req.query('bankId')
  const documentId = c.req.param('documentId')
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)
  const doc = await getDocumentForBank(bankId, documentId)
  if (!doc) throw new HttpError(404, 'Document not found')
  return c.json(doc)
})

app.delete('/api/documents/:documentId', async (c) => {
  const u = await user(c)
  const bankId = c.req.query('bankId')
  const documentId = c.req.param('documentId')
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)
  return c.json(await deleteDocumentForBank(bankId, documentId))
})

app.put('/api/documents/:documentId', async (c) => {
  const u = await user(c)
  const documentId = c.req.param('documentId')
  const { bankId, content } = await c.req.json<{ bankId?: string; content?: string }>()
  if (!bankId || !content?.trim()) {
    throw new HttpError(400, 'bankId and content required')
  }
  const scope = requireScope(u, bankId)
  await ensureTeamBankForUser(u, bankId)
  return c.json(
    await updateDocumentContent(u, scope, bankId, documentId, content.trim())
  )
})

app.patch('/api/documents/:documentId', async (c) => {
  const u = await user(c)
  if (!canExportBank(u)) throw new HttpError(403, 'Forbidden')
  const documentId = c.req.param('documentId')
  const { bankId, tags } = await c.req.json<{ bankId?: string; tags?: string[] }>()
  if (!bankId || !Array.isArray(tags)) {
    throw new HttpError(400, 'bankId and tags array required')
  }
  requireScope(u, bankId)
  return c.json(await updateDocumentTagsForBank(bankId, documentId, tags))
})

app.get('/api/memories', async (c) => {
  const u = await user(c)
  const bankId = c.req.query('bankId')
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)
  const limit = Math.min(Number(c.req.query('limit') || 50), 100)
  const offset = Number(c.req.query('offset') || 0)
  const documentId = c.req.query('documentId') || undefined
  const q = c.req.query('q') || undefined
  return c.json(
    await listMemoriesForBank(bankId, { limit, offset, documentId, q })
  )
})

app.patch('/api/memories/:memoryId', async (c) => {
  const u = await user(c)
  const memoryId = c.req.param('memoryId')
  const { bankId, state, reason } = await c.req.json<{
    bankId?: string
    state?: 'valid' | 'invalidated'
    reason?: string
  }>()
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)
  return c.json(await updateMemoryForBank(bankId, memoryId, { state, reason }))
})

app.post('/api/retain', async (c) => {
  const u = await user(c)
  const body = await c.req.json<RetainRequestBody & { bankId?: string }>()
  if (!body.bankId || !body.content?.trim()) {
    throw new HttpError(400, 'bankId and content required')
  }
  const scope = requireScope(u, body.bankId)
  await ensureTeamBankForUser(u, body.bankId)
  try {
    const data = await retainForUser(u, scope, {
      ...body,
      content: body.content.trim(),
    })
    return c.json(data)
  } catch (e) {
    if (e instanceof RetainValidationError) {
      throw new HttpError(400, e.message)
    }
    throw e
  }
})

app.post('/api/recall', async (c) => {
  const u = await user(c)
  const { bankId, query, budget, scenarioId } = await c.req.json<{
    bankId?: string
    query?: string
    budget?: string
    scenarioId?: string
  }>()
  if (!bankId || !query?.trim()) {
    throw new HttpError(400, 'bankId and query required')
  }
  const scope = requireScope(u, bankId)
  const data = await recallForScope(
    scope,
    query,
    budget === 'high' ? 'mid' : (budget as 'low' | 'mid') ?? 'mid',
    { scenarioId }
  )
  return c.json({
    ...data,
    memories: recallToMemories(data),
    chunks: data.chunks ?? null,
    entities: data.entities ?? null,
    source_facts: data.source_facts ?? null,
  })
})

app.post('/api/reflect', async (c) => {
  const u = await user(c)
  const { bankId, query, budget, scenarioId } = await c.req.json<{
    bankId?: string
    query?: string
    budget?: string
    scenarioId?: string
  }>()
  if (!bankId || !query?.trim()) {
    throw new HttpError(400, 'bankId and query required')
  }
  const scope = requireScope(u, bankId)
  const data = await reflectForScope(
    scope,
    query,
    budget === 'high' ? 'mid' : (budget as 'low' | 'mid') ?? 'mid',
    { scenarioId }
  )
  return c.json({ ...data, response: data.text, based_on: data.based_on ?? null })
})

app.post('/api/stats', async (c) => {
  const u = await user(c)
  const { bankId } = await c.req.json<{ bankId?: string }>()
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)
  return c.json(await getBankStats(bankId))
})

app.post('/api/config', async (c) => {
  const u = await user(c)
  const { bankId, action, updates } = await c.req.json<{
    bankId?: string
    action?: string
    updates?: Record<string, unknown>
  }>()
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)

  if (action === 'get') {
    const [cfg, profile] = await Promise.all([
      getBankConfig(bankId),
      getBankProfile(bankId).catch(() => null),
    ])
    const config = (cfg.config ?? {}) as Record<string, unknown>
    const overrides = (cfg.overrides ?? {}) as Record<string, unknown>
    return c.json({
      bank_id: bankId,
      name: profile?.name ?? bankId,
      ...config,
      ...overrides,
    })
  }
  if (action === 'update') {
    if (!canUpdateBankConfig(u)) throw new HttpError(403, 'Forbidden')
    const raw = { ...(updates ?? {}) }
    const bankName = raw.name
    if (bankName !== undefined) {
      await updateBankName(bankId, String(bankName))
      delete raw.name
    }
    if (Object.keys(raw).length === 0) {
      const profile = await getBankProfile(bankId).catch(() => null)
      const cfg = await getBankConfig(bankId)
      const config = (cfg.config ?? {}) as Record<string, unknown>
      const overrides = (cfg.overrides ?? {}) as Record<string, unknown>
      return c.json({
        bank_id: bankId,
        name: profile?.name ?? bankId,
        ...config,
        ...overrides,
      })
    }
    const cfg = await updateBankConfig(bankId, raw)
    const profile = await getBankProfile(bankId).catch(() => null)
    const config = (cfg.config ?? {}) as Record<string, unknown>
    const overrides = (cfg.overrides ?? {}) as Record<string, unknown>
    return c.json({
      bank_id: bankId,
      name: profile?.name ?? bankId,
      ...config,
      ...overrides,
    })
  }
  throw new HttpError(400, 'Invalid action')
})

app.get('/api/mental-models', async (c) => {
  const u = await user(c)
  const bankId = c.req.query('bankId')
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)
  const detail = (c.req.query('detail') || 'content') as 'metadata' | 'content' | 'full'
  const limit = Math.min(Number(c.req.query('limit') || 50), 100)
  const offset = Number(c.req.query('offset') || 0)
  return c.json(await listMentalModelsForBank(bankId, { detail, limit, offset }))
})

app.post('/api/mental-models', async (c) => {
  const u = await user(c)
  if (!canUpdateBankConfig(u)) throw new HttpError(403, 'Forbidden')
  const body = await c.req.json<{
    bankId?: string
    id?: string
    name?: string
    sourceQuery?: string
    tags?: string[]
    maxTokens?: number
    autoRefresh?: boolean
  }>()
  if (!body.bankId) throw new HttpError(400, 'bankId required')
  if (!body.name?.trim()) throw new HttpError(400, 'name required')
  if (!body.sourceQuery?.trim()) throw new HttpError(400, 'sourceQuery required')
  requireScope(u, body.bankId)
  return c.json(
    await createMentalModelForBank(body.bankId, body.name.trim(), body.sourceQuery.trim(), {
      id: body.id?.trim() || undefined,
      tags: body.tags,
      maxTokens: body.maxTokens,
      refreshAfterConsolidation: body.autoRefresh,
    })
  )
})

app.get('/api/mental-models/:mentalModelId', async (c) => {
  const u = await user(c)
  const bankId = c.req.query('bankId')
  const mentalModelId = c.req.param('mentalModelId')
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)
  return c.json(await getMentalModelForBank(bankId, mentalModelId))
})

app.patch('/api/mental-models/:mentalModelId', async (c) => {
  const u = await user(c)
  if (!canUpdateBankConfig(u)) throw new HttpError(403, 'Forbidden')
  const mentalModelId = c.req.param('mentalModelId')
  const body = await c.req.json<{
    bankId?: string
    name?: string
    sourceQuery?: string
    tags?: string[]
    maxTokens?: number
    autoRefresh?: boolean
  }>()
  if (!body.bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, body.bankId)
  return c.json(
    await updateMentalModelForBank(body.bankId, mentalModelId, {
      name: body.name,
      sourceQuery: body.sourceQuery,
      tags: body.tags,
      maxTokens: body.maxTokens,
      refreshAfterConsolidation: body.autoRefresh,
    })
  )
})

app.delete('/api/mental-models/:mentalModelId', async (c) => {
  const u = await user(c)
  if (!canUpdateBankConfig(u)) throw new HttpError(403, 'Forbidden')
  const bankId = c.req.query('bankId')
  const mentalModelId = c.req.param('mentalModelId')
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)
  await deleteMentalModelForBank(bankId, mentalModelId)
  return c.json({ ok: true })
})

app.post('/api/mental-models/:mentalModelId/refresh', async (c) => {
  const u = await user(c)
  if (!canUpdateBankConfig(u)) throw new HttpError(403, 'Forbidden')
  const mentalModelId = c.req.param('mentalModelId')
  const { bankId } = await c.req.json<{ bankId?: string }>()
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)
  return c.json(await refreshMentalModelForBank(bankId, mentalModelId))
})

app.post('/api/mental-models/:mentalModelId/clear', async (c) => {
  const u = await user(c)
  if (!canUpdateBankConfig(u)) throw new HttpError(403, 'Forbidden')
  const mentalModelId = c.req.param('mentalModelId')
  const { bankId } = await c.req.json<{ bankId?: string }>()
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)
  return c.json(await clearMentalModelForBank(bankId, mentalModelId))
})

app.post('/api/export', async (c) => {
  const u = await user(c)
  if (!canExportBank(u)) throw new HttpError(403, 'Forbidden')
  const { bankId } = await c.req.json<{ bankId?: string }>()
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)
  return c.json(await exportBank(bankId))
})

app.get('/api/entities', async (c) => {
  const u = await user(c)
  const bankId = c.req.query('bankId')
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)
  const limit = Math.min(Number(c.req.query('limit') || 50), 200)
  const offset = Number(c.req.query('offset') || 0)
  return c.json(await listEntitiesForBank(bankId, { limit, offset }))
})

app.get('/api/entities/:entityId', async (c) => {
  const u = await user(c)
  const bankId = c.req.query('bankId')
  const entityId = c.req.param('entityId')
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)
  const entity = await getEntityForBank(bankId, entityId)
  if (!entity) throw new HttpError(404, 'Entity not found')
  return c.json(entity)
})

app.post('/api/export-wiki', async (c) => {
  const u = await user(c)
  if (!canExportBank(u)) throw new HttpError(403, 'Forbidden')
  const { bankId, bankLabel } = await c.req.json<{
    bankId?: string
    bankLabel?: string
  }>()
  if (!bankId) throw new HttpError(400, 'bankId required')
  requireScope(u, bankId)
  return c.json(await buildWikiBundleForBank(bankId, bankLabel))
})

app.post('/api/upload', async (c) => {
  const u = await user(c)
  const form = await c.req.parseBody()
  const bankId = form.bankId as string | undefined
  const file = form.file
  if (!bankId || !file || !(file instanceof File)) {
    throw new HttpError(400, 'bankId and file required')
  }
  const scope = requireScope(u, bankId)
  const parser = (form.parser as string) || 'markitdown'
  const replaceDocumentId = (form.documentId as string) || undefined
  await ensureTeamBankForUser(u, bankId)
  return c.json(
    await uploadFiles(bankId, [file], u, scope, {
      parser,
      documentIds: replaceDocumentId ? [replaceDocumentId] : undefined,
      sourceType: (form.sourceType as string) || undefined,
      meetingName: (form.meetingName as string) || undefined,
      ticketId: (form.ticketId as string) || undefined,
      sourceDate: (form.sourceDate as string) || undefined,
      scenarioId: (form.scenarioId as string) || undefined,
      retainStrategy: (form.retainStrategy as string) || undefined,
    })
  )
})

const port = Number(process.env.PORT || 8000)
console.log(`→ API http://localhost:${port}`)
serve({ fetch: app.fetch, port })
