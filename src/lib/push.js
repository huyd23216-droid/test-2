// Đăng ký nhận thông báo nhắc học (Web Push) trên thiết bị này.
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

export function pushSupport() {
  if (typeof window === 'undefined') return { ok: false, reason: 'unsupported' }
  const hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'not-configured' }
  if (ios && !standalone) return { ok: false, reason: 'ios-install' }
  if (!hasApi) return { ok: false, reason: 'unsupported' }
  if (!import.meta.env.PROD) return { ok: false, reason: 'dev' }
  return { ok: true }
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

// Trả về { endpoint, p256dh, auth } hoặc ném lỗi (vd bị từ chối quyền)
export async function subscribePush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('denied')
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))
  const json = sub.toJSON()
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }
}

export async function unsubscribePush() {
  const sub = await currentSubscription()
  if (!sub) return null
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  return endpoint
}
