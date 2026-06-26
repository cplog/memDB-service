import type { PortalUser } from './auth'
import { getAccessibleTeamIds, isSharedBank, parseTeamBankId, teamBankId } from './teams'
import { appendScenarioTag, normalizeScenarioId } from './scenario'

export type TagsMatch = 'any_strict' | 'all_strict'

export interface MemoryScope {
  bankId: string
  teamId: string
  tags: string[]
  tagsMatch: TagsMatch
}

export class AccessError extends Error {
  status = 403

  constructor(message: string) {
    super(message)
    this.name = 'AccessError'
  }
}

export function buildScope(user: PortalUser, teamId: string): MemoryScope {
  const wideAccess = user.role === 'consultant' || user.role === 'manager'
  return {
    bankId: teamBankId(teamId, user.companySlug),
    teamId,
    tags: wideAccess ? [`team:${teamId}`] : [`user:${user.id}`, `team:${teamId}`],
    tagsMatch: wideAccess ? 'any_strict' : 'all_strict',
  }
}

function buildSharedScope(user: PortalUser, bankId: string): MemoryScope {
  return {
    bankId,
    teamId: 'shared',
    tags: [`company:${user.companySlug}`],
    tagsMatch: 'any_strict',
  }
}

export function resolveMemoryScope(
  user: PortalUser,
  bankId: string
): MemoryScope {
  if (isSharedBank(bankId, user.companySlug)) {
    if (user.role !== 'consultant' && user.role !== 'manager') {
      throw new AccessError('Forbidden: shared bank access denied')
    }
    return buildSharedScope(user, bankId)
  }
  const teamId = parseTeamBankId(bankId)
  if (!teamId) {
    throw new AccessError('Invalid bank: expected team-{teamId}')
  }
  if (!getAccessibleTeamIds(user).includes(teamId)) {
    throw new AccessError('Forbidden: team bank access denied')
  }
  return buildScope(user, teamId)
}

export function resolveMemoryScopeByTeam(
  user: PortalUser,
  teamId: string
): MemoryScope {
  if (!getAccessibleTeamIds(user).includes(teamId)) {
    throw new AccessError('Forbidden: team access denied')
  }
  return buildScope(user, teamId)
}

/** Apply optional scenario filter for recall/reflect — strict when scenario is set. */
export function scopeTagsForQuery(
  scope: MemoryScope,
  scenarioId?: string | null
): { tags: string[]; tagsMatch: TagsMatch } {
  const sid = normalizeScenarioId(scenarioId)
  if (!sid) return { tags: scope.tags, tagsMatch: scope.tagsMatch }
  return {
    tags: appendScenarioTag(scope.tags, sid),
    tagsMatch: 'all_strict',
  }
}

/** Runnable self-check — node --test shared/lib/memory-scope.test.mjs */
export function runMemoryScopeSelfCheck(): void {
  const alice: PortalUser = {
    id: 'alice',
    email: 'alice@ech.com',
    name: 'Alice',
    role: 'member',
    companySlug: 'ech',
    teamIds: ['product'],
  }
  const eric: PortalUser = {
    id: 'eric',
    email: 'eric@consultant.com',
    name: 'Eric',
    role: 'consultant',
    companySlug: 'ech',
    teamIds: [],
  }

  const aliceScope = resolveMemoryScope(alice, 'team-product')
  if (aliceScope.tagsMatch !== 'all_strict') {
    throw new Error('member should use all_strict')
  }

  try {
    resolveMemoryScope(alice, 'team-engineering')
    throw new Error('alice should not access engineering bank')
  } catch (e) {
    if (!(e instanceof AccessError)) throw e
  }

  resolveMemoryScope(eric, 'team-engineering')
  resolveMemoryScope(eric, 'co-ech-team-engineering')
  const ericScope = buildScope(eric, 'sales')
  if (ericScope.tagsMatch !== 'any_strict') {
    throw new Error('consultant should use any_strict')
  }

  const withScenario = scopeTagsForQuery(aliceScope, 'megacorp-renewal')
  if (!withScenario.tags.includes('scenario:megacorp-renewal')) {
    throw new Error('scenario filter tag failed')
  }
  if (withScenario.tagsMatch !== 'all_strict') {
    throw new Error('scenario filter should use all_strict')
  }
}
