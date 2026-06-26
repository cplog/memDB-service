import { verifySession, type PortalUser } from './auth'
import { AccessError, resolveMemoryScope, type MemoryScope } from './memory-scope'

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export async function requireUser(token: string | undefined): Promise<PortalUser> {
  if (!token) throw new HttpError(401, 'Unauthorized')
  const user = await verifySession(token)
  if (!user) throw new HttpError(401, 'Unauthorized')
  return user
}

export function requireScope(user: PortalUser, bankId: string): MemoryScope {
  try {
    return resolveMemoryScope(user, bankId)
  } catch (e) {
    if (e instanceof AccessError) throw new HttpError(e.status, e.message)
    throw e
  }
}
