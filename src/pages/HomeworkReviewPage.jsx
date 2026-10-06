import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import SetItemRunner from '../components/SetItemRunner.jsx'
import { useData } from '../context/DataContext.jsx'
import { useStudyTimer } from '../context/StudyTracker.jsx'
import { dueReviewItems } from '../lib/homeworkSets.js'
import { randomCheer } from '../lib/labels.js'

// "Ôn câu sai": các câu từng làm sai đã đến hạn ôn lại, gom thành một bài nhỏ
export default function HomeworkReviewPage() {
  const { today, hwSets, hwAnswersGrouped } = useData()
  useStudyTimer('free')
  const [entries] = useState(() => dueReviewItems(hwSets, hwAnswersGrouped, today))
  const [results, setResults] = useState(null)
  const [cheer] = useState(randomCheer)

  if (entries.length === 0) {
    return (
      <div className="page">
        <PageHeader title="Ôn câu sai" back="/homework" />
        <div className="notice">Hôm nay không có câu nào cần ôn lại. Tuyệt vời! 🎉</div>
        <Link to="/homework" className="btn btn-secondary btn-block">
          Về trang Bài tập
        </Link>
      </div>
    )
  }

  if (results) {
    const right = results.filter((r) => r.isCorrect).length
    return (
      <div className="page">
        <PageHeader title="Ôn câu sai" back="/homework" />
        <div className="summary">
          <div className="summary-hero">
            <span className="summary-icon" aria-hidden="true">
              <Icon name="star" size={34} />
            </span>
            <h2>Ôn xong rồi!</h2>
            <p className="muted">
              Đúng {right}/{results.length} câu. {cheer}
            </p>
          </div>
          <p className="hint">
            Câu đúng sẽ quay lại sau 3 ngày, rồi 7 ngày cho chắc. Câu chưa đúng sẽ gặp lại vào ngày mai.
          </p>
          <Link to="/homework" className="btn btn-primary btn-block btn-lg">
            Về trang Bài tập
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title="Ôn câu sai" back="/homework" subtitle={`${entries.length} câu đến hạn hôm nay`} />
      <SetItemRunner entries={entries} onFinish={setResults} showSource />
      <Link to="/homework" className="btn btn-ghost btn-block finish-early">
        Dừng ở đây
      </Link>
    </div>
  )
}
