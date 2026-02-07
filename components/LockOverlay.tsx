'use client'
import { useEffect, useState } from 'react'

export default function LockOverlay() {
  const [locked, setLocked] = useState<boolean>(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    let hasLock = false
    async function check() {
      try {
        // get user lock configuration and state
        const res = await fetch('/api/me', { credentials: 'include' })
        const json = await res.json()
        if (!mounted) return
        hasLock = !!json.user?.has_lock
        if (res.ok && json.user?.app_locked) setLocked(true)
        // if user has lock enabled, attach visibility/blur listeners to auto-lock
        if (hasLock) {
          const lockNow = async () => {
            try {
              await fetch('/api/lock', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } })
              window.dispatchEvent(new Event('app-locked'))
            } catch (e) {}
          }
          const onVis = () => { if (document.hidden) lockNow() }
          const onBlur = () => lockNow()
          window.addEventListener('visibilitychange', onVis)
          window.addEventListener('blur', onBlur)
          // clean up when unmounting
          const cleanup = () => { window.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onBlur) }
          // register cleanup to run on unmount
          ;(check as any)._cleanup = cleanup
        }
      } catch (e) {}
    }
    check()
    const onLocked = () => setLocked(true)
    const onUnlocked = () => setLocked(false)
    window.addEventListener('app-locked', onLocked)
    window.addEventListener('app-unlocked', onUnlocked)
    return () => {
      mounted = false
      window.removeEventListener('app-locked', onLocked)
      window.removeEventListener('app-unlocked', onUnlocked)
      try { (check as any)._cleanup && (check as any)._cleanup() } catch (e) {}
    }
  }, [])

  async function unlock(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/unlock', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      const json = await res.json()
      setLoading(false)
      if (!res.ok) return setError(json.error || 'Unlock failed')
      // reflect DB state
      window.dispatchEvent(new Event('app-unlocked'))
      setPassword('')
      setLocked(false)
    } catch (e) {
      setLoading(false)
      setError('Network error')
    }
  }

  if (!locked) return null

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md" role="dialog" aria-modal="true">
        <h3 className="text-lg font-semibold mb-3">Aplicación bloqueada</h3>
        <p className="text-sm text-neutral-600 mb-4">Introduce tu contraseña para desbloquear la app.</p>
        <form onSubmit={unlock} className="flex flex-col gap-3">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="p-3 border rounded" />
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div>
            <button type="submit" disabled={loading} className="w-full py-2 bg-primary-500 text-white rounded">{loading ? 'Desbloqueando...' : 'Desbloquear'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
