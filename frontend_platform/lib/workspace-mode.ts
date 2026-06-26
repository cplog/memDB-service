/** Visual + copy mode derived from portal role. */
export type WorkspaceMode = 'workspace' | 'overview' | 'operations'

export function workspaceMode(role: string): WorkspaceMode {
  if (role === 'consultant') return 'operations'
  if (role === 'manager') return 'overview'
  return 'workspace'
}

export function roleLabel(role: string): string {
  if (role === 'consultant') return 'Consultant'
  if (role === 'manager') return 'Manager'
  return 'Team member'
}

export const MODE_META: Record<
  WorkspaceMode,
  { title: string; scopeLine: string; sidebarLabel: string; opsScopeLine: string }
> = {
  workspace: {
    title: 'Team workspace',
    scopeLine: 'Your notes and uploads in this team. Query results include only what you contributed.',
    sidebarLabel: 'Your team',
    opsScopeLine: '',
  },
  overview: {
    title: 'Team overview',
    scopeLine: 'Everything shared with this team bank. Query spans all members on the team.',
    sidebarLabel: 'All teams',
    opsScopeLine: '',
  },
  operations: {
    title: 'Engagement operations',
    scopeLine: 'Work across all client teams. Recall and reflect use team-wide scope.',
    sidebarLabel: 'Banks',
    opsScopeLine:
      'Configure extraction, playbooks, exports, and bank health for the active team.',
  },
}

export const OPS_VIEWS = new Set(['stats', 'config', 'export'])

export function isOpsView(view: string): boolean {
  return OPS_VIEWS.has(view)
}
