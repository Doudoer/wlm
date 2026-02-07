import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseServer } from '../../../lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    let body: any = {}
    try {
      const ct = req.headers.get?.('content-type')
      if (ct && ct.includes('application/json')) body = await req.json()
    } catch (e) {
      body = {}
    }
    const { codigo_acceso, password } = body
    if (!codigo_acceso) {
      return NextResponse.json({ error: 'codigo_acceso required' }, { status: 400 })
    }
    // Require password for login (use codigo_acceso as username/identifier)
    if (!password) return NextResponse.json({ error: 'password required' }, { status: 400 })

  console.log('[login] codigo_acceso received (raw):', codigo_acceso)
  console.log('[login] ENV NEXT_PUBLIC_SUPABASE_URL present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('[login] ENV SUPABASE_SERVICE_ROLE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
  console.log('[login] ENV NEXT_PUBLIC_SUPABASE_ANON_KEY present:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const codigo_trim = typeof codigo_acceso === 'string' ? codigo_acceso.trim() : codigo_acceso
    console.log('[login] codigo_acceso after trim:', codigo_trim)
    if (!codigo_trim) {
      return NextResponse.json({ error: 'codigo_acceso required' }, { status: 400 })
    }
    let user: any = null
    let error: any = null
    try {
      // if password provided, fetch password_hash as well for verification
      const cols = password ? 'id, nombre, avatar_url, codigo_acceso, password_hash' : 'id, nombre, avatar_url, codigo_acceso'
      const r = await supabaseServer
        .from('usuarios')
          // select only existing columns to avoid errors if schema differs
          .select(cols)
        .eq('codigo_acceso', codigo_trim)
        .maybeSingle()
      user = r.data
      error = r.error
      console.log('[login] supabase result (serviceRole), error:', error ? error.message : null, 'user:', user)
    } catch (e: any) {
      console.log('[login] supabase query threw exception (serviceRole):', e && e.message ? e.message : e)
      // Try fallback with anon key to distinguish service-role key problems vs connectivity
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        console.log('[login] trying fallback client with anon key present:', !!anon)
        if (url && anon) {
          const tmp = createClient(url, anon)
          const r2 = await tmp.from('usuarios').select('id, nombre, avatar_url, estado, codigo_acceso').eq('codigo_acceso', codigo_trim).maybeSingle()
          console.log('[login] fallback anon query result, error:', r2.error ? r2.error.message : null, 'user:', r2.data)
        }
      } catch (e2: any) {
        console.log('[login] fallback anon query threw:', e2 && e2.message ? e2.message : e2)
      }
    }

    if (error) {
      return NextResponse.json({ error: error.message || 'Invalid code' }, { status: 401 })
    }
    if (!user) {
      // Try case-insensitive match as fallback
      const { data: user2, error: err2 } = await supabaseServer
        .from('usuarios')
          .select('id, nombre, avatar_url, codigo_acceso')
        .ilike('codigo_acceso', codigo_trim)
        .maybeSingle()
      console.log('[login] fallback ilike result, error:', err2 ? err2.message : null, 'user2:', user2)
      if (err2 || !user2) return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
      // accept user2
      const res2 = NextResponse.json({ user: user2 })
      res2.cookies.set('user_id', user2.id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 })
      return res2
    }
    // If password was provided, verify against password_hash
    if (password) {
      const hash = user?.password_hash
      if (!hash) return NextResponse.json({ error: 'Password not set for this user' }, { status: 401 })
      const ok = bcrypt.compareSync(String(password), String(hash))
      if (!ok) return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const res = NextResponse.json({ user: { id: user.id, nombre: user.nombre, avatar_url: user.avatar_url, codigo_acceso: user.codigo_acceso } })
    // set simple cookie - NOTE: for production use a secure session strategy
    res.cookies.set('user_id', user.id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 })
    return res
  } catch (err) {
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

// Lightweight, opt-in diagnostic endpoint for production debugging.
// Use only with ?debug=1 (or set header X-Debug: 1). It returns booleans
// indicating which env vars are present. It never returns secret values.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const debug = url.searchParams.get('debug') === '1' || req.headers.get('x-debug') === '1'
    if (!debug) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    return NextResponse.json({
      has_NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      has_SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_DATABASE_URL: !!process.env.DATABASE_URL
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
