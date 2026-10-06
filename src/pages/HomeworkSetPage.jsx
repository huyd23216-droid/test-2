import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SetItemRunner from '../components/SetItemRunner.jsx'
import { useData } from '../context/DataContext.jsx'
import { useStudyTimer } from '../context/StudyTracker.jsx'
import { SET_ITEM_TYPES, answersFor, setItems, setProgress } from '../lib/homeworkSets.js'
import { randomCheer } from '../lib/labels.js'

// Xem lại cả bộ: câu trả lời lần đầu, đáp án, giải thích và nhận xét bài viết
function SetReview({ set, items, grouped }) {
  return (
    <ol className="set-review-list">
      {items.map((item) => {
        const list = answersFor(grouped, set.id, item.id)
        const first = list[0]
        const last = list[list.length - 1]
        const state = !first
          ? 'Chưa làm'
          : item.type === 'write'
            ? last.feedback_vi
              ? 'Đã có nhận xét'
              : 'Chờ nhận xét'
            : first.is_correct
              ? 'Đúng'
              : 'Chưa đúng'
        return (
          <li key={item.id} className="card stack">
            <div className="set-item-head">
              <span className="badge">{SET_ITEM_TYPES[item.type]}</span>
              <span className={`pill ${first?.is_correct ? 'pill-mastered' : ''}`}>{state}</span>
            </div>
            <p className="set-prompt" lang="en">
              {item.prompt}
            </p>
            {first && (
              <p>
                <span className="label">Bạn trả lời</span>
                <span className="set-answer" lang="en">
                  {(item.type === 'write' ? last : first).answer}
                </span>
              </p>
            )}
            {item.type !== 'write' && first && !first.is_correct && (
              <p>
                <span className="label">Đáp án</span>
                <strong lang="en">{item.answer}</strong>
              </p>
            )}
            {item.explain_vi && (
              <p className="set-explain">
                <span className="label">Giải thích</span>
                {item.explain_vi}
              </p>
            )}
            {item.type === 'write' && last?.feedback_vi && (
              <div className="notice set-feedback">
                <span className="label">Nhận xét của giáo viên</span>
                <p>{last.feedback_vi}</p>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export default function HomeworkSetPage() {
  const { id } = useParams()
  const { hwSets, hwAnswersGrouped } = useData()
  useStudyTimer('free')
  const set = hwSets.find((s) => s.id === id)
  const items = setItems(set)

  // Làm tiếp từ các câu chưa trả lời (cố định danh sách lúc mở bài)
  const [entries] = useState(() =>
    set ? items.filter((item) => answersFor(hwAnswersGrouped, set.id, item.id).length === 0).map((item) => ({ set, item })) : [],
  )
  const [view, setView] = useState(() => (entries.length ? 'run' : 'review'))
  const [cheer] = useState(randomCheer)

  if (!set) {
    return (
      <div className="page">
        <PageHeader title="Bài tập" back="/homework" />
        <div className="notice">Không tìm thấy bài tập này. Có thể bài đã bị xoá.</div>
        <Link to="/homework" className="btn btn-secondary btn-block">
          Về trang Bài tập
        </Link>
      </div>
    )
  }

  const progress = setProgress(set, hwAnswersGrouped)
  const header = <PageHeader title={set.title} back="/homework" subtitle={set.tag || undefined} />

  if (items.length === 0) {
    return (
      <div className="page">
        {header}
        <div className="notice">Bài này chưa có câu hỏi nào.</div>
      </div>
    )
  }

  if (view === 'run') {
    // Tính theo lúc mở bài (danh sách câu cố định), không đổi khi đang trả lời
    const resumed = entries.length < items.length
    return (
      <div className="page">
        {header}
        {!resumed && set.instructions_vi && <div className="notice">{set.instructions_vi}</div>}
        {resumed && <p className="muted">Làm tiếp từ câu chưa làm.</p>}
        <SetItemRunner entries={entries} onFinish={() => setView('summary')} />
        <Link to="/homework" className="btn btn-ghost btn-block finish-early">
          Dừng ở đây, lát làm tiếp
        </Link>
      </div>
    )
  }

  if (view === 'summary') {
    const wrong = progress.graded - progress.correct
    return (
      <div className="page">
        {header}
        <div className="summary">
          <div className="summary-hero">
            <span className="summary-icon" aria-hidden="true">
              <Icon name="star" size={34} />
            </span>
            <h2>Xong bài rồi! 🎉</h2>
            <p className="muted">
              {progress.graded > 0 && `Đúng ${progress.correct}/${progress.graded} câu. `}
              {cheer}
            </p>
          </div>
          {wrong > 0 && (
            <p className="hint">{wrong} câu chưa đúng sẽ quay lại ở mục Ôn câu sai từ ngày mai để bạn nhớ chắc hơn.</p>
          )}
          {progress.waitingFeedback > 0 && (
            <p className="hint">Bài viết của bạn đã được lưu, giáo viên sẽ nhận xét sau.</p>
          )}
          <div className="stack">
            <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => setView('review')}>
              Xem lại bài
            </button>
            <Link to="/homework" className="btn btn-secondary btn-block">
              Về trang Bài tập
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {header}
      <p className="muted">
        {progress.graded > 0 ? `Đúng ${progress.correct}/${progress.graded} câu ở lần làm đầu tiên.` : 'Đã nộp bài.'}
      </p>
      <SetReview set={set} items={items} grouped={hwAnswersGrouped} />
      <Link to="/homework" className="btn btn-secondary btn-block">
        Về trang Bài tập
      </Link>
    </div>
  )
}
