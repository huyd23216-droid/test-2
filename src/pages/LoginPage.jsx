import { useState } from 'react'
import { supabase, initialAuthError } from '../lib/supabase.js'
import Icon from '../components/Icon.jsx'

function friendlyError(err) {
  const msg = err?.message ?? ''
  if (err?.status === 429 || /rate limit|too many/i.test(msg)) {
    return 'Bạn vừa gửi hơi nhiều lần. Đợi vài phút rồi thử lại nhé.'
  }
  if (/invalid.*email|email.*invalid/i.test(msg)) return 'Email chưa đúng định dạng, bạn kiểm tra lại giúp mình nhé.'
  if (/expired|invalid/i.test(msg)) return 'Mã chưa đúng hoặc đã hết hạn. Bạn thử lại hoặc gửi link mới nhé.'
  if (/signups not allowed/i.test(msg)) return 'Email này chưa có tài khoản trong app.'
  if (/fetch|network/i.test(msg)) return 'Không kết nối được máy chủ. Bạn kiểm tra mạng rồi thử lại nhé.'
  return 'Có lỗi xảy ra, bạn thử lại sau ít phút nhé.'
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialAuthError)

  const sendLink = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (err) setError(friendlyError(err))
    else setSent(true)
  }

  const verifyCode = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (err) setError(friendlyError(err))
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo" aria-hidden="true">
          <Icon name="leaf" size={34} />
        </div>
        <h1>Tiếng Anh Mỗi Ngày</h1>
        <p className="muted">Mỗi ngày 10 phút: từ vựng, nối âm và chép chính tả.</p>

        {!sent ? (
          <form onSubmit={sendLink} className="form">
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
              {busy ? 'Đang gửi…' : 'Gửi link đăng nhập'}
            </button>
            <p className="hint">Không cần mật khẩu: app gửi một link đăng nhập vào email của bạn.</p>
          </form>
        ) : (
          <div className="form">
            <div className="notice">
              <p>
                <strong>Đã gửi!</strong> Mở email <strong>{email}</strong> và bấm vào link đăng nhập.
              </p>
              <p className="hint">
                Bấm link trên thiết bị nào thì thiết bị đó sẽ đăng nhập. Nếu email có kèm mã số, bạn có thể nhập mã ở
                đây.
              </p>
            </div>
            <form onSubmit={verifyCode} className="form">
              <label className="field">
                <span>Mã trong email (nếu có)</span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6,10}"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </label>
              <button className="btn btn-secondary btn-block" disabled={busy || code.length < 6}>
                {busy ? 'Đang kiểm tra…' : 'Đăng nhập bằng mã'}
              </button>
            </form>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setSent(false)}>
              Dùng email khác / gửi lại
            </button>
          </div>
        )}

        {error && <p className="notice notice-warn">{error}</p>}
      </div>
    </div>
  )
}
