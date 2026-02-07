import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from './supabaseServer'

const ONE_HOUR_MS = 1000 * 60 * 60

export async function requireActiveUser(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const devId = url.searchParams.get('user_id') || ''
    const headerUser = req.headers.get('x-user-id') || ''
    const cookieUser = req.cookies.get('user_id')?.value || ''
    const userId = cookieUser || headerUser || devId
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    // check last_seen in user_presence
    const { data, error } = await supabaseServer
      .from('user_presence')
      .select('last_seen')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      // if DB error, return internal error
      return NextResponse.json({ error: error.message || 'internal' }, { status: 500 })
    }

    const lastSeen = data?.last_seen
    if (!lastSeen) {
      // no presence recorded -> treat as expired
      const res = NextResponse.json({ error: 'session_expired' }, { status: 401 })
      // clear cookie
      res.cookies.set('user_id', '', { path: '/', maxAge: 0 })
      return res
    }

    const last = new Date(lastSeen).getTime()
    const now = Date.now()
    if (now - last > ONE_HOUR_MS) {
      const res = NextResponse.json({ error: 'session_expired' }, { status: 401 })
      res.cookies.set('user_id', '', { path: '/', maxAge: 0 })
      return res
    }

    return { userId }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'internal' }, { status: 500 })
  }
}

export async function getUserIdIfPresent(req: NextRequest) {
  const url = new URL(req.url)
  return req.cookies.get('user_id')?.value || req.headers.get('x-user-id') || url.searchParams.get('user_id') || ''
}
