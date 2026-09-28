import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import SpeakButton from '../components/SpeakButton.jsx'
import YouGlishButton from '../components/YouGlishButton.jsx'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { POS_OPTIONS } from '../lib/labels.js'
import { isNewCard } from '../lib/srs.js'
import { describeDue } from '../lib/dates.js'

const EMPTY = { word: '', ipa: '', pos: 'noun', meaning_vi: '', example_en: '', example_vi: '', youglish_query: '' }

export default function CardEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { cards, addCard, editCard, removeCard, settings, today } = useData()
  const { showToast } = useToast()
  const card = id ? cards.find((c) => c.id === id) : null
  const [form, setForm] = useState(() => (card ? { ...EMPTY, ...card, youglish_query: card.youglish_query ?? '' } : EMPTY))
  const [busy, setBusy] = useState(false)

  if (id && !card) {
    return (
      <div className="page">
        <PageHeader title="Không tìm thấy thẻ" back="/vocab" />
        <p className="hint">Thẻ này có thể đã bị xóa.</p>
      </div>
    )
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const posKnown = POS_OPTIONS.some((o) => o.value === form.pos)

  const submit = async (e) => {
    e.preventDefault()
    const fields = {
      word: form.word.trim(),
      ipa: form.ipa.trim(),
      pos: form.pos.trim(),
      meaning_vi: form.meaning_vi.trim(),
      example_en: form.example_en.trim(),
      example_vi: form.example_vi.trim(),
      youglish_query: form.youglish_query.trim() || null,
    }
    if (!fields.word || !fields.meaning_vi) {
      showToast('Bạn điền ít nhất từ tiếng Anh và nghĩa tiếng Việt nhé.', { tone: 'warn' })
      return
    }
    setBusy(true)
    try {
      if (card) await editCard(card.id, fields)
      else await addCard(fields)
      showToast(card ? 'Đã lưu thay đổi.' : `Đã thêm “${fields.word}”. Thẻ sẽ xuất hiện trong phần từ mới.`)
      navigate('/vocab')
    } catch (err) {
      console.error(err)
      showToast('Chưa lưu được. Bạn kiểm tra kết nối mạng rồi thử lại nhé.', { tone: 'warn' })
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Xóa thẻ “${card.word}”? Tiến độ ôn tập của thẻ này cũng sẽ bị xóa.`)) return
    setBusy(true)
    try {
      await removeCard(card)
      showToast('Đã xóa thẻ.')
      navigate('/vocab')
    } catch (err) {
      console.error(err)
      showToast('Chưa xóa được. Bạn thử lại nhé.', { tone: 'warn' })
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeader title={card ? 'Sửa thẻ' : 'Thêm thẻ mới'} back="/vocab" />

      {card && (
        <div className="card card-info">
          <p>
            {isNewCard(card)
              ? 'Thẻ này chưa được học.'
              : `Đã ôn ${card.reviews_count} lần · ${describeDue(card.due_date, today)}`}
          </p>
          <div className="button-row">
            <SpeakButton text={form.word} rate={settings.tts_rate} label="Nghe" />
            <YouGlishButton query={form.youglish_query || form.word} />
          </div>
        </div>
      )}

      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Từ tiếng Anh *</span>
          <input value={form.word} onChange={set('word')} required lang="en" autoCapitalize="none" autoCorrect="off" />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Phiên âm IPA</span>
            <input value={form.ipa} onChange={set('ipa')} placeholder="/ˈwɑːtɚ/" autoCapitalize="none" autoCorrect="off" />
          </label>
          <label className="field">
            <span>Loại từ</span>
            <select value={form.pos} onChange={set('pos')}>
              {!posKnown && <option value={form.pos}>{form.pos || '(trống)'}</option>}
              {POS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Nghĩa tiếng Việt *</span>
          <input value={form.meaning_vi} onChange={set('meaning_vi')} required />
        </label>
        <label className="field">
          <span>Câu ví dụ tiếng Anh</span>
          <textarea rows={2} value={form.example_en} onChange={set('example_en')} lang="en" />
        </label>
        <label className="field">
          <span>Nghĩa câu ví dụ</span>
          <textarea rows={2} value={form.example_vi} onChange={set('example_vi')} />
        </label>
        <label className="field">
          <span>Cụm tìm trên YouGlish</span>
          <input
            value={form.youglish_query}
            onChange={set('youglish_query')}
            placeholder="Để trống = tìm chính từ này"
            lang="en"
            autoCapitalize="none"
          />
        </label>
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {card ? 'Lưu thay đổi' : 'Thêm thẻ'}
        </button>
        {card && (
          <button type="button" className="btn btn-ghost btn-block btn-danger-text" onClick={remove} disabled={busy}>
            Xóa thẻ này
          </button>
        )}
      </form>
    </div>
  )
}
