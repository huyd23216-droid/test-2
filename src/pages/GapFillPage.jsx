import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import GapFillExercise from '../components/GapFillExercise.jsx'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { useData } from '../context/DataContext.jsx'
import { useStudyTimer } from '../context/StudyTracker.jsx'
import { DICTATION_LEVELS, DICTATION_SENTENCES } from '../lib/content.js'
import { randomCheer } from '../lib/labels.js'
import { shuffle } from '../lib/planner.js'

const ROUND_SIZE = 8

export default function GapFillPage() {
  const [params] = useSearchParams()
  const level = Number(params.get('level')) || 1
  const levelInfo = DICTATION_LEVELS.find((l) => l.level === level) ?? DICTATION_LEVELS[0]
  const { listeningProgress, settings } = useData()
  useStudyTimer('free')

  // Câu chưa làm trước, sau đó câu điểm thấp; mỗi lượt 8 câu
  const build = () => {
    const pool = DICTATION_SENTENCES.filter((s) => s.level === levelInfo.level)
    const fresh = shuffle(pool.filter((s) => !listeningProgress.get(`gap:${s.id}`)))
    const done = pool
      .filter((s) => listeningProgress.get(`gap:${s.id}`))
      .sort((a, b) => listeningProgress.get(`gap:${a.id}`).last_score - listeningProgress.get(`gap:${b.id}`).last_score)
    return [...fresh, ...done].slice(0, ROUND_SIZE)
  }
  const [round, setRound] = useState(0)
  const [sentences, setSentences] = useState(build)
  const [index, setIndex] = useState(0)
  const [scores, setScores] = useState([])
  const [rate, setRate] = useState(settings.tts_rate ?? 1)
  const [cheer] = useState(randomCheer)
  const title = `Điền từ · Mức ${levelInfo.level}`
  const sentence = sentences[index]

  if (!sentence) {
    const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) : 0
    return (
      <div className="page">
        <PageHeader title={title} back="/listen" />
        <div className="summary">
          <div className="summary-hero">
            <span className="summary-icon" aria-hidden="true">
              <Icon name="star" size={34} />
            </span>
            <h2>Xong {scores.length} câu!</h2>
            <p className="muted">
              Điền đúng {avg}% chỗ trống. {cheer}
            </p>
          </div>
          <div className="stack">
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              onClick={() => {
                setSentences(build())
                setIndex(0)
                setScores([])
                setRound((r) => r + 1)
              }}
            >
              Luyện lượt nữa
            </button>
            <Link to="/listen" className="btn btn-secondary btn-block">
              Về trang Luyện nghe
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title={title} back="/listen" />
      <ProgressBar value={index} max={sentences.length} label={`${index + 1}/${sentences.length}`} />
      <GapFillExercise
        key={`${round}-${index}`}
        sentence={sentence}
        rate={rate}
        onRateChange={setRate}
        onDone={(score) => {
          setScores((list) => [...list, score])
          setIndex((i) => i + 1)
          window.scrollTo(0, 0)
        }}
        doneLabel={index + 1 >= sentences.length ? 'Xem kết quả' : 'Câu tiếp theo'}
      />
      <Link to="/listen" className="btn btn-ghost btn-block finish-early">
        Dừng ở đây cũng được
      </Link>
    </div>
  )
}
