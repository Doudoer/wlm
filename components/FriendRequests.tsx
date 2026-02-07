'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function FriendRequests() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/friend-requests/incoming', { credentials: 'include' })
      const json = await res.json()
      setRequests(json.requests || [])
    } catch (e) {
      // ignore
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    let sub: any = null
    let mounted = true
    async function init() {
      try {
        // fetch me to know recipient id
  const meRes = await fetch('/api/me', { credentials: 'include' })
        const meJson = await meRes.json()
        const myId = meJson.user?.id
        if (!myId) return

        // subscribe to inserts and deletes on friend_requests for this recipient
        sub = supabase
          .channel('public:friend_requests')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `recipient_id=eq.${myId}` }, (payload) => {
            if (!mounted) return
            // prepend new request
            setRequests((r) => [payload.new, ...r])
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'friend_requests', filter: `recipient_id=eq.${myId}` }, (payload) => {
            if (!mounted) return
            setRequests((r) => r.filter(rr => rr.id !== payload.old.id))
          })
          .subscribe()
      } catch (e) {
        // ignore
      }
    }
    init()
    // Poll less frequently and avoid polling when tab hidden
    const POLL_MS = 15000
    const iv = setInterval(() => { if (!document.hidden) load() }, POLL_MS)
    const onVis = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { mounted = false; clearInterval(iv); document.removeEventListener('visibilitychange', onVis); if (sub) supabase.removeChannel(sub) }
  }, [])

  async function respond(id: string, accept: boolean) {
    try {
      const path = `/api/friend-requests/${id}/${accept ? 'accept' : 'reject'}`
  const res = await fetch(path, { method: 'POST', credentials: 'include' })
      if (res.ok) {
        // optimistic: remove the request locally
        setRequests((r) => r.filter(rr => rr.id !== id))

        // try to read returned friend data, if any
        let friendData = null
        try {
          const j = await res.json()
          friendData = j.addedFriend || null
        } catch (e) {
          // ignore parse errors
        }

        // notify other parts of the app so they can refresh their friend list
        try {
          window.dispatchEvent(new CustomEvent('friend-accepted', { detail: { requestId: id, friend: friendData } }))
        } catch (e) {}

        if (accept) {
          setToast('Solicitud aceptada')
          setTimeout(() => setToast(null), 2500)
        } else {
          setToast('Solicitud rechazada')
          setTimeout(() => setToast(null), 1800)
        }
      }
    } catch (e) {}
  }

  if (loading) return <div className="p-3">Cargando...</div>
  if (requests.length === 0) return <div className="p-3 text-sm text-neutral-500">No tienes solicitudes</div>

  return (
    <div className="p-3 space-y-3">
      {toast && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-black/90 text-white px-4 py-2 rounded shadow-md text-sm z-50">{toast}</div>
      )}
      {requests.map((r) => (
        <div key={r.id} className="flex items-center gap-3 p-2 border rounded">
          {r.usuarios?.avatar_url ? <img src={r.usuarios.avatar_url} className="w-12 h-12 rounded-full" loading="lazy" /> : <div className="w-12 h-12 rounded-full bg-primary-200 flex items-center justify-center">{(r.usuarios?.nombre||'U').charAt(0)}</div>}
          <div className="flex-1">
            <div className="font-medium">{r.usuarios?.nombre}</div>
            {/* codigo_acceso hidden for privacy */}
          </div>
          <div className="flex gap-2">
            <button onClick={() => respond(r.id, true)} className="px-3 py-1 bg-green-600 text-white rounded">Aceptar</button>
            <button onClick={() => respond(r.id, false)} className="px-3 py-1 border rounded">Rechazar</button>
          </div>
        </div>
      ))}
    </div>
  )
}
