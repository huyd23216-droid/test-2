import PageHeader from '../components/PageHeader.jsx'
import SpeakButton from '../components/SpeakButton.jsx'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { IELTS_SETS } from '../lib/content.js'
import { isNewCard } from '../lib/srs.js'

export default function SetsPage() {
  const { settings, cards, enableSet, disableSet } = useData()
  const { showToast } = useToast()
  const enabled = new Set(settings.enabled_sets ?? [])

  const progressOf = (set) => {
    const ids = new Set(set.cards.map((c) => c.id))
    const mine = cards.filter((c) => ids.has(c.seed_id))
    return { total: mine.length, learned: mine.filter((c) => !isNewCard(c)).length }
  }

  return (
    <div className="page">
      <PageHeader title="Bộ từ IELTS" back="/vocab" />
      <p className="intro">
        Chọn chủ đề bạn muốn học. Bộ vừa bật được xếp lên đầu hàng từ mới, học dần theo số từ mới mỗi ngày trong Cài đặt.
        Từ đã có trong thẻ của bạn sẽ không bị thêm trùng.
      </p>
      <div className="group-list">
        {IELTS_SETS.map((set) => {
          const on = enabled.has(set.id)
          const { total, learned } = progressOf(set)
          return (
            <section key={set.id} className="card group">
              <div className="group-head">
                <h2>{set.name}</h2>
                <span className={`pill ${on ? 'pill-learning' : ''}`}>
                  {on ? `đã học ${learned}/${total}` : `${set.cards.length} từ`}
                </span>
              </div>
              <p>{set.description}</p>
              <details className="examples">
                <summary>Xem các từ</summary>
                <ul>
                  {set.cards.map((c) => (
                    <li key={c.id}>
                      <div>
                        <p lang="en">
                          <strong>{c.word}</strong> <span className="muted">{c.ipa}</span>
                        </p>
                        <p className="muted">{c.meaning_vi}</p>
                      </div>
                      <SpeakButton text={c.word} rate={settings.tts_rate} variant="icon" />
                    </li>
                  ))}
                </ul>
              </details>
              {on ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  onClick={() => {
                    if (!window.confirm(`Gỡ bộ “${set.name}”? Các thẻ chưa học của bộ này sẽ bị xóa, thẻ đã học vẫn giữ nguyên.`)) return
                    const n = disableSet(set.id)
                    showToast(n ? `Đã gỡ bộ từ và xóa ${n} thẻ chưa học.` : 'Đã gỡ bộ từ.')
                  }}
                >
                  Gỡ bộ này
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => {
                    const n = enableSet(set.id)
                    showToast(n ? `Đã thêm ${n} thẻ vào đầu hàng từ mới.` : 'Các từ của bộ này đều đã có trong thẻ của bạn.')
                  }}
                >
                  Thêm vào thẻ của tôi
                </button>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
