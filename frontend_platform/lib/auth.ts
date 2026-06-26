export * from '../../shared/lib/auth'
export { verifySession } from '../../shared/lib/auth'

import { cookies } from 'next/headers'
import { verifySession, type PortalUser } from '../../shared/lib/auth'

export async function getCurrentUser(): Promise<PortalUser | null> {
  const token = cookies().get('portal-session')?.value
  if (!token) return null
  return verifySession(token)
}
