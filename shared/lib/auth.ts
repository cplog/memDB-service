import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hindsight-portal-secret-key-change-in-production'
)

export type PortalRole = 'consultant' | 'manager' | 'member'

export interface PortalUser {
  id: string
  email: string
  name: string
  role: PortalRole
  companySlug: string
  teamIds: string[]
}

const DEMO_USERS: PortalUser[] = [
  {
    id: 'eric',
    email: 'eric@consultant.com',
    name: 'Eric Tai',
    role: 'consultant',
    companySlug: 'ech',
    teamIds: [],
  },
  {
    id: 'alice',
    email: 'alice@ech.com',
    name: 'Alice Chen',
    role: 'member',
    companySlug: 'ech',
    teamIds: ['product'],
  },
  {
    id: 'bob',
    email: 'bob@ech.com',
    name: 'Bob Smith',
    role: 'member',
    companySlug: 'ech',
    teamIds: ['engineering'],
  },
  {
    id: 'carol',
    email: 'carol@ech.com',
    name: 'Carol Lee',
    role: 'manager',
    companySlug: 'ech',
    teamIds: [],
  },
]

export async function createSession(user: PortalUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET)
}

export async function verifySession(token: string): Promise<PortalUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { clockTolerance: 60 })
    return payload as unknown as PortalUser
  } catch {
    return null
  }
}

export function getUserByEmail(email: string): PortalUser | null {
  return DEMO_USERS.find((u) => u.email === email) ?? null
}

export function canManageBanks(user: PortalUser): boolean {
  return user.role === 'consultant'
}

export function canExportBank(user: PortalUser): boolean {
  return user.role === 'consultant'
}

export function canUpdateBankConfig(user: PortalUser): boolean {
  return user.role === 'consultant'
}
