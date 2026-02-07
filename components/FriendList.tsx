"use client"
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AddFriendModal from './AddFriendModal'
import FriendRequests from './FriendRequests'
import ProfileForm from './ProfileForm'
import React from 'react'

export default function FriendList({ onSelect }: { onSelect: (f: any) => void }) {
  const [friends, setFriends] = useState<any[]>([])
  const [openAdd, setOpenAdd] = useState(false)
  const [showRequests, setShowRequests] = useState(false)
  const [incomingCount, setIncomingCount] = useState<number>(0)
  const [me, setMe] = useState<any>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isPwa, setIsPwa] = useState<boolean>(false)

  async function load() {
    const res = await fetch('/api/friends', { credentials: 'include' })
    const json = await res.json()
    setFriends(json.friends || [])
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    function onFriendAccepted(e: any) {
      try {
        const detail = e?.detail || {}
        const friend = detail.friend || null
        if (friend && friend.id) {
          // optimistic: prepend if not already in list
          setFriends((prev) => {
            if (prev.find((p) => p.id === friend.id)) return prev
            return [friend, ...prev]
          })
        } else {
          // fallback: reload full list
          load()
        }
      } catch (err) {
        load()
      }
    }
    window.addEventListener('friend-accepted', onFriendAccepted as EventListener)
    return () => window.removeEventListener('friend-accepted', onFriendAccepted as EventListener)
  }, [])
  useEffect(() => {
    let mounted = true
    async function loadCount() {
      try {
        const res = await fetch('/api/friend-requests/incoming', { credentials: 'include' })
        const json = await res.json()
        if (!mounted) return
        setIncomingCount((json.requests && json.requests.length) || 0)
      } catch (e) {}
    }
    loadCount()
    const iv = setInterval(loadCount, 8000)
    return () => { mounted = false; clearInterval(iv) }
  }, [])
  useEffect(() => {
    async function loadMe() {
      try {
        const res = await fetch('/api/me', { credentials: 'include' })
        const json = await res.json()
        setMe(json.user)
      } catch (e) {}
    }
    loadMe()
  }, [])

  // PWA install handling: capture beforeinstallprompt and detect standalone mode
  useEffect(() => {
    const onBefore = (e: any) => {
      try {
        e.preventDefault()
      } catch (err) {}
      setDeferredPrompt(e)
    }
    const onAppInstalled = () => {
      setDeferredPrompt(null)
      setIsPwa(true)
    }
    const detectStandalone = () => {
      const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
      const navStandalone = (navigator as any).standalone === true
      setIsPwa(Boolean(standalone || navStandalone))
    }
    window.addEventListener('beforeinstallprompt', onBefore)
    window.addEventListener('appinstalled', onAppInstalled)
    window.addEventListener('resize', detectStandalone)
    detectStandalone()
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore)
      window.removeEventListener('appinstalled', onAppInstalled)
      window.removeEventListener('resize', detectStandalone)
    }
  }, [])

  // install modal state for graceful fallback
  const [showInstallModal, setShowInstallModal] = useState(false)

  useEffect(() => {
    function onProfileUpdated(e: any) {
      try {
        const u = e?.detail?.user
        if (!u || !u.id) return
        // update our local `me` if it's the same user or if we don't have a `me` yet
        setMe((prev: any) => {
          if (!prev) return u
          if (prev.id === u.id) return u
          return prev
        })
      } catch (e) {}
    }
    window.addEventListener('profile-updated', onProfileUpdated as EventListener)
    return () => window.removeEventListener('profile-updated', onProfileUpdated as EventListener)
  }, [])

  // subscribe to amigos inserts so we get realtime updates when someone adds us
  useEffect(() => {
    if (!me?.id) return
    let mounted = true
    const channel = supabase
      .channel('public:amigos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'amigos', filter: `user_id=eq.${me.id}` }, async (payload) => {
        if (!mounted) return
        try {
          const friendId = payload.new?.friend_id
          if (!friendId) return
          // fetch friend user details
          const r = await fetch(`/api/users/${friendId}`)
          const j = await r.json()
          const friend = j.user
          if (friend && friend.id) {
            setFriends((prev) => {
              if (prev.find((p) => p.id === friend.id)) return prev
              return [friend, ...prev]
            })
          }
        } catch (e) {
          // ignore
        }
      })
      .subscribe()

    return () => { mounted = false; if (channel) supabase.removeChannel(channel) }
  }, [me?.id])

  return (
    <div className="p-4">
      <div className="flex flex-col items-center mb-4">
        {/* Profile image at top */}
        {me ? (
          <div className="flex flex-col items-center">
            {me.avatar_url ? (
              <img src={me.avatar_url} className="w-20 h-20 rounded-full object-cover mb-2" loading="lazy" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary-200 mb-2 flex items-center justify-center text-primary-700 text-2xl">{(me.nombre || 'U').charAt(0)}</div>
            )}
            <div className="text-sm font-medium mb-2">{me.nombre}</div>
          </div>
        ) : null}

        {/* Actions: Solicitudes / Agregar / Copiar ID */}
        <div className="flex flex-col w-full items-stretch gap-2 mb-3">
          <button onClick={() => setShowRequests((s) => !s)} className="text-left px-3 py-2 rounded bg-neutral-50 hover:bg-neutral-100 flex items-center justify-between">
            <span>Solicitudes</span>
            {incomingCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold leading-none text-white bg-red-600 rounded-full">{incomingCount}</span>
            )}
          </button>
          <button onClick={() => setOpenAdd(true)} className="text-left px-3 py-2 rounded bg-neutral-50 hover:bg-neutral-100">Agregar</button>
          {me && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(me.id)
                  const el = document.getElementById('copy-id-msg')
                  if (el) {
                    el.textContent = 'Copiado'
                    setTimeout(() => { if (el) el.textContent = '' }, 1500)
                  }
                } catch (e) {
                  // fallback
                  const ta = document.createElement('textarea')
                  ta.value = me.id
                  document.body.appendChild(ta)
                  ta.select()
                  document.execCommand('copy')
                  document.body.removeChild(ta)
                  const el = document.getElementById('copy-id-msg')
                  if (el) {
                    el.textContent = 'Copiado'
                    setTimeout(() => { if (el) el.textContent = '' }, 1500)
                  }
                }
              }}
              className="text-left px-3 py-2 rounded bg-neutral-50 hover:bg-neutral-100 font-mono"
            >
              Copiar mi ID
            </button>
          )}
          <span id="copy-id-msg" className="text-xs text-green-600" aria-live="polite"></span>
        </div>
      </div>

      {/* Requests panel */}
      {showRequests && (
        <div className="mb-3">
          <FriendRequests />
        </div>
      )}

      {/* Friends header */}
      <h3 className="text-lg font-semibold mb-2">Amigos</h3>

      <ul>
            {friends.map((f) => (
                    <MemoFriendListItem key={f.id} f={f} onSelect={onSelect} />
                  ))}
      </ul>

      

      <AddFriendModal open={openAdd} onClose={() => setOpenAdd(false)} onRequested={() => load()} />
      {showProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">Editar perfil</h3>
            <ProfileForm onClose={() => setShowProfile(false)} />
          </div>
        </div>
      )}

      {/* bottom actions */}
      <div className="mt-6 pt-4 border-t flex flex-col gap-2">
        <button onClick={() => setShowProfile(true)} className="w-full text-left px-3 py-2 rounded bg-neutral-50 hover:bg-neutral-100">Editar perfil</button>
        <button
          onClick={async () => {
            try {
              if (isPwa) {
                // attempt to open in browser and close PWA window
                window.open(window.location.href, '_blank')
                try { window.close() } catch (e) {}
                return
              }
              if (deferredPrompt) {
                // show install prompt
                const promptEvent = deferredPrompt
                try {
                  promptEvent.prompt()
                  let choice: any = null
                  try { choice = await promptEvent.userChoice } catch (e) { choice = null }
                  // clear stored prompt regardless
                  setDeferredPrompt(null)
                  if (choice && choice.outcome === 'accepted') setIsPwa(true)
                } catch (e) {
                  setDeferredPrompt(null)
                }
                return
              }
              // fallback: open a friendly modal with instructions
              setShowInstallModal(true)
            } catch (e) {}
          }}
          className="w-full text-left px-3 py-2 rounded bg-neutral-50 hover:bg-neutral-100"
        >
          {isPwa ? 'Salir de PWA' : 'Instalar PWA'}
        </button>
          {/* Install fallback modal */}
          {showInstallModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black opacity-50" onClick={() => setShowInstallModal(false)} />
              <div className="bg-white rounded-lg p-6 w-full max-w-md z-60">
                <h3 className="text-lg font-semibold mb-2">Instalar la aplicación</h3>
                <p className="mb-3">Para instalar la PWA en tu dispositivo:</p>
                <ol className="list-decimal list-inside mb-3 text-sm">
                  <li>Abre el menú del navegador (⋮ o ⋯).</li>
                  <li>Selecciona "Instalar" o "Agregar a pantalla de inicio".</li>
                  <li>Sigue las instrucciones del sistema.</li>
                </ol>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowInstallModal(false)} className="px-3 py-2 rounded bg-neutral-100">Cerrar</button>
                </div>
              </div>
            </div>
          )}
        <button onClick={async () => {
            // Prompt for lock password (will be stored plaintext in DB) and call server to enable lock
            try {
              const p = window.prompt('Introduce la contraseña de bloqueo (se guardará en la base de datos)')
              if (p === null) return
              const res = await fetch('/api/lock', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lock_password: p }) })
              const json = await res.json()
              if (!res.ok) return alert(json.error || 'No se pudo bloquear')
              // notify UI to show overlay
              window.dispatchEvent(new Event('app-locked'))
            } catch (e) {
              // ignore
            }
          }}
          className="w-full text-left px-3 py-2 rounded bg-neutral-50 hover:bg-neutral-100">Bloquear app</button>
        <button type="button" className="w-full text-left px-3 py-2 rounded bg-neutral-50 hover:bg-neutral-100" onClick={async () => { await fetch('/api/logout', { method: 'POST' }); location.href = '/login' }}>Cerrar sesión</button>
      </div>
    </div>
  )
}

function FriendListItem({ f, onSelect }: { f: any; onSelect: (f: any) => void }) {
  return (
    <li className="flex items-center gap-3 p-2 rounded hover:bg-neutral-100 cursor-pointer" onClick={() => onSelect(f)}>
      {f.avatar_url ? (
        <img src={f.avatar_url} alt={f.nombre} className="w-10 h-10 rounded-full object-cover" loading="lazy" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-primary-200 flex items-center justify-center text-primary-700">{(f.nombre || 'U').charAt(0)}</div>
      )}
      <div>
        <div className="text-sm font-medium">{f.nombre}</div>
        {/* codigo_acceso intentionally hidden for privacy */}
      </div>
    </li>
  )
}

const MemoFriendListItem = React.memo(FriendListItem)
