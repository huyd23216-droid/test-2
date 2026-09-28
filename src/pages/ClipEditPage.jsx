import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { formatSeconds, parseTimestamp } from '../lib/dates.js'
import { parseYouTubeId, parseYouTubeStart } from '../lib/youtube.js'

export default function ClipEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { clips, addClip, editClip, removeClip } = useData()
  const { showToast } = useToast()
  const clip = id ? clips.find((c) => c.id === id) : null

  const [form, setForm] = useState(() => ({
    title: clip?.title ?? '',
    youtube_url: clip?.youtube_url ?? '',
    start: clip ? formatSeconds(clip.start_seconds) : '',
    end: clip?.end_seconds != null ? formatSeconds(clip.end_seconds) : '',
    transcript: clip?.transcript ?? '',
    meaning_vi: clip?.meaning_vi ?? '',
  }))
  const [busy, setBusy] = useState(false)

  if (id && !clip) {
    return (
      <div className="page">
        <PageHeader title="Không tìm thấy clip" back="/dictation" />
      </div>
    )
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const onUrlChange = (e) => {
    const url = e.target.value
    setForm((f) => {
      const start = parseYouTubeStart(url)
      return { ...f, youtube_url: url, start: !f.start && start ? formatSeconds(start) : f.start }
    })
  }

  const urlInvalid = form.youtube_url.trim() !== '' && !parseYouTubeId(form.youtube_url)

  const submit = async (e) => {
    e.preventDefault()
    const start = parseTimestamp(form.start) ?? 0
    const end = parseTimestamp(form.end)
    if (!parseYouTubeId(form.youtube_url)) {
      showToast('Link YouTube chưa đúng. Bạn copy link từ nút “Chia sẻ” trên YouTube nhé.', { tone: 'warn' })
      return
    }
    if (Number.isNaN(start) || Number.isNaN(end)) {
      showToast('Mốc thời gian viết dạng phút:giây, ví dụ 1:23.', { tone: 'warn' })
      return
    }
    if (end != null && end < start) {
      showToast('Mốc kết thúc cần sau mốc bắt đầu.', { tone: 'warn' })
      return
    }
    if (!form.transcript.trim()) {
      showToast('Bạn nhập câu thoại để app có đáp án chấm nhé.', { tone: 'warn' })
      return
    }
    const fields = {
      title: form.title.trim(),
      youtube_url: form.youtube_url.trim(),
      start_seconds: start,
      end_seconds: end,
      transcript: form.transcript.trim(),
      meaning_vi: form.meaning_vi.trim(),
    }
    setBusy(true)
    try {
      const saved = clip ? await editClip(clip.id, fields) : await addClip(fields)
      showToast('Đã lưu clip.')
      navigate(`/dictation/clips/${saved.id}`)
    } catch (err) {
      console.error(err)
      showToast('Chưa lưu được. Bạn kiểm tra kết nối mạng rồi thử lại nhé.', { tone: 'warn' })
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm('Xóa clip này?')) return
    setBusy(true)
    try {
      await removeClip(clip.id)
      showToast('Đã xóa clip.')
      navigate('/dictation')
    } catch (err) {
      console.error(err)
      showToast('Chưa xóa được. Bạn thử lại nhé.', { tone: 'warn' })
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeader title={clip ? 'Sửa clip' : 'Thêm clip thật'} back="/dictation" />
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Link YouTube *</span>
          <input
            type="url"
            inputMode="url"
            value={form.youtube_url}
            onChange={onUrlChange}
            placeholder="https://youtu.be/…"
            required
            autoCapitalize="none"
            autoCorrect="off"
          />
          {urlInvalid && <small className="field-note">Link này chưa phải link video YouTube.</small>}
        </label>
        <div className="field-row">
          <label className="field">
            <span>Bắt đầu (phút:giây)</span>
            <input value={form.start} onChange={set('start')} placeholder="1:23" inputMode="numeric" />
          </label>
          <label className="field">
            <span>Kết thúc (tùy chọn)</span>
            <input value={form.end} onChange={set('end')} placeholder="1:30" inputMode="numeric" />
          </label>
        </div>
        <label className="field">
          <span>Câu thoại (đáp án) *</span>
          <textarea rows={3} value={form.transcript} onChange={set('transcript')} lang="en" required />
        </label>
        <label className="field">
          <span>Nghĩa tiếng Việt</span>
          <textarea rows={2} value={form.meaning_vi} onChange={set('meaning_vi')} />
        </label>
        <label className="field">
          <span>Tên gợi nhớ</span>
          <input value={form.title} onChange={set('title')} placeholder="Ví dụ: Friends S01E01 – quán cà phê" />
        </label>
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {clip ? 'Lưu thay đổi' : 'Lưu clip'}
        </button>
        {clip && (
          <button type="button" className="btn btn-ghost btn-block btn-danger-text" onClick={remove} disabled={busy}>
            Xóa clip này
          </button>
        )}
      </form>
    </div>
  )
}
