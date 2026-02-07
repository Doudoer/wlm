'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ProfileForm({ onClose }: { onClose?: () => void }) {
  const [user, setUser] = useState<any>(null)
  const [name, setName] = useState('')
  const [codigo, setCodigo] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [lockEnabled, setLockEnabled] = useState(false)
  const [lockPassword, setLockPassword] = useState('')
  const [hasLock, setHasLock] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/me', { credentials: 'include' })
        const json = await res.json()
        setUser(json.user)
        setName(json.user?.nombre ?? '')
        setCodigo(json.user?.codigo_acceso ?? '')
        setAvatarUrl(json.user?.avatar_url ?? '')
        setLockEnabled(!!json.user?.app_locked)
        setHasLock(!!json.user?.has_lock)
        // don't populate lockPassword for security; user must enter new one if setting
      } catch (e) {}
    }
    load()
  }, [])

  async function uploadFileIfNeeded(): Promise<string | null> {
    if (!file || !user?.id) return null
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/avatar/upload', { method: 'POST', body: form, credentials: 'include' })
      const j = await res.json()
      if (!res.ok) {
        console.warn('[profile] upload error (server)', j)
        return null
      }
      if (j.url) return j.url
      return null
    } catch (e) {
      console.warn('[profile] upload exception', e)
      return null
    }
  }

  async function save(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setLoading(true)
    setMessage(null)
    // If user enabled lock but there's no configured lock and no password provided, warn
    if (lockEnabled && !lockPassword && !hasLock) {
      alert('Has activado el bloqueo de la app pero no has establecido una contraseña. Por favor introduce una contraseña de bloqueo.')
      setLoading(false)
      return
    }
    try {
      let finalAvatar = avatarUrl
      if (file) {
        const uploaded = await uploadFileIfNeeded()
        if (uploaded) finalAvatar = uploaded
      }

  const payload: any = { nombre: name, codigo_acceso: codigo }
      if (finalAvatar) payload.avatar_url = finalAvatar

      // include lock config if user toggled
      if (lockEnabled) {
        // set lock password if provided
        if (lockPassword) payload.lock_password = lockPassword
        payload.app_locked = true
      } else {
        // user disabled lock; clear flag and optionally clear password
        payload.app_locked = false
        if (lockPassword === '') {
          // explicit empty means clear stored lock_password
          payload.lock_password = ''
        }
      }

  // If password fields provided, call set-password endpoint after saving profile
  const shouldSetPassword = newPassword && confirmPassword && newPassword === confirmPassword

      const res = await fetch('/api/me/update', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json()
      if (!res.ok) {
        setMessage(j?.error || 'Error saving')
        setLoading(false)
        return
      }
      // if password requested, set it via API
      if (shouldSetPassword) {
        try {
          const r2 = await fetch('/api/set-password', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: newPassword }) })
          const j2 = await r2.json()
          if (!r2.ok) {
            console.warn('set-password failed', j2)
            setMessage('Perfil guardado, pero hubo un error al cambiar la contraseña')
          } else {
            setMessage('Guardado y contraseña actualizada')
          }
        } catch (e) {
          console.warn('set-password exception', e)
          setMessage('Perfil guardado, pero error al cambiar contraseña')
        }
      }
      setMessage('Guardado')
      // update local UI with returned user
      if (j.user) {
        setUser(j.user)
        const originalUrl = j.user.avatar_url ?? finalAvatar
        const cb = (u: string | null | undefined) => u ? `${u}${u.includes('?') ? '&' : '?'}t=${Date.now()}` : u
        const busted = cb(originalUrl)
        setAvatarUrl(busted)
        // attach cache-busted url to the user object we emit so sidebar updates immediately
        try { j.user = { ...j.user, avatar_url: busted } } catch (e) {}
      } else {
        // fallback in case server returned no user
        const cb = (u: string | null | undefined) => u ? `${u}${u.includes('?') ? '&' : '?'}t=${Date.now()}` : u
        setAvatarUrl(cb(finalAvatar))
      }
      // notify others with the possibly cache-busted avatar_url
      try { window.dispatchEvent(new CustomEvent('profile-updated', { detail: { user: j.user } })) } catch (e) {}
      setTimeout(() => {
        setLoading(false)
        if (onClose) onClose()
      }, 600)
    } catch (err) {
      setMessage('Error')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded" />
      </div>

      <div>
        <label className="block text-sm font-medium">Código de acceso</label>
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className="w-full p-2 border rounded font-mono" />
      </div>

      <div>
        <label className="block text-sm font-medium">Cambiar contraseña</label>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nueva contraseña" className="w-full p-2 border rounded mt-1" />
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar contraseña" className="w-full p-2 border rounded mt-2" />
        <div className="text-xs text-neutral-500 mt-1">Dejar vacío para conservar la contraseña actual.</div>
      </div>

      <div>
        <label className="block text-sm font-medium">Bloqueo de la app</label>
        <div className="flex items-center gap-2 mt-1">
          <input id="lockEnabled" type="checkbox" checked={lockEnabled} onChange={(e) => setLockEnabled(e.target.checked)} />
          <label htmlFor="lockEnabled" className="text-sm">Activar bloqueo de la app</label>
        </div>
        <div className="mt-2">
          <input type="text" value={lockPassword} onChange={(e) => setLockPassword(e.target.value)} placeholder="Contraseña de bloqueo (texto plano)" className="w-full p-2 border rounded" />
          <div className="text-xs text-neutral-500 mt-1">Si activas el bloqueo, introduce la contraseña que se usará para desbloquear la app. Se almacenará en texto plano en la base de datos.</div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Imagen de perfil (archivo)</label>
        <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0] ?? null) }} />
        <div className="text-sm text-neutral-500 mt-2">O pega una URL pública abajo</div>
        <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className="w-full p-2 border rounded mt-2" />
  {avatarUrl ? <img src={avatarUrl} className="w-20 h-20 rounded-full object-cover mt-2" loading="lazy" /> : null}
      </div>

      {message && <div className="text-sm text-green-600">{message}</div>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading} className="px-4 py-2 bg-primary-500 text-white rounded">{loading ? 'Guardando...' : 'Guardar'}</button>
        <button type="button" className="px-4 py-2 border rounded" onClick={async () => { await fetch('/api/logout', { method: 'POST' }); location.href = '/login' }}>Cerrar sesión</button>
        <button type="button" className="px-4 py-2 border rounded" onClick={() => { if (onClose) onClose() }}>Cancelar</button>
      </div>
    </form>
  )
}
