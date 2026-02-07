import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_FILE = /\.(.*)$/

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public files and api and _next
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || PUBLIC_FILE.test(pathname)) {
    return NextResponse.next()
  }

  // If user is not logged in, redirect to /login for protected routes
  const userId = req.cookies.get('user_id')?.value
  // Enforce inactivity logout: if last_seen cookie older than 1 hour, clear session
  try {
    const lastSeen = req.cookies.get('last_seen')?.value
    if (userId && lastSeen) {
      const last = new Date(lastSeen).getTime()
      if (Date.now() - last > 1000 * 60 * 60) {
        // expire cookie and redirect to login
        const url = req.nextUrl.clone()
        url.pathname = '/login'
        const res = NextResponse.redirect(url)
        res.cookies.set('user_id', '', { path: '/', maxAge: 0 })
        res.cookies.set('last_seen', '', { path: '/', maxAge: 0 })
        return res
      }
    }
  } catch (e) {}

  // Protect /chat and /profile; allow /login and root
  if (!userId && pathname !== '/login' && pathname !== '/') {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If logged in and at root or login, redirect to /chat
  if (userId && (pathname === '/' || pathname === '/login')) {
    const url = req.nextUrl.clone()
    url.pathname = '/chat'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/chat/:path*', '/profile/:path*', '/login', '/api/:path*']
}
