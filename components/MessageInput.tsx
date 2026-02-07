"use client"
import { useEffect, useRef, useState, Suspense } from 'react'
import dynamic from 'next/dynamic'

// emoji-picker-react is a client-only package; dynamically import to avoid SSR issues
const EmojiPicker = dynamic(() => import('emoji-picker-react').then((mod) => mod.default), { ssr: false })

export default function MessageInput({ activeFriend, onSend }: { activeFriend: any; onSend: (p: any) => void }) {
  const [text, setText] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [emojiQuery, setEmojiQuery] = useState('')
  const [emojis, setEmojis] = useState<any[]>([])
  const [loadingEmojis, setLoadingEmojis] = useState(false)
  const [pickerTab, setPickerTab] = useState<'emoji' | 'stickers'>('emoji')
  const [stickerQuery, setStickerQuery] = useState('')
  const [stickers, setStickers] = useState<any[]>([])
  const [loadingStickers, setLoadingStickers] = useState(false)
  const [stickerProvider, setStickerProvider] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const searchTimer = useRef<any>(null)
  const stickerTimer = useRef<any>(null)
  const fallbackStickers = [
    { id: 'fs-1', character: '🎉' },
    { id: 'fs-2', character: '😂' },
    { id: 'fs-3', character: '😎' },
    { id: 'fs-4', character: '🔥' },
    { id: 'fs-5', character: '😻' },
    { id: 'fs-6', character: '👍' },
    { id: 'fs-7', character: '👏' },
    { id: 'fs-8', character: '💯' }
  ]

  useEffect(() => {
    // fetch default small set of emojis (smile) when opening
    if (!showPicker) return
    fetchEmojis(emojiQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPicker])

  useEffect(() => {
    // debounce query
    if (!showPicker) return
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchEmojis(emojiQuery), 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emojiQuery])

  useEffect(() => {
    if (!showPicker || pickerTab !== 'stickers') return
    if (stickerTimer.current) clearTimeout(stickerTimer.current)
    stickerTimer.current = setTimeout(() => fetchStickers(stickerQuery), 300)
    return () => { if (stickerTimer.current) clearTimeout(stickerTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stickerQuery, pickerTab, showPicker])

  async function fetchEmojis(q: string) {
    setLoadingEmojis(true)
    try {
      const url = `/api/emoji?q=${encodeURIComponent(q || 'smile')}`
      const res = await fetch(url)
      const j = await res.json()
      setEmojis(j.emojis || [])
    } catch (e) {
      setEmojis([])
    }
    setLoadingEmojis(false)
  }

  async function fetchStickers(q: string) {
    setLoadingStickers(true)
    try {
      const url = `/api/giphy?type=sticker&q=${encodeURIComponent(q || 'funny')}&limit=30`
      const res = await fetch(url)
      const j = await res.json()
  setStickerProvider(j.provider || null)
  try { console.debug('[stickers] provider', j.provider, 'items', (j.items || []).length) } catch (e) {}
      setStickers(j.items || [])
    } catch (e) {
      setStickers([])
      setStickerProvider(null)
    }
    setLoadingStickers(false)
  }

  function insertAtCursor(value: string) {
    const el = textareaRef.current
    if (!el) return setText((t) => t + value)
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const before = el.value.substring(0, start)
    const after = el.value.substring(end)
    const next = before + value + after
    setText(next)
    // reposition caret after inserted emoji
    requestAnimationFrame(() => {
      try { el.selectionStart = el.selectionEnd = (before + value).length; el.focus() } catch (e) {}
    })
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!text.trim() || !activeFriend) return
    const payload = { recipient_id: activeFriend.id, contenido: text.trim(), tipo: 'text' }
    onSend(payload)
    setText('')
  }

  // send a sticker message (sends the sticker.url in contenido and tipo 'sticker')
  function sendSticker(st: any) {
    if (!activeFriend) return
    if (st?.url) {
      const payload = { recipient_id: activeFriend.id, contenido: st.url, tipo: 'sticker', meta: { title: st.title, preview: st.preview_url } }
      onSend(payload)
    } else if (st?.character) {
      // fallback: send as a text emoji if we don't have an image URL
      const payload = { recipient_id: activeFriend.id, contenido: st.character, tipo: 'text' }
      onSend(payload)
    }
    setShowPicker(false)
  }

  return (
    <div className="relative">
      <form onSubmit={submit} className="flex items-center gap-3">
        <textarea ref={textareaRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe un mensaje..." className="flex-1 p-3 border rounded resize-none h-12" />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setShowPicker((s) => !s); setPickerTab('emoji') }} className="p-2 rounded bg-neutral-100">😊</button>
          <button type="button" onClick={() => { setShowPicker((s) => !s); setPickerTab('stickers'); fetchStickers('funny') }} className="p-2 rounded bg-neutral-100">🎞️</button>
          <button type="submit" className="px-4 py-2 bg-primary-500 text-white rounded">Enviar</button>
        </div>
      </form>

      {showPicker && (
        <div className="absolute right-0 bottom-14 w-96 bg-white border rounded shadow p-2 z-50">
          <div className="flex gap-2 mb-2 items-center">
            <div className="flex items-center gap-1">
              <button className={`px-2 py-1 rounded ${pickerTab === 'emoji' ? 'bg-primary-100' : 'bg-neutral-100'}`} onClick={() => setPickerTab('emoji')}>Emoji</button>
              <button className={`px-2 py-1 rounded ${pickerTab === 'stickers' ? 'bg-primary-100' : 'bg-neutral-100'}`} onClick={() => { setPickerTab('stickers'); fetchStickers(stickerQuery || 'funny') }}>Stickers</button>
            </div>
            {pickerTab === 'emoji' ? (
              <>
                <input className="flex-1 p-2 border rounded" placeholder="Buscar emoji..." value={emojiQuery} onChange={(e) => setEmojiQuery(e.target.value)} />
                <button className="px-3 rounded bg-neutral-100" onClick={() => { setEmojiQuery(''); fetchEmojis('') }}>Reset</button>
              </>
            ) : (
              <>
                <input className="flex-1 p-2 border rounded" placeholder="Buscar stickers..." value={stickerQuery} onChange={(e) => setStickerQuery(e.target.value)} />
                <button className="px-3 rounded bg-neutral-100" onClick={() => { setStickerQuery(''); fetchStickers('funny') }}>Reset</button>
              </>
            )}
          </div>

          {pickerTab === 'emoji' ? (
            <div className="h-48 overflow-auto grid grid-cols-6 gap-2">
              {loadingEmojis ? <div className="col-span-6 text-sm text-neutral-500">Cargando...</div> : null}
              {!loadingEmojis && emojis.length === 0 && <div className="col-span-6 text-sm text-neutral-500">No se encontraron emojis</div>}
              {/* Small emoji list fetched from /api/emoji (search). Also expose a rich UI picker below via emoji-picker-react */}
              {emojis.map((em: any) => (
                <button key={em.slug} type="button" className="p-1 text-center" onClick={() => { insertAtCursor(em.character); setShowPicker(false) }} title={em.unicodeName}>
                  <div className="text-2xl">{em.character}</div>
                  <div className="text-xs text-neutral-500 truncate">{em.unicodeName}</div>
                </button>
              ))}
              {/* Embed emoji-picker-react as a larger single cell when available */}
              <div className="col-span-6">
                <Suspense fallback={<div className="text-sm text-neutral-500">Cargando selector...</div>}>
                  <EmojiPicker onEmojiClick={(emojiData: any) => { const ch = emojiData?.emoji || emojiData?.unified || ''; if (ch) insertAtCursor(ch) }} />
                </Suspense>
              </div>
            </div>
          ) : (
            <div className="h-48 overflow-auto grid grid-cols-6 gap-2">
              {loadingStickers ? <div className="col-span-6 text-sm text-neutral-500">Cargando stickers...</div> : null}
              {!loadingStickers && stickers.length === 0 && stickerProvider !== 'none' && <div className="col-span-6 text-sm text-neutral-500">No se encontraron stickers</div>}
              {stickerProvider === 'none' ? (
                // show simple emoji-as-sticker fallback when no provider is configured
                fallbackStickers.map((fs) => (
                  <button key={fs.id} type="button" className="p-1 text-center" onClick={() => sendSticker(fs)} title={fs.character}>
                    <div className="text-3xl">{fs.character}</div>
                  </button>
                ))
              ) : (
                stickers.map((st: any) => (
                  <button key={st.id} type="button" className="p-1 text-center" onClick={() => sendSticker(st)} title={st.title}>
                    <img src={st.preview_url || st.url} alt={st.title} className="w-full h-20 object-contain" loading="lazy" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
