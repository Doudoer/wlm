'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import MessageInput from './MessageInput'

export default function ChatWindow({ activeFriend }: { activeFriend: any }) {
  const [messages, setMessages] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [friendOnline, setFriendOnline] = useState<boolean>(false)
  const endRef = useRef<HTMLDivElement | null>(null)
  const prevCountRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    async function loadMe() {
      const res = await fetch('/api/me', { credentials: 'include' })
      const json = await res.json()
      setMe(json.user)
    }
    loadMe()
  }, [])

  // presence: track this user's presence and listen for others
  const presenceChannelRef = useRef<any>(null)
  const activeFriendRef = useRef<string | null>(null)
  useEffect(() => {
    if (!me) return
    let mounted = true
    const channel = supabase.channel('presence')
    presenceChannelRef.current = channel

    async function init() {
      try {
        await channel.subscribe()
        // track this connection with our user id and current active chat
        try { await channel.track({ userId: me.id, activeChatWith: activeFriend?.id || null }) } catch (e) {}
        // helper to check presence state for the activeFriend (with logs)
        const checkPresence = () => {
          try {
            const state: any = (channel as any).presenceState && (channel as any).presenceState()
            console.log('[presence] presenceState', state)
            const friendId = activeFriendRef.current
            if (!friendId) { setFriendOnline(false); return }
            let online = false
            for (const key in state || {}) {
              const metas = state[key] || []
              for (const m of metas) {
                // metas shape may vary; check common fields
                if (m && (m.userId === friendId || m.user_id === friendId || m.user_id === friendId)) {
                  online = true
                  break
                }
              }
              if (online) break
            }
            console.log('[presence] computed online for', friendId, online)
            setFriendOnline(Boolean(online))
          } catch (e) { console.log('[presence] checkPresence error', e) }
        }

        channel.on('presence', { event: 'sync' }, () => { if (mounted) checkPresence() })
        channel.on('presence', { event: 'join' }, () => { if (mounted) checkPresence() })
        channel.on('presence', { event: 'leave' }, () => { if (mounted) checkPresence() })
      } catch (e) {
        console.log('[presence] subscribe error', e)
        // ignore subscribe errors
      }
    }
    init()

    return () => {
      mounted = false
      try { channel.untrack() } catch (e) {}
      try { supabase.removeChannel(channel) } catch (e) {}
      presenceChannelRef.current = null
    }
  }, [me])

  // update tracked activeFriend ref and activeChatWith on channel when activeFriend changes
  useEffect(() => {
    activeFriendRef.current = activeFriend?.id || null
    const ch = presenceChannelRef.current
    if (ch && me) {
      try { ch.track({ userId: me.id, activeChatWith: activeFriend?.id || null }) } catch (e) {}
    }
  }, [activeFriend, me])

  // Heartbeat presence: POST to /api/presence every 10s with activeChatWith
  useEffect(() => {
    if (!me) return
    let mounted = true
    async function sendHeartbeat() {
      try {
        await fetch('/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ activeChatWith: activeFriend?.id || null }) })
      } catch (e) {}
    }
    // initial heartbeat
    sendHeartbeat()
    const iv = setInterval(() => { if (mounted) sendHeartbeat() }, 10000)
    return () => { mounted = false; clearInterval(iv) }
  }, [me, activeFriend])

  // Poll presence of activeFriend every 5s and set friendOnline accordingly (heartbeat-based)
  useEffect(() => {
    if (!activeFriend) return
    let mounted = true
    async function checkFriend() {
      try {
        const res = await fetch(`/api/presence?user_id=${activeFriend.id}`)
        const j = await res.json()
        const p = j.presence
        if (!mounted) return
        if (!p || !p.last_seen) {
          setFriendOnline(false)
          return
        }
        // last_seen within last 30 seconds => online
        const last = new Date(p.last_seen).getTime()
        const now = Date.now()
        const online = (now - last) < 30000 || (p.active_chat_with && p.active_chat_with === me?.id)
        setFriendOnline(Boolean(online))
      } catch (e) {
        // ignore
      }
    }
    checkFriend()
    // Poll less aggressively and pause when tab is hidden to save resources
    const POLL_MS = 8000
    const iv = setInterval(() => { if (!document.hidden) checkFriend() }, POLL_MS)
    // also listen to visibilitychange to run an immediate check when tab becomes visible
    const onVis = () => { if (!document.hidden) checkFriend() }
    document.addEventListener('visibilitychange', onVis)
    return () => { mounted = false; clearInterval(iv); document.removeEventListener('visibilitychange', onVis) }
  }, [activeFriend, me])

  useEffect(() => {
    if (!activeFriend) return
    async function loadMessages() {
      const res = await fetch(`/api/messages?friendId=${activeFriend.id}`)
      const json = await res.json()
      setMessages(json.messages || [])
      scrollToBottom()
    }
    loadMessages()
  }, [activeFriend])

  // realtime subscription for new messages
  useEffect(() => {
    if (!me || !activeFriend) return
    let mounted = true
    const channels: any[] = []

    // Helper to create a channel with filter on a single column
    const makeChannel = (col: string, val: string) => {
      const name = `public:mensajes:${col}=${val}`
      const ch = supabase
        .channel(name)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `${col}=eq.${val}` }, (payload) => {
          if (!mounted) return
          console.log('[realtime mensajes] payload', payload)
          const m = payload.new
          // append if belongs to this conversation
          const isBetween = (m.remitente_id === me.id && m.recipient_id === activeFriend.id) ||
                            (m.remitente_id === activeFriend.id && m.recipient_id === me.id)
          if (isBetween) {
            setMessages((s) => [...s, m])
            scrollToBottom()
          }
        })
      channels.push(ch)
      return ch.subscribe()
    }

    // Subscribe to messages where I'm the recipient (so I receive new messages sent to me)
    makeChannel('recipient_id', me.id)
    // Also subscribe to messages where I'm the sender to catch any inserts from other clients
    makeChannel('remitente_id', me.id)

    console.log('[realtime mensajes] subscribed channels for user', me.id)

    return () => { mounted = false; channels.forEach((c) => supabase.removeChannel(c)) }
  }, [me, activeFriend])

  // Polling fallback: fetch messages periodically and merge new ones (in case Realtime isn't delivering)
  useEffect(() => {
    if (!activeFriend) return
    let mounted = true
    // Poll less frequently and skip when tab is hidden
    const POLL_MS = 3000
    const iv = setInterval(async () => {
      if (document.hidden) return
      try {
        const res = await fetch(`/api/messages?friendId=${activeFriend.id}`, { credentials: 'include' })
        const json = await res.json()
        const fetched: any[] = json.messages || []
        if (!mounted) return
        // merge: append messages that are not already in state
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => String(m.id)))
          const toAdd = fetched.filter((m) => !ids.has(String(m.id)))
          if (toAdd.length === 0) return prev
          const combined = [...prev, ...toAdd]
          // ensure sorted by created_at ascending
          combined.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          return combined
        })
      } catch (e) {
        // ignore
      }
  }, POLL_MS)
    return () => { mounted = false; clearInterval(iv) }
  }, [activeFriend])

  // Auto-scroll when messages increase
  useEffect(() => {
    try {
      const prev = prevCountRef.current
      const curr = messages.length
      if (curr > prev) {
        // new messages appended -> scroll to bottom smoothly
        scrollToBottom()
      }
      prevCountRef.current = curr
    } catch (e) {
      // ignore
    }
  }, [messages])

  function scrollToBottom() {
    try {
      const el = containerRef.current
      if (!el) {
        // fallback to endRef
        requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }))
        return
      }
      // Use requestAnimationFrame to ensure layout is updated
      requestAnimationFrame(() => {
        try {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' as ScrollBehavior })
        } catch (e) {
          // fallback
          el.scrollTop = el.scrollHeight
        }
      })
    } catch (e) {}
  }

  async function handleSend(payload: any) {
    // Optimistic UI
    const optimistic = { ...payload, id: `temp-${Date.now()}`, created_at: new Date().toISOString(), remitente_id: me?.id }
    setMessages((s) => [...s, optimistic])
    try {
      const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      // Replace optimistic with real message when returned
      if (json.message) {
        setMessages((s) => s.map((m) => (m.id && m.id.toString().startsWith('temp-') ? json.message : m)))
      }
    } catch (err) {
      // leave optimistic or mark failed
    }
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  return (
    <div className="h-full flex flex-col">
      <header className="p-4 border-b bg-white">
        {activeFriend ? (
          <div className="flex items-center gap-3">
            {activeFriend.avatar_url ? (
              <img src={activeFriend.avatar_url} className="w-12 h-12 rounded-full" loading="lazy" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary-200 flex items-center justify-center text-primary-700">{(activeFriend.nombre || 'U').charAt(0)}</div>
            )}
            <div>
              <div className="font-semibold">{activeFriend.nombre}</div>
              <div className="text-sm text-neutral-500 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${friendOnline ? 'bg-green-500' : 'bg-red-500'}`} aria-hidden="true" />
                <span>{friendOnline ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-neutral-500">Selecciona un amigo para chatear</div>
        )}
      </header>

      <div ref={containerRef} className="flex-1 overflow-auto p-6 bg-[url('/pattern.svg')]">
        <div className="space-y-4">
          {messages.map((m) => {
            const mine = me && m.remitente_id === me.id
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`chat-bubble p-3 rounded-lg ${mine ? 'bg-primary-500 text-white' : 'bg-white text-neutral-900 shadow'}`}>
                  {(m.tipo === 'image' && m.url_adjunto) ? (
                    <img src={m.url_adjunto} className="max-w-xs rounded" loading="lazy" />
                  ) : m.tipo === 'sticker' && m.contenido ? (
                    <img src={m.contenido} className="max-w-xs rounded" loading="lazy" />
                  ) : (
                    <div>{m.contenido}</div>
                  )}
                  <div className="text-xs text-neutral-400 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>
      </div>

      <div className="p-4 border-t bg-white">
        <MessageInput activeFriend={activeFriend} onSend={handleSend} />
      </div>
    </div>
  )
}
