'use client'
import { useState } from 'react'

export default function AddFriendModal({ open, onClose, onRequested }: { open: boolean; onClose: () => void; onRequested?: () => void }) {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    // Search by user id
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(code)}`)
      const json = await res.json()
      if (res.ok && json.user) setResult(json.user)
      else setError('Usuario no encontrado')
    } catch (e) {
      setError('Search failed')
    }
    setLoading(false)
  }

  async function sendRequest() {
    if (!result) return
    setLoading(true)
    try {
      const res = await fetch('/api/friend-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient_id: result.id }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'error')
      onRequested && onRequested()
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Request failed')
    }
    setLoading(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-2">Agregar amigo</h3>
  <p className="text-sm text-neutral-500 mb-4">Busca por ID de usuario (UUID)</p>
        <div className="flex gap-2 mb-3">
          <input value={code} onChange={(e) => setCode(e.target.value)} className="flex-1 p-2 border rounded" />
          <button onClick={search} className="px-4 py-2 bg-primary-500 text-white rounded">Buscar</button>
        </div>
        {loading && <div className="text-sm text-neutral-500">Buscando...</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {result && (
          <div className="mt-3 p-3 border rounded flex items-center gap-3">
            {result.avatar_url ? <img src={result.avatar_url} className="w-12 h-12 rounded-full" loading="lazy" /> : <div className="w-12 h-12 rounded-full bg-primary-200 flex items-center justify-center">{(result.nombre||'U').charAt(0)}</div>}
            <div className="flex-1">
              <div className="font-medium">{result.nombre}</div>
              {/* hide codigo_acceso for privacy */}
            </div>
            <div>
              <button onClick={sendRequest} className="px-3 py-1 bg-primary-500 text-white rounded">Solicitar</button>
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
