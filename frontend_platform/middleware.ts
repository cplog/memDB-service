import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from './lib/auth'
import { AccessError, resolveMemoryScope } from './lib/memory-scope'
export async function middleware(request: NextRequest) {
 if (
   request.nextUrl.pathname === '/login' ||
   request.nextUrl.pathname === '/api/auth/login' ||
   request.nextUrl.pathname === '/api/auth/logout'
 ) {
   return NextResponse.next()
 }

  const isApi = request.nextUrl.pathname.startsWith('/api/')

  const token = request.cookies.get('portal-session')?.value
  if (!token) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const user = await verifySession(token)
  if (!user) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const bankMatch = request.nextUrl.pathname.match(/\/api\/banks\/([^/]+)/)
  if (bankMatch) {
    try {
      resolveMemoryScope(user, bankMatch[1])
    } catch (e) {
      if (e instanceof AccessError) {
        return NextResponse.json({ error: e.message }, { status: e.status })
      }
      throw e
    }
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', user.id)
  requestHeaders.set('x-user-role', user.role)
  requestHeaders.set('x-company-slug', user.companySlug)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
