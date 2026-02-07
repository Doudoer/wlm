import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseServer } from '../../../../lib/supabaseServer'
import bcrypt from 'bcryptjs'

// Run in nodejs runtime since we use bcrypt and service clients
export const runtime = 'nodejs'

function checkAdmin(req: NextRequest) {
  const header = req.headers.get('x-admin-code') || req.headers.get('X-Admin-Code')
  const env = process.env.ADMIN_CODE || ''
  if (!env) return false
  return header === env
}

export async function GET(req: NextRequest) {
  try {
    if (!checkAdmin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const { data, error } = await supabaseServer.from('usuarios').select('id, codigo_acceso, nombre, avatar_url, password_hash, lock_password, app_locked')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ users: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!checkAdmin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const body = await req.json()
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
