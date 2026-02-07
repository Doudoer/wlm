/* Service Worker
   - Cache static assets (cache-first)
   - Stale-while-revalidate for API GETs
   - Queue failed POST requests to IndexedDB and replay on sync/message
*/

const STATIC_CACHE = 'chat-static-v1'
const API_CACHE = 'chat-api-v1'
const STATIC_URLS = ['/', '/manifest.json', '/icons/icon-192.svg', '/icons/icon-512.svg', '/sw.js']

// tiny idb helper for the outbox queue
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('pwa-queue', 1)
    req.onupgradeneeded = () => {
      try { req.result.createObjectStore('outbox', { autoIncrement: true }) } catch (_) {}
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function pushToOutbox(entry) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction('outbox', 'readwrite')
    tx.objectStore('outbox').add(entry)
    tx.oncomplete = () => res(true)
    tx.onerror = () => rej(tx.error)
  })
}

async function replayOutbox() {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction('outbox', 'readwrite')
    const store = tx.objectStore('outbox')
    const req = store.openCursor()
    req.onsuccess = async (e) => {
      const cursor = e.target.result
      if (!cursor) return resolve(true)
      const record = cursor.value
      try {
        const headers = new Headers(record.headers || {})
        const resp = await fetch(record.url, { method: record.method, headers, body: record.body })
        if (resp && resp.ok) {
          cursor.delete()
        }
      } catch (err) {
        // leave in queue
      }
      cursor.continue()
    }
    req.onerror = () => resolve(false)
  })
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_URLS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((k) => {
        if (![STATIC_CACHE, API_CACHE].includes(k)) return caches.delete(k)
      })
    ))
  )
  self.clients.claim()
})

// replay outbox on sync or message
self.addEventListener('sync', (event) => {
  if (event.tag === 'outbox') {
    event.waitUntil(replayOutbox())
  }
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REPLAY_OUTBOX') {
    event.waitUntil(replayOutbox())
  }
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Handle POST requests: try network, on failure queue them
  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    event.respondWith((async () => {
      try {
        const cloned = req.clone()
        const body = await cloned.text()
        const resp = await fetch(req)
        return resp
      } catch (err) {
        // offline: queue
        try {
          const headers = {}
          for (const [k, v] of req.headers.entries()) headers[k] = v
          await pushToOutbox({ url: req.url, method: req.method, headers, body: await req.clone().text() })
          // attempt to register a sync (best-effort)
          try {
            const sw = await self.registration.sync
            // some browsers do not allow calling sync.register from SW directly; client should register
          } catch (_) {}
        } catch (e) {
          // ignore queue errors
        }
        return new Response(JSON.stringify({ ok: false, offlineQueued: true }), { status: 503, headers: { 'Content-Type': 'application/json' } })
      }
    })())
    return
  }

  // API GETs: stale-while-revalidate
  if (req.method === 'GET' && url.pathname.startsWith('/api/')) {
    event.respondWith((async () => {
      const cache = await caches.open(API_CACHE)
      const cached = await cache.match(req)
      const network = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res }).catch(() => null)
      return cached || (await network) || new Response('{}', { status: 504 })
    })())
    return
  }

  // Static assets: cache-first
  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE)
    const cached = await cache.match(req)
    if (cached) return cached
    try {
      const res = await fetch(req)
      if (res && res.ok) cache.put(req, res.clone())
      return res
    } catch (e) {
      return cached || new Response('Offline', { status: 503 })
    }
  })())
})