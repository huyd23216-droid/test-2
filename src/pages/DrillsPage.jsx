import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import { useData } from '../context/DataContext.jsx'
import { DRILLS } from '../lib/content.js'

export default function DrillsPage() {
  const { listeningProgress } = useData()

  return (
    <div className="page">
      <PageHeader title="Phân biệt âm dễ nhầm" back="/listen" />
      <p className="intro">
        Máy đọc một trong hai câu gần giống nhau, bạn chọn câu mình nghe được. Đây là những chỗ người Việt hay nghe nhầm
        nhất trong IELTS Listening.
      </p>
      <div className="group-list">
        {DRILLS.map((drill) => {
          const rows = drill.items.map((it) => listeningProgress.get(`drill:${it.id}`)).filter(Boolean)
          const attempts = rows.reduce((n, r) => n + r.attempts, 0)
          const correct = rows.reduce((n, r) => n + r.correct_count, 0)
          return (
            <section key={drill.id} className="card group">
              <div className="group-head">
                <h2>{drill.name}</h2>
                <span className="pill">{attempts ? `đúng ${Math.round((correct / attempts) * 100)}%` : `${drill.items.length} câu`}</span>
              </div>
              <p>{drill.explanation}</p>
              <Link to={`/listen/drills/${drill.id}`} className="btn btn-secondary btn-block">
                Luyện bài này
              </Link>
            </section>
          )
        })}
      </div>
    </div>
  )
}
