import { NextResponse } from 'next/server'
import { getCurrentUser, type PortalUser } from './auth'
import { AccessError, resolveMemoryScope, type MemoryScope } from './memory-scope'

export async function requireUser(): Promise<PortalUser | NextResponse> {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return user
}

export function requireScope(
  user: PortalUser,
  bankId: string
): MemoryScope | NextResponse {
  try {
    return resolveMemoryScope(user, bankId)
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse
}
