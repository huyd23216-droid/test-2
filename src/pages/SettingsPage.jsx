import { useEffect, useRef, useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import RateSelector from '../components/RateSelector.jsx'
import SpeakButton from '../components/SpeakButton.jsx'
import Icon from '../components/Icon.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { exportAllData, restoreData } from '../lib/db.js'
import { prepareRestore, summarizeBackup, validateBackup } from '../lib/backup.js'
import { getTheme, setTheme } from '../lib/theme.js'
import { todayString } from '../lib/dates.js'
import { RETENTION_OPTIONS } from '../config.js'
import {
  ACCENTS,
  getPreferredVoiceURI,
  getVoices,
  isSpeechSupported,
  setDefaultAccent,
  setPreferredVoiceURI,
} from '../lib/tts.js'

const ACCENT_OPTIONS = [
  { id: 'us', label: 'Mỹ' },
  { id: 'uk', label: 'Anh' },
  { id: 'mixed', label: 'Xen kẽ' },
]

const THEMES = [
  { id: 'system', label: 'Theo máy' },
  { id: 'light', label: 'Sáng' },
  { id: 'dark', label: 'Tối' },
]

function useVoices() {
  const read = () => ({ us: getVoices('us'), uk: getVoices('uk') })
  const [voices, setVoices] = useState(read)
  useEffect(() => {
    if (!isSpeechSupported()) return
    const update = () => setVoices(read())
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
  const { settings, updateSettings, reload, pending } = useData()
  const { showToast } = useToast()
  const voices = useVoices()
  const [voiceURIs, setVoiceURIs] = useState(() => ({ us: getPreferredVoiceURI('us'), uk: getPreferredVoiceURI('uk') }))
  const [theme, setThemeState] = useState(getTheme)
  const [exporting, setExporting] = useState(false)
  const [restoring, setRestoring] = useState(null) // { done, total } khi đang khôi phục
  const fileRef = useRef(null)

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

  const restoreFromFile = async (file) => {
    if (!file) return
    let data
    try {
      data = JSON.parse(await file.text())
    } catch {
      showToast('File không phải JSON hợp lệ.', { tone: 'warn' })
      return
    }
    const problem = validateBackup(data)
    if (problem) {
      showToast(problem, { tone: 'warn' })
      return
    }
    if (!navigator.onLine || pending > 0) {
      showToast('Cần có mạng và đồng bộ xong các thay đổi đang chờ rồi mới khôi phục được.', { tone: 'warn' })
      return
    }
    const ok = window.confirm(
      `Khôi phục ${summarizeBackup(data)} từ file sao lưu?\n\nDữ liệu trùng sẽ được ghi đè bằng bản trong file, dữ liệu khác được giữ nguyên.`,
    )
    if (!ok) return
    setRestoring({ done: 0, total: 1 })
    try {
      await restoreData(user.id, prepareRestore(data, user.id), (done, total) => setRestoring({ done, total }))
      await reload()
      showToast('Đã khôi phục dữ liệu.')
    } catch (err) {
      console.error(err)
      showToast('Khôi phục chưa xong. Bạn kiểm tra mạng rồi thử lại (làm lại nhiều lần cũng không bị trùng).', {
        tone: 'warn',
      })
    } finally {
      setRestoring(null)
    }
  }

  return (
    <div className="page">
      <PageHeader title="Cài đặt" />

      <section className="card settings-block">
        <h2>Giọng đọc</h2>
        <div className="segmented segmented-block" role="group" aria-label="Giọng đọc">
          {ACCENT_OPTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={settings.accent === a.id ? 'active' : ''}
              aria-pressed={settings.accent === a.id}
              onClick={() => {
                setDefaultAccent(a.id)
                updateSettings({ accent: a.id })
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <p className="hint">
          {settings.accent === 'mixed'
            ? 'Mỗi câu được đọc bằng giọng Mỹ hoặc Anh (cố định cho từng câu), giống bài nghe IELTS có nhiều giọng.'
            : settings.accent === 'uk'
              ? 'Giọng Anh-Anh, hay gặp trong bài nghe IELTS.'
              : 'Giọng Anh-Mỹ, phổ biến trong phim và podcast.'}
        </p>
        <RateSelector
          label="Tốc độ mặc định"
          value={settings.tts_rate}
          onChange={(r) => updateSettings({ tts_rate: r })}
        />
        {isSpeechSupported() &&
          (settings.accent === 'mixed' ? ['us', 'uk'] : [settings.accent]).map((acc) => (
            <label className="field" key={acc}>
              <span>
                {ACCENTS[acc].label} trên thiết bị này ({ACCENTS[acc].lang})
              </span>
              {voices[acc].length > 0 ? (
                <select
                  value={voiceURIs[acc]}
                  onChange={(e) => {
                    setVoiceURIs((v) => ({ ...v, [acc]: e.target.value }))
                    setPreferredVoiceURI(e.target.value, acc)
                  }}
                >
                  <option value="">Tự chọn giọng tốt nhất</option>
                  {voices[acc].map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                    </option>
                  ))}
                </select>
              ) : (
                <small className="hint">
                  Thiết bị chưa có giọng {ACCENTS[acc].lang}. Trên Mac/iPhone: Cài đặt → Trợ năng → Nội dung được đọc →
                  Giọng nói → English (UK) để tải thêm.
                </small>
              )}
            </label>
          ))}
        <div className="button-row">
          <SpeakButton text="What are you trying to prove?" rate={settings.tts_rate} label="Nghe thử" />
        </div>
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
        <h2>Mức ghi nhớ mong muốn</h2>
        <div className="segmented segmented-block" role="group" aria-label="Mức ghi nhớ mong muốn">
          {RETENTION_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={Number(settings.desired_retention) === r ? 'active' : ''}
              aria-pressed={Number(settings.desired_retention) === r}
              onClick={() => updateSettings({ desired_retention: r })}
            >
              {Math.round(r * 100)}%
            </button>
          ))}
        </div>
        <p className="hint">
          App dùng thuật toán FSRS để xếp lịch ôn sao cho đến hạn bạn vẫn nhớ khoảng {Math.round(Number(settings.desired_retention) * 100)}%
          số từ. Mức cao hơn thì nhớ chắc hơn nhưng phải ôn nhiều hơn. 90% là mức cân bằng.
        </p>
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
          Tải về toàn bộ thẻ, tiến độ, lịch sử và clip dưới dạng file JSON để sao lưu. File này cũng dùng để khôi phục
          (kể cả sang tài khoản mới).
        </p>
        <button type="button" className="btn btn-secondary btn-block" onClick={exportData} disabled={exporting}>
          <Icon name="download" size={20} /> {exporting ? 'Đang chuẩn bị…' : 'Xuất dữ liệu (JSON)'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            restoreFromFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => fileRef.current?.click()}
          disabled={Boolean(restoring)}
        >
          {restoring ? `Đang khôi phục… ${restoring.done}/${restoring.total}` : 'Khôi phục từ file sao lưu'}
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
