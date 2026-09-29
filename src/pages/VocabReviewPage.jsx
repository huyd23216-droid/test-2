import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import ReviewQueue from '../components/ReviewQueue.jsx'
import { useData } from '../context/DataContext.jsx'
import { useStudyTimer } from '../context/StudyTracker.jsx'
import { randomCheer } from '../lib/labels.js'

const TITLES = { due: 'Ôn thẻ đến hạn', new: 'Học từ mới', extra: 'Học thêm từ mới' }

function pickCards(mode, stats) {
  if (mode === 'new') return stats.newCards.slice(0, stats.newQuotaLeft)
  if (mode === 'extra') return stats.newCards.slice(0, 5)
  return stats.dueCards
}

export default function VocabReviewPage() {
  const [params] = useSearchParams()
  const mode = TITLES[params.get('mode')] ? params.get('mode') : 'due'
  const { stats } = useData()
  useStudyTimer('free')
  const [cardIds] = useState(() => pickCards(mode, stats).map((c) => c.id))
  const [result, setResult] = useState(null)
  const [cheer] = useState(randomCheer)

  if (cardIds.length === 0 || result) {
    const count = result ? result.reviewed + result.learnedNew : 0
    return (
      <div className="page">
        <PageHeader title={TITLES[mode]} back="/vocab" />
        <div className="summary">
          <div className="summary-hero">
            <span className="summary-icon" aria-hidden="true">
              <Icon name="star" size={34} />
            </span>
            <h2>{count > 0 ? `Xong ${count} thẻ!` : 'Không có thẻ nào cần học lúc này'}</h2>
            <p className="muted">{count > 0 ? cheer : 'Bạn có thể nghỉ ngơi hoặc luyện nối âm, chính tả nhé.'}</p>
          </div>
          <div className="stack">
            <Link to="/vocab" className="btn btn-primary btn-block btn-lg">
              Về trang từ vựng
            </Link>
            <Link to="/" className="btn btn-secondary btn-block">
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title={TITLES[mode]} back="/vocab" backLabel="Dừng và quay lại" />
      <ReviewQueue cardIds={cardIds} onFinish={setResult} />
    </div>
  )
}
