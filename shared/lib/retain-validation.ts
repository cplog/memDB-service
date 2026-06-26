import type { PortalUser } from './auth'
import type { MemoryScope } from './memory-scope'
import { documentIdFromTitle } from './document-display'
import { appendScenarioTag, normalizeScenarioId } from './scenario'

/** Shown after retain/upload while async indexing runs. */
export const RETAIN_PROCESSING_HINT =
  'Processing — searchable in a few minutes.'

export class RetainValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RetainValidationError'
  }
}

export type RetainSourceType =
  | 'meeting'
  | 'email'
  | 'ticket'
  | 'doc'
  | 'chat'
  | 'other'

export interface RetainRequestBody {
  content: string
  context?: string
  documentId?: string
  /** Title or slug for new documents (required when documentId absent). */
  sessionId?: string
  classification?: 'public' | 'internal' | 'confidential'
  scope?: 'private' | 'shared'
  metadata?: Record<string, string>
  updateMode?: 'replace' | 'append'
  sourceType?: RetainSourceType | string
  meetingName?: string
  ticketId?: string
  /** ISO date or YYYY-MM-DD when the source event occurred. */
  sourceDate?: string
  /** Slug id for scenario tagging — writes scenario:{id} tag. */
  scenarioId?: string
  /** Named retain strategy from bank retain_strategies map. */
  retainStrategy?: string
}

export function parseSourceDate(raw?: string): Date | undefined {
  if (!raw?.trim()) return undefined
  const d = new Date(raw.trim())
  return Number.isNaN(d.getTime()) ? undefined : d
}

export function buildRetainContext(
  userName: string,
  userRole: string,
  body: RetainRequestBody
): string {
  if (body.context?.trim()) return body.context.trim()
  const parts: string[] = []
  if (body.sourceType) parts.push(`Source: ${body.sourceType}`)
  if (body.meetingName?.trim()) parts.push(`Meeting: ${body.meetingName.trim()}`)
  if (body.ticketId?.trim()) parts.push(`Ticket: ${body.ticketId.trim()}`)
  if (parts.length) return parts.join(' · ')
  return `Portal retain — ${userName} (${userRole})`
}

/** ponytail: per_tag scopes observation consolidation to tag boundaries (private vs shared). */
export function observationScopesForRetain(
  scope: 'private' | 'shared' | undefined
): 'per_tag' | 'combined' {
  return scope === 'shared' ? 'combined' : 'per_tag'
}

export function validateRetainBody(body: RetainRequestBody): void {
  if (body.documentId?.trim()) return
  if (!body.sessionId?.trim()) {
    throw new RetainValidationError(
      'Title or slug required for new documents'
    )
  }
}

export function buildRetainOptions(
  user: PortalUser,
  scope: MemoryScope,
  body: RetainRequestBody
) {
  validateRetainBody(body)

  const existingDoc = body.documentId?.trim()
  const title = body.sessionId?.trim()
  const documentId = existingDoc ?? documentIdFromTitle(title!)

  const tags = appendScenarioTag(
    [
      ...scope.tags,
      body.scope === 'shared' ? 'scope:shared' : 'scope:private',
    ],
    body.scenarioId
  )

  const metadata: Record<string, string> = {
    source_company: user.companySlug,
    source_team: scope.teamId,
    source_user: user.email,
    data_classification: body.classification ?? 'internal',
    consultant_visible: user.role === 'consultant' ? 'true' : 'false',
    retained_by: user.id,
    engagement_phase: 'active',
    ...body.metadata,
  }
  if (body.sourceType) metadata.source_type = body.sourceType
  if (body.meetingName?.trim()) metadata.meeting_name = body.meetingName.trim()
  if (body.ticketId?.trim()) metadata.ticket_id = body.ticketId.trim()
  const sourceDate = parseSourceDate(body.sourceDate)
  if (sourceDate) metadata.source_date = sourceDate.toISOString()
  const scenario = normalizeScenarioId(body.scenarioId)
  if (scenario) metadata.scenario_id = scenario

  return {
    context: buildRetainContext(user.name, user.role, body),
    timestamp: sourceDate ?? new Date(),
    documentId,
    tags,
    metadata,
    async: true,
    observationScopes: observationScopesForRetain(body.scope),
    retainStrategy: body.retainStrategy?.trim() || undefined,
  }
}

export function runRetainValidationSelfCheck(): void {
  validateRetainBody({ content: 'x', sessionId: 'my-note' })
  try {
    validateRetainBody({ content: 'x' })
    throw new Error('expected validation error')
  } catch (e) {
    if (!(e instanceof RetainValidationError)) throw e
  }
  const user = {
    id: 'u1',
    name: 'Test',
    email: 't@ech.com',
    role: 'member' as const,
    companySlug: 'ech',
    teamIds: ['product'],
  }
  const memScope = {
    bankId: 'team-product',
    teamId: 'product',
    tags: ['team:product'],
    tagsMatch: 'all_strict' as const,
  }
  const opts = buildRetainOptions(user, memScope, {
    content: 'Alice decided X',
    sessionId: 'Q3 Planning',
    sourceType: 'meeting',
    meetingName: 'Q3 planning',
    ticketId: 'ENG-42',
    sourceDate: '2024-03-15',
  })
  if (opts.documentId !== 'Q3 Planning') {
    throw new Error('retain validation: slug id failed')
  }
  if (!opts.context.includes('ENG-42')) {
    throw new Error('retain validation: context failed')
  }
  if (opts.metadata.ticket_id !== 'ENG-42') {
    throw new Error('retain validation: metadata failed')
  }
  if (opts.observationScopes !== 'per_tag') {
    throw new Error('retain validation: observation scope failed')
  }
  const sharedOpts = buildRetainOptions(user, memScope, {
    content: 'Shared fact',
    sessionId: 'team-update',
    scope: 'shared',
  })
  if (sharedOpts.observationScopes !== 'combined') {
    throw new Error('retain validation: shared scope failed')
  }
  const scenarioOpts = buildRetainOptions(user, memScope, {
    content: 'Renewal risk',
    sessionId: 'renewal-note',
    scenarioId: 'megacorp-renewal',
  })
  if (!scenarioOpts.tags.includes('scenario:megacorp-renewal')) {
    throw new Error('retain validation: scenario tag failed')
  }
}
