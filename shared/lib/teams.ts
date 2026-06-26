import type { PortalUser } from './auth'

export interface TeamDef {
  id: string
  name: string
  label: string
}

/** ponytail: static org config until real tenant DB exists */
export const ORG_TEAMS: Record<string, TeamDef[]> = {
  ech: [
    { id: 'product', name: 'Product', label: 'Product' },
    { id: 'engineering', name: 'Engineering', label: 'Engineering' },
    { id: 'sales', name: 'Sales', label: 'Sales' },
    { id: 'ops', name: 'Ops', label: 'Ops' },
  ],
}

/** Per-company bank namespace — prevents cross-tenant id collisions. */
const COMPANY_BANK_NS: Record<string, string> = {
  ech: 'co-ech',
  acme: 'co-acme',
}

function envKeyForCompany(companySlug: string): string {
  return companySlug.toUpperCase().replace(/-/g, '_')
}

export function bankNamespaceForCompany(companySlug: string): string | null {
  const perCompany = process.env[
    `HINDSIGHT_BANK_NAMESPACE_${envKeyForCompany(companySlug)}`
  ]?.trim()
  if (perCompany) return perCompany
  if (COMPANY_BANK_NS[companySlug]) return COMPANY_BANK_NS[companySlug]
  // ponytail: legacy global env only for single-tenant ech deployments
  const legacyGlobal = process.env.HINDSIGHT_BANK_NAMESPACE?.trim()
  if (legacyGlobal && companySlug === 'ech') return legacyGlobal
  return null
}

/** Hindsight bank id for a team — co-ech-team-product in prod, team-product locally. */
export function teamBankId(teamId: string, companySlug = 'ech'): string {
  const ns = bankNamespaceForCompany(companySlug)
  if (ns) return `${ns}-team-${teamId}`
  return `team-${teamId}`
}

export function sharedBankId(companySlug: string): string | null {
  const perCompany = process.env[
    `HINDSIGHT_SHARED_BANK_${envKeyForCompany(companySlug)}`
  ]?.trim()
  if (perCompany) return perCompany
  const legacy = process.env.HINDSIGHT_SHARED_BANK?.trim()
  if (legacy && companySlug === 'ech') return legacy
  const ns = bankNamespaceForCompany(companySlug)
  return ns ? `${ns}-shared` : null
}

export function isSharedBank(bankId: string, companySlug: string): boolean {
  const shared = sharedBankId(companySlug)
  return Boolean(shared && bankId === shared)
}

/** Accept team-product and co-ech-team-product (and legacy co-ech-shared patterns). */
export function parseTeamBankId(bankId: string): string | null {
  const match = /^(?:[a-z0-9-]+-)?team-(.+)$/.exec(bankId)
  return match?.[1] ?? null
}

export function teamsForCompany(companySlug: string): TeamDef[] {
  return ORG_TEAMS[companySlug] ?? []
}

export function getAccessibleTeamIds(user: PortalUser): string[] {
  if (user.role === 'consultant' || user.role === 'manager') {
    return teamsForCompany(user.companySlug).map((t) => t.id)
  }
  return user.teamIds
}

export function getAccessibleTeams(user: PortalUser): TeamDef[] {
  const ids = new Set(getAccessibleTeamIds(user))
  return teamsForCompany(user.companySlug).filter((t) => ids.has(t.id))
}

export function getAccessibleBankIds(user: PortalUser): string[] {
  const banks = getAccessibleTeamIds(user).map((tid) =>
    teamBankId(tid, user.companySlug)
  )
  if (user.role === 'consultant' || user.role === 'manager') {
    const shared = sharedBankId(user.companySlug)
    if (shared) banks.push(shared)
  }
  return banks
}

/** Runnable check — node --import tsx shared/lib/teams.selfcheck.ts */
export function runTeamsSelfCheck(): void {
  if (teamBankId('product', 'ech') !== 'co-ech-team-product') {
    throw new Error('ech team bank id should be co-ech-team-product')
  }
  if (teamBankId('product', 'other') !== 'team-product') {
    throw new Error('unknown company should use team-* prefix')
  }
  if (parseTeamBankId('co-ech-team-sales') !== 'sales') {
    throw new Error('parseTeamBankId co-ech failed')
  }
  if (parseTeamBankId('team-product') !== 'product') {
    throw new Error('parseTeamBankId legacy failed')
  }
  if (sharedBankId('ech') !== 'co-ech-shared') {
    throw new Error('shared bank id failed')
  }
  if (teamBankId('product', 'acme') !== 'co-acme-team-product') {
    throw new Error('acme team bank id failed')
  }
  if (teamBankId('product', 'ech') === teamBankId('product', 'acme')) {
    throw new Error('bank ids must not collide across companies')
  }
  if (sharedBankId('ech') === sharedBankId('acme')) {
    throw new Error('shared bank ids must not collide across companies')
  }
}
