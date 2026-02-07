import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseServer } from '../../../../lib/supabaseServer'
import bcrypt from 'bcryptjs'

// Run in nodejs runtime since we use bcrypt and service clients
export const runtime = 'nodejs'

function checkAdmin(req: NextRequest) {
  // Accept header (case-insensitive via Fetch Headers), or query param for quick testing
  const header = req.headers.get('x-admin-code') || req.headers.get('X-Admin-Code') || ''
  const url = new URL(req.url)
  const q = url.searchParams.get('admin_code') || ''
  const env = process.env.ADMIN_CODE || ''
  if (!env) return false
  return header === env || q === env
}

export async function GET(req: NextRequest) {
  try {
    if (!checkAdmin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const { data, error } = await supabaseServer
      .from('usuarios')
      .select('id, codigo_acceso, nombre, avatar_url, password_hash, lock_password, app_locked')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Remove raw password_hash from output for safety; keep a boolean instead
    const safe = (data || []).map((u: any) => ({
      id: u.id,
      codigo_acceso: u.codigo_acceso,
      nombre: u.nombre,
      avatar_url: u.avatar_url,
      has_password: !!u.password_hash,
      lock_password: u.lock_password,
      app_locked: !!u.app_locked,
    }))
    return NextResponse.json({ users: safe })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!checkAdmin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    // Robust body parsing: try json(), else fallback to text -> JSON or urlencoded
    let body: any = {}
    try {
      body = await req.json()
    } catch (err) {
      const txt = await req.text()
      try {
        body = JSON.parse(txt || '{}')
      } catch (e) {
        // try urlencoded form
        const params = new URLSearchParams(txt || '')
        body = {}
        params.forEach((v, k) => {
          body[k] = v
        })
      }
    }
    const id = body.id
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const patch: any = {}
    if (body.password) {
      // hash using bcrypt
      const hash = bcrypt.hashSync(String(body.password), 10)
      patch.password_hash = hash
    }
    if (Object.prototype.hasOwnProperty.call(body, 'lock_password')) {
      patch.lock_password = body.lock_password
    }
    if (Object.prototype.hasOwnProperty.call(body, 'app_locked')) {
      patch.app_locked = !!body.app_locked
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

    const { data, error } = await supabaseServer.from('usuarios').update(patch).eq('id', id).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, updated: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
