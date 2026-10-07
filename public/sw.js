// Service worker mínimo del demo: cache-first para el app shell.
// Solo se registra en builds de producción (ver main.jsx).
const CACHE = 'ea-cache-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/index.html', '/manifest.webmanifest', '/icon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copia = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copia))
        return res
      })
      .catch(() =>
        caches.match(e.request).then((r) => r || (e.request.mode === 'navigate' ? caches.match('/index.html') : undefined)),
      ),
  )
})
