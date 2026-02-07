'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo_acceso: code, password }) })
      const json = await res.json()
      setLoading(false)
      if (!res.ok) return setError(json.error || 'Login failed')
      router.push('/chat')
    } catch (err) {
      setLoading(false)
      setError('Network error')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 to-white">
      <form onSubmit={submit} className="w-full max-w-md bg-white shadow-md rounded-lg p-8">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-4">Iniciar sesión</h1>
        <p className="text-sm text-neutral-500 mb-6">Introduce tu código de acceso para continuar.</p>
  <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de acceso" className="w-full p-3 border rounded-md mb-4" />
  <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" type="password" className="w-full p-3 border rounded-md mb-4" />
        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
        <button type="submit" className="w-full py-3 bg-primary-500 text-white rounded-md disabled:opacity-60" disabled={loading}>
          {loading ? 'Iniciando...' : 'Iniciar sesión'}
        </button>
      </form>
    </main>
  )
}
