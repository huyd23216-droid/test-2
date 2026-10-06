import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useData } from '../context/DataContext.jsx'
import { dueReviewItems, setProgress, sortSets } from '../lib/homeworkSets.js'
import { shortDate } from '../lib/progress.js'

function dueText(dueOn, today) {
  if (!dueOn) return null
  if (dueOn < today) return `Hạn ${shortDate(dueOn)} · làm khi rảnh nhé`
  if (dueOn === today) return 'Hạn hôm nay'
  return `Hạn ${shortDate(dueOn)}`
}

function SetRow({ set, progress, today }) {
  const finished = Boolean(set.completed_at)
  let status
  if (finished) {
    status = progress.graded ? `Đúng ${progress.correct}/${progress.graded} câu` : 'Đã nộp'
  } else if (progress.answered > 0) {
    status = `Đã làm ${progress.answered}/${progress.total} câu`
  } else {
    status = `${progress.total} câu`
  }
  return (
    <Link to={`/homework/set/${set.id}`} className="card set-row">
      <span className="set-row-main">
        <strong>{set.title}</strong>
        <span className="set-row-meta">
          {set.tag && <span className="pill">{set.tag}</span>}
          {!finished && dueText(set.due_on, today) && <span className="muted">{dueText(set.due_on, today)}</span>}
        </span>
        <span className="muted">
          {status}
          {finished && progress.feedback > 0 && ' · có nhận xét của giáo viên'}
          {finished && progress.waitingFeedback > 0 && ` · ${progress.waitingFeedback} bài viết chờ nhận xét`}
        </span>
      </span>
      <Icon name={finished ? 'check' : 'play'} size={20} />
    </Link>
  )
}

export default function HomeworkPage() {
  const { today, hwSets, hwAnswersGrouped, setsReady } = useData()
  const { open, done } = sortSets(hwSets)
  const due = dueReviewItems(hwSets, hwAnswersGrouped, today)

  return (
    <div className="page">
      <PageHeader title="Bài tập" />

      {!setsReady && (
        <div className="notice notice-warn">
          Mục bài tập được giao cần thêm bảng mới trong Supabase. Bạn chạy file{' '}
          <code>supabase/migrations/20261006000000_homework_sets_review_log.sql</code> (xem README) rồi mở lại app nhé.
        </div>
      )}

      {due.length > 0 && (
        <section className="card stack set-review">
          <h2 className="section-title">Ôn câu sai</h2>
          <p>
            Có <strong>{due.length} câu</strong> bạn từng làm sai đến lúc ôn lại hôm nay. Làm đúng thì câu sẽ quay lại
            sau 3 ngày, rồi 7 ngày, rồi xong.
          </p>
          <Link to="/homework/review" className="btn btn-primary btn-block btn-lg">
            <Icon name="play" size={20} /> Ôn {due.length} câu
          </Link>
        </section>
      )}

      <section className="stack">
        <h2 className="section-title">Chưa làm</h2>
        {open.length === 0 ? (
          <p className="muted">
            {hwSets.length === 0
              ? 'Chưa có bài tập nào được giao. Khi giáo viên (hoặc Claude) thêm bài, bài sẽ hiện ở đây.'
              : 'Bạn đã làm hết bài được giao. Giỏi lắm! 🎉'}
          </p>
        ) : (
          open.map((set) => (
            <SetRow key={set.id} set={set} progress={setProgress(set, hwAnswersGrouped)} today={today} />
          ))
        )}
      </section>

      {done.length > 0 && (
        <section className="stack">
          <h2 className="section-title">Đã xong</h2>
          {done.map((set) => (
            <SetRow key={set.id} set={set} progress={setProgress(set, hwAnswersGrouped)} today={today} />
          ))}
        </section>
      )}

      <section className="stack">
        <h2 className="section-title">Luyện thêm</h2>
        <Link to="/homework/practice" className="module">
          <Icon name="task" />
          <span>
            <strong>Luyện tập tự động</strong>
            <small>Bài tự tạo từ từ vựng bạn đã học, nghe số và đánh vần kiểu IELTS, sổ lỗi</small>
          </span>
        </Link>
      </section>
    </div>
  )
}
