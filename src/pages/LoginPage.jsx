import { useState } from 'react'
import { supabase, initialAuthError } from '../lib/supabase.js'
import Icon from '../components/Icon.jsx'

// Vào web bằng email có trong danh sách cho phép (bảng allowed_emails trên Supabase).
// Edge Function "email-login" kiểm tra email và trả về phiên đăng nhập, không gửi email.
const LAST_EMAIL_KEY = 'last-login-email'

function readLastEmail() {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) || ''
  } catch {
    return ''
  }
}

function saveLastEmail(email) {
  try {
    localStorage.setItem(LAST_EMAIL_KEY, email)
  } catch {
    // bỏ qua
  }
}

function friendlyError(err) {
  if (err?.name === 'FunctionsHttpError') {
    const status = err.context?.status
    if (status === 403) return 'Email này chưa được mở quyền vào web. Bạn kiểm tra lại email giúp mình nhé.'
    if (status === 400) return 'Bạn nhập email giúp mình nhé.'
  }
  if (err?.name === 'FunctionsFetchError' || /fetch|network/i.test(err?.message ?? '')) {
    return 'Không kết nối được máy chủ. Bạn kiểm tra mạng rồi thử lại nhé.'
  }
  return 'Có lỗi xảy ra, bạn thử lại sau ít phút nhé.'
}

export default function LoginPage() {
  const [email, setEmail] = useState(readLastEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialAuthError)

  const signIn = async (e) => {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    setBusy(true)
    setError(null)
    const { data, error: err } = await supabase.functions.invoke('email-login', { body: { email: value } })
    if (err || !data?.access_token) {
      setBusy(false)
      setError(friendlyError(err))
      return
    }
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    })
    if (sessionError) {
      setBusy(false)
      setError(friendlyError(sessionError))
      return
    }
    // Đăng nhập xong, AuthContext tự chuyển vào app
    saveLastEmail(value)
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo" aria-hidden="true">
          <Icon name="leaf" size={34} />
        </div>
        <h1>Tiếng Anh Mỗi Ngày</h1>
        <p className="muted">Mỗi ngày 10 phút: từ vựng, nối âm và chép chính tả.</p>

        <form onSubmit={signIn} className="form">
          <label className="field">
            <span>Email của bạn</span>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="ban@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Đang vào…' : 'Vào học'}
          </button>
          <p className="hint">Nhập đúng email đã được mở quyền là vào ngay, không cần mật khẩu hay link.</p>
        </form>

        {error && <p className="notice notice-warn">{error}</p>}
      </div>
    </div>
  )
}
