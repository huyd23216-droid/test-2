// Service worker: giúp app mở được khi không có mạng.
// - Trang (index.html): lấy từ mạng trước, mất mạng thì dùng bản đã lưu.
// - File /assets/* (có mã hash, không bao giờ đổi): lấy từ bộ nhớ đệm trước.
// - Không đụng tới request tới Supabase, YouTube, YouGlish…
// - Nhận thông báo đẩy "nhắc học" (nếu bạn bật trong Cài đặt).
const CACHE = 'app-shell-v1'
const STATIC = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']

// Lưu index.html mới và các file mà nó dùng, xóa file của bản cũ
async function refreshShell(response) {
  const cache = await caches.open(CACHE)
  const html = await response.clone().text()
  const assets = [...new Set(html.match(/\/assets\/[^"'\s)]+/g) ?? [])]
  await cache.put('/', response.clone())
  await Promise.all(
    assets.map(async (path) => {
      if (!(await cache.match(path))) {
        try {
          await cache.add(path)
        } catch {
          // bỏ qua, sẽ lưu khi tải lần sau
        }
      }
    }),
  )
  const keep = new Set(assets)
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname
    if (path.startsWith('/assets/') && !keep.has(path)) await cache.delete(req)
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      await cache.addAll(STATIC.slice(1)).catch(() => {})
      const res = await fetch('/', { cache: 'no-cache' })
      if (res.ok) await refreshShell(res)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req)
          if (res.ok) event.waitUntil(refreshShell(res.clone()))
          return res
        } catch {
          return (await caches.match('/')) ?? Response.error()
        }
      })(),
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || STATIC.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req)
        if (cached) return cached
        const res = await fetch(req)
        if (res.ok) {
          const cache = await caches.open(CACHE)
          cache.put(req, res.clone())
        }
        return res
      })(),
    )
  }
})

// ---------- Nhắc học ----------
self.addEventListener('push', (event) => {
  let data
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Tiếng Anh Mỗi Ngày', {
      body: data.body || 'Dành 10 phút cho tiếng Anh hôm nay nhé 🌱',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'study-reminder',
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (existing) {
        await existing.focus()
        return existing.navigate(target)
      }
      return self.clients.openWindow(target)
    })(),
  )
})
