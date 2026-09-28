import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import RateSelector from '../components/RateSelector.jsx'
import SpeakButton from '../components/SpeakButton.jsx'
import Icon from '../components/Icon.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { exportAllData } from '../lib/db.js'
import { getTheme, setTheme } from '../lib/theme.js'
import { todayString } from '../lib/dates.js'
import {
  getEnglishVoices,
  getPreferredVoiceURI,
  isSpeechSupported,
  setPreferredVoiceURI,
} from '../lib/tts.js'

const THEMES = [
  { id: 'system', label: 'Theo máy' },
  { id: 'light', label: 'Sáng' },
  { id: 'dark', label: 'Tối' },
]

function useVoices() {
  const [voices, setVoices] = useState(getEnglishVoices)
  useEffect(() => {
    if (!isSpeechSupported()) return
    const update = () => setVoices(getEnglishVoices())
    window.speechSynthesis.addEventListener?.('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', update)
  }, [])
  return voices
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { settings, updateSettings } = useData()
  const { showToast } = useToast()
  const voices = useVoices()
  const [voiceURI, setVoiceURI] = useState(getPreferredVoiceURI)
  const [theme, setThemeState] = useState(getTheme)
  const [exporting, setExporting] = useState(false)

  const newPerDay = settings.new_words_per_day
  const changeNewPerDay = (delta) => {
    const value = Math.min(30, Math.max(0, newPerDay + delta))
    if (value !== newPerDay) updateSettings({ new_words_per_day: value })
  }

  const exportData = async () => {
    setExporting(true)
    try {
      const data = await exportAllData(user)
      downloadJson(data, `tieng-anh-backup-${todayString()}.json`)
      showToast('Đã tạo file sao lưu.')
    } catch (err) {
      console.error(err)
      showToast('Chưa xuất được dữ liệu. Bạn kiểm tra kết nối mạng rồi thử lại nhé.', { tone: 'warn' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page">
      <PageHeader title="Cài đặt" />

      <section className="card settings-block">
        <h2>Giọng đọc</h2>
        <RateSelector
          label="Tốc độ mặc định"
          value={settings.tts_rate}
          onChange={(r) => updateSettings({ tts_rate: r })}
        />
        {isSpeechSupported() && voices.length > 0 && (
          <label className="field">
            <span>Giọng en-US trên thiết bị này</span>
            <select
              value={voiceURI}
              onChange={(e) => {
                setVoiceURI(e.target.value)
                setPreferredVoiceURI(e.target.value)
              }}
            >
              <option value="">Tự chọn giọng tốt nhất</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <SpeakButton text="What are you trying to prove?" rate={settings.tts_rate} label="Nghe thử" />
        {!isSpeechSupported() && (
          <p className="hint">Trình duyệt này chưa hỗ trợ đọc tiếng Anh. Bạn thử Safari hoặc Chrome nhé.</p>
        )}
      </section>

      <section className="card settings-block">
        <h2>Từ mới mỗi ngày</h2>
        <div className="stepper">
          <button type="button" className="icon-btn" onClick={() => changeNewPerDay(-1)} aria-label="Giảm">
            −
          </button>
          <span className="stepper-value" aria-live="polite">
            {newPerDay} từ
          </span>
          <button type="button" className="icon-btn" onClick={() => changeNewPerDay(1)} aria-label="Tăng">
            <Icon name="plus" size={20} />
          </button>
        </div>
        <p className="hint">Buổi học 10 phút sẽ lấy số từ mới này. Ít mà đều thì nhớ lâu hơn.</p>
      </section>

      <section className="card settings-block">
        <h2>Giao diện</h2>
        <div className="segmented segmented-block" role="group" aria-label="Giao diện">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={theme === t.id ? 'active' : ''}
              aria-pressed={theme === t.id}
              onClick={() => {
                setThemeState(t.id)
                setTheme(t.id)
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card settings-block">
        <h2>Dữ liệu của bạn</h2>
        <p className="hint">
          Tải về toàn bộ thẻ, tiến độ, lịch sử và clip dưới dạng file JSON để sao lưu.
        </p>
        <button type="button" className="btn btn-secondary btn-block" onClick={exportData} disabled={exporting}>
          <Icon name="download" size={20} /> {exporting ? 'Đang chuẩn bị…' : 'Xuất dữ liệu (JSON)'}
        </button>
      </section>

      <section className="card settings-block">
        <h2>Tài khoản</h2>
        <p className="muted">{user.email}</p>
        <button type="button" className="btn btn-ghost btn-block" onClick={signOut}>
          Đăng xuất
        </button>
      </section>
    </div>
  )
}
