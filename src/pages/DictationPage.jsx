import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import MistakeWords from '../components/MistakeWords.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useData } from '../context/DataContext.jsx'
import { DICTATION_LEVELS, DICTATION_SENTENCES } from '../lib/content.js'
import { formatDateTime, formatSeconds } from '../lib/dates.js'
import { aggregateMistakes } from '../lib/mistakes.js'

export default function DictationPage() {
  const { dictationStats, history, clips } = useData()
  const recent = history.slice(0, 8)
  const location = useLocation()
  useEffect(() => {
    if (location.hash === '#clips') document.getElementById('clips')?.scrollIntoView()
  }, [location.hash])
  const mistakes = useMemo(() => {
    const meaningOf = new Map([
      ...DICTATION_SENTENCES.map((d) => [d.text, d.meaning_vi]),
      ...clips.map((c) => [c.transcript, c.meaning_vi]),
    ])
    return aggregateMistakes(history).map((m) => ({ ...m, meaning: meaningOf.get(m.sentence) ?? '' }))
  }, [history, clips])

  return (
    <div className="page">
      <PageHeader title="Chép chính tả" />
      <p className="intro">
        Nghe một câu, gõ lại những gì bạn nghe được. App chấm từng từ, bỏ qua viết hoa và dấu câu.
      </p>

      <div className="group-list">
        {DICTATION_LEVELS.map((lv) => {
          const sentences = DICTATION_SENTENCES.filter((s) => s.level === lv.level)
          const done = sentences.filter((s) => dictationStats.has(s.id))
          const avg = done.length
            ? Math.round((done.reduce((sum, s) => sum + dictationStats.get(s.id).lastScore, 0) / done.length) * 100)
            : null
          return (
            <section key={lv.level} className="card group">
              <div className="group-head">
                <h2>
                  Mức {lv.level}: {lv.name}
                </h2>
                <span className="pill">
                  {done.length}/{sentences.length}
                </span>
              </div>
              <p>{lv.description}</p>
              {avg !== null && <p className="muted">Điểm gần nhất trung bình: {avg}% từ đúng</p>}
              <Link to={`/dictation/practice?level=${lv.level}`} className="btn btn-secondary btn-block">
                Luyện mức {lv.level}
              </Link>
            </section>
          )
        })}
      </div>

      <section id="clips">
        <div className="section-head">
          <h2 className="section-title">Clip thật từ YouTube</h2>
          <Link to="/dictation/clips/new" className="btn btn-secondary btn-sm">
            <Icon name="plus" size={18} /> Thêm clip
          </Link>
        </div>
        <p className="hint">
          Lưu link YouTube, mốc thời gian và câu thoại. Khi luyện, bạn mở video, nghe đoạn đó rồi gõ lại câu thoại để app
          chấm.
        </p>
        {clips.length === 0 ? (
          <p className="notice">Chưa có clip nào. Gặp câu thoại hay trong phim hay podcast thì lưu lại luyện nhé!</p>
        ) : (
          <ul className="card-list">
            {clips.map((clip) => {
              const attempts = history.filter((h) => h.clip_id === clip.id)
              return (
                <li key={clip.id} className="clip-row">
                  <Link to={`/dictation/clips/${clip.id}`} className="card-row">
                    <span className="card-row-main">
                      <strong>{clip.title || 'Clip chưa đặt tên'}</strong>
                      <small>
                        Từ {formatSeconds(clip.start_seconds)}
                        {clip.end_seconds != null && ` đến ${formatSeconds(clip.end_seconds)}`}
                        {attempts.length > 0 && ` · đã luyện ${attempts.length} lần`}
                      </small>
                    </span>
                    <Icon name="play" size={18} />
                  </Link>
                  <Link to={`/dictation/clips/${clip.id}/edit`} className="icon-btn" aria-label="Sửa clip">
                    <Icon name="edit" size={18} />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {mistakes.length > 0 && (
        <section>
          <h2 className="section-title">Từ hay nghe sai</h2>
          <p className="hint">Những từ bạn gõ sai hoặc bỏ sót từ 2 lần trở lên. Tạo thẻ để ôn, kèm câu bạn đã nghe.</p>
          <MistakeWords items={mistakes} />
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className="section-title">Gần đây</h2>
          <ul className="history">
            {recent.map((h) => (
              <li key={h.id}>
                <span lang="en" className="history-text">
                  {h.sentence}
                </span>
                <span className="history-meta">
                  <strong>{Math.round(h.score * 100)}%</strong>
                  <small>{formatDateTime(h.created_at)}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
