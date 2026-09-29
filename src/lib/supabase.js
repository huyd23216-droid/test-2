import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
// Publishable key (sb_publishable_...). Vẫn nhận tên cũ VITE_SUPABASE_ANON_KEY nếu bạn dùng anon key.
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)

// Lỗi đăng nhập Supabase trả về qua URL (vd link hết hạn), đọc 1 lần khi mở app
export const initialAuthError = readAuthErrorFromUrl()

// Lưu buổi học bằng keepalive để request vẫn được gửi xong khi đóng tab/tải lại
// trang. Chỉ dùng cho request nhỏ này (keepalive giới hạn dung lượng body).
function fetchWithKeepalive(input, init = {}) {
  const target = typeof input === 'string' ? input : input.url
  if (init.method === 'POST' && target.includes('/rest/v1/study_sessions')) {
    return fetch(input, { ...init, keepalive: true })
  }
  return fetch(input, init)
}

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      global: { fetch: fetchWithKeepalive },
      auth: {
        // "implicit": bấm link trong email ở thiết bị/trình duyệt nào thì đăng nhập
        // ở đó, không bắt buộc cùng trình duyệt đã yêu cầu link (tiện cho Mac + điện thoại).
        flowType: 'implicit',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

// Gửi upsert ngay lập tức bằng fetch keepalive, dùng token đang lưu trên máy.
// Dùng khi trang sắp đóng (không kịp chờ các bước bất đồng bộ của supabase-js).
export function beaconUpsert(table, row) {
  if (!isSupabaseConfigured) return false
  try {
    const storageKey = supabase.auth.storageKey ?? `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
    const token = JSON.parse(localStorage.getItem(storageKey) || 'null')?.access_token
    if (!token) return false
    fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(row),
    }).catch(() => {})
    return true
  } catch {
    return false
  }
}

function readAuthErrorFromUrl() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const search = new URLSearchParams(window.location.search)
  const code = params.get('error_code') || search.get('error_code')
  const error = params.get('error') || search.get('error')
  if (!code && !error) return null
  window.history.replaceState(null, '', window.location.pathname)
  if (code === 'otp_expired') {
    return 'Link đăng nhập đã hết hạn hoặc đã được dùng. Bạn gửi lại link mới nhé.'
  }
  return 'Đăng nhập chưa thành công. Bạn thử gửi lại link mới nhé.'
}
