import { getHindsightClient, updateBankConfig } from './hindsight'
import type { PortalUser } from './auth'
import { parseTeamBankId, teamBankId, teamsForCompany, type TeamDef } from './teams'

export interface EntityLabelGroup {
  key: string
  description: string
  type: 'value' | 'multi-values' | 'text'
  optional?: boolean
  values?: Array<{ value: string; description: string }>
}

export interface TeamBankProfile {
  retainMission: string
  reflectMission: string
  observationsMission: string
  entityLabels?: EntityLabelGroup[]
  retainDefaultStrategy?: string
  retainStrategies?: Record<string, Record<string, unknown>>
}

/** Domain-specific bank tuning — set before heavy ingestion. */
export const TEAM_BANK_PROFILES: Record<string, TeamBankProfile> = {
  product: {
    retainMission:
      'Extract product decisions, roadmap changes, customer feedback, and UX insights. Ignore standup filler and scheduling.',
    reflectMission:
      'Summarize product direction, open decisions, and customer-facing risks for the Product team.',
    observationsMission:
      'Track recurring product themes, conflicting priorities, and customer patterns.',
    retainDefaultStrategy: 'meetings',
    retainStrategies: {
      meetings: { retain_extraction_mode: 'concise' },
      uploads: { retain_extraction_mode: 'verbose' },
    },
    entityLabels: [
      {
        key: 'content_kind',
        description: 'Kind of product knowledge',
        type: 'value',
        values: [
          { value: 'decision', description: 'A decision that was made' },
          { value: 'risk', description: 'A product or delivery risk' },
          { value: 'feedback', description: 'Customer or user feedback' },
        ],
      },
      {
        key: 'audience',
        description: 'Who the knowledge is about',
        type: 'value',
        values: [
          { value: 'internal', description: 'Internal team only' },
          { value: 'client', description: 'External client or account' },
        ],
      },
    ],
  },
  engineering: {
    retainMission:
      'Extract technical decisions, architecture choices, incidents, and ownership. Ignore merge noise and CI chatter.',
    reflectMission:
      'Summarize system state, technical debt, and engineering blockers for the Engineering team.',
    observationsMission:
      'Track recurring incidents, architecture patterns, and ownership gaps.',
    retainDefaultStrategy: 'incidents',
    retainStrategies: {
      incidents: { retain_extraction_mode: 'verbose' },
      uploads: { retain_extraction_mode: 'concise' },
    },
    entityLabels: [
      {
        key: 'system_area',
        description: 'Area of the system',
        type: 'value',
        values: [
          { value: 'backend', description: 'APIs and services' },
          { value: 'frontend', description: 'Portal and UI' },
          { value: 'infra', description: 'Deployment and platform' },
        ],
      },
      {
        key: 'record_kind',
        description: 'Type of engineering record',
        type: 'value',
        values: [
          { value: 'incident', description: 'Outage or bug response' },
          { value: 'design', description: 'Design or RFC decision' },
          { value: 'procedure', description: 'Runbook or operational procedure' },
        ],
      },
    ],
  },
  sales: {
    retainMission:
      'Extract deal progress, objections, account context, and next steps. Ignore generic CRM status noise.',
    reflectMission:
      'Summarize pipeline risks, account status, and commitments for the Sales team.',
    observationsMission:
      'Track recurring objections, account patterns, and deal-stage friction.',
    entityLabels: [
      {
        key: 'deal_stage',
        description: 'Sales stage context',
        type: 'value',
        values: [
          { value: 'prospect', description: 'Early prospecting' },
          { value: 'active', description: 'Active opportunity' },
          { value: 'closed', description: 'Closed won or lost' },
        ],
      },
    ],
  },
  ops: {
    retainMission:
      'Extract operational procedures, policy decisions, vendor issues, and compliance notes. Ignore admin scheduling.',
    reflectMission:
      'Summarize operational risks, policy gaps, and vendor dependencies for Ops.',
    observationsMission:
      'Track recurring process issues and policy contradictions.',
    entityLabels: [
      {
        key: 'record_kind',
        description: 'Operations record type',
        type: 'value',
        values: [
          { value: 'procedure', description: 'Standard operating procedure' },
          { value: 'policy', description: 'Policy or compliance rule' },
          { value: 'vendor', description: 'Vendor or supplier matter' },
        ],
      },
    ],
  },
}

export function teamBankProfile(teamId: string): TeamBankProfile {
  return (
    TEAM_BANK_PROFILES[teamId] ?? {
      retainMission: `Extract durable facts for the ${teamId} team. Ignore greetings and filler.`,
      reflectMission: `Summarize ${teamId} team knowledge — decisions, blockers, and ownership.`,
      observationsMission: 'Track recurring patterns and contradictions for this team only.',
    }
  )
}

export async function ensureTeamBank(team: TeamDef, companySlug: string) {
  const client = getHindsightClient()
  const bankId = teamBankId(team.id, companySlug)
  const profile = teamBankProfile(team.id)

  await client.createBank(bankId, {
    reflectMission: profile.reflectMission,
    retainMission: profile.retainMission,
    observationsMission: profile.observationsMission,
    retainExtractionMode: 'concise',
    dispositionSkepticism: 3,
    dispositionLiteralism: 4,
    dispositionEmpathy: 3,
    enableObservations: true,
  })

  if (profile.entityLabels?.length || profile.retainStrategies) {
    await updateBankConfig(bankId, {
      ...(profile.entityLabels?.length
        ? { entity_labels: profile.entityLabels, entities_allow_free_form: true }
        : {}),
      ...(profile.retainDefaultStrategy
        ? { retain_default_strategy: profile.retainDefaultStrategy }
        : {}),
      ...(profile.retainStrategies
        ? { retain_strategies: profile.retainStrategies }
        : {}),
    })
  }
}

/** Create Hindsight bank row if missing — upload/retain require FK on banks table */
export async function ensureTeamBankForUser(
  user: PortalUser,
  bankId: string
): Promise<void> {
  const teamId = parseTeamBankId(bankId)
  if (!teamId) return
  const team = teamsForCompany(user.companySlug).find((t) => t.id === teamId)
  if (!team) return
  await ensureTeamBank(team, user.companySlug)
}

export function runTeamBanksSelfCheck(): void {
  const product = teamBankProfile('product')
  if (!product.retainMission.includes('product')) {
    throw new Error('team bank profile product failed')
  }
  if (!TEAM_BANK_PROFILES.engineering?.entityLabels?.length) {
    throw new Error('team bank entity labels failed')
  }
  if (!TEAM_BANK_PROFILES.product?.retainStrategies?.meetings) {
    throw new Error('team bank retain strategies failed')
  }
}
