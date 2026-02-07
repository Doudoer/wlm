"use client"
import { useEffect, useState } from 'react'

export default function AdminPage() {
  const [code, setCode] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // try to read saved code from sessionStorage
    const s = typeof window !== 'undefined' ? window.sessionStorage.getItem('admin_code') : null
    if (s) setCode(s)
  }, [])

  async function tryAuth(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setError(null)
    try {
      const res = await fetch('/api/admin/users', { headers: { 'X-Admin-Code': code } })
      if (res.status === 200) {
        setAuthed(true)
        try { window.sessionStorage.setItem('admin_code', code) } catch {}
      } else if (res.status === 403) {
        setError('Código de administración inválido')
      } else {
        setError('Error al verificar (status ' + res.status + ')')
      }
    } catch (err) {
      setError('Network error')
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-lg mx-auto bg-white rounded shadow p-6">
          <h1 className="text-xl font-semibold mb-4">Panel de administración</h1>
          <form onSubmit={tryAuth}>
            <label className="block text-sm mb-2">Código de acceso administrador</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full p-3 border rounded mb-4" />
            {error && <div className="text-red-600 mb-2">{error}</div>}
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-primary-600 text-white rounded" type="submit">Entrar</button>
            </div>
          </form>
          <p className="text-xs text-neutral-500 mt-4">Este panel requiere un código administrativo. No subir el código al repositorio; configúralo como variable de entorno `ADMIN_CODE` en Vercel.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Administrador de usuarios</h1>
        <AdminUsers code={code} />
      </div>
    </main>
  )
}

function AdminUsers({ code }: { code: string }) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', { headers: { 'X-Admin-Code': code } })
      if (!res.ok) throw new Error('status ' + res.status)
      const json = await res.json()
      setUsers(json.users || [])
    } catch (e: any) {
      setError(String(e.message || e))
    } finally { setLoading(false) }
  }

  async function updateUser(id: string, patch: any) {
    try {
      const res = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Admin-Code': code }, body: JSON.stringify({ id, ...patch }) })
      if (!res.ok) throw new Error('status ' + res.status)
      await fetchUsers()
    } catch (e: any) {
      alert('Error: ' + (e.message || e))
    }
  }

  return (
    <div>
      {loading && <div>Cargando usuarios...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && !error && (
        <div className="space-y-3">
          {users.map((u) => (
            <UserRow key={u.id} user={u} onSave={(patch: any) => updateUser(u.id, patch)} />
          ))}
        </div>
      )}
    </div>
  )
}

function UserRow({ user, onSave }: { user: any, onSave: (p: any) => void }) {
  const [editing, setEditing] = useState(false)
  const [password, setPassword] = useState('')
  const [lockPassword, setLockPassword] = useState(user.lock_password || '')
  const [appLocked, setAppLocked] = useState(!!user.app_locked)

  return (
    <div className="p-4 border rounded flex items-start gap-4">
      <div className="flex-1">
        <div className="flex justify-between">
          <div>
            <div className="font-medium">{user.nombre || '(sin nombre)'} <span className="text-xs text-neutral-500">{user.codigo_acceso}</span></div>
            <div className="text-xs text-neutral-500">id: {user.id}</div>
          </div>
          <div>
            <button onClick={() => setEditing(!editing)} className="px-3 py-1 border rounded">{editing ? 'Cancelar' : 'Editar'}</button>
          </div>
        </div>
        {editing && (
          <div className="mt-3 space-y-2">
            <div>
              <label className="block text-xs">Nueva contraseña (plain, será hasheada)</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs">Código de bloqueo (lock_password)</label>
              <input value={lockPassword} onChange={(e) => setLockPassword(e.target.value)} className="w-full p-2 border rounded" />
            </div>
            <div className="flex items-center gap-2">
              <input id={`locked-${user.id}`} type="checkbox" checked={appLocked} onChange={(e) => setAppLocked(e.target.checked)} />
              <label htmlFor={`locked-${user.id}`} className="text-sm">App locked</label>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => onSave({ password: password || undefined, lock_password: lockPassword || null, app_locked: appLocked })}>Guardar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
