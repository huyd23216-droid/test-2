import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DictationExercise from '../components/DictationExercise.jsx'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { useData } from '../context/DataContext.jsx'
import { useStudyTimer } from '../context/StudyTracker.jsx'
import { DICTATION_LEVELS, DICTATION_SENTENCES } from '../lib/content.js'
import { orderDictation } from '../lib/planner.js'
import { randomCheer } from '../lib/labels.js'

export default function DictationPracticePage() {
  const [params] = useSearchParams()
  const level = Number(params.get('level')) || 1
  const levelInfo = DICTATION_LEVELS.find((l) => l.level === level) ?? DICTATION_LEVELS[0]
  const { dictationStats, settings } = useData()
  useStudyTimer('free')

  const build = () => orderDictation(DICTATION_SENTENCES.filter((s) => s.level === levelInfo.level), dictationStats)
  const [round, setRound] = useState(0)
  const [sentences, setSentences] = useState(build)
  const [index, setIndex] = useState(0)
  const [scores, setScores] = useState([])
  const [rate, setRate] = useState(settings.tts_rate ?? 1)
  const [cheer] = useState(randomCheer)

  const sentence = sentences[index]
  const title = `Mức ${levelInfo.level}: ${levelInfo.name}`

  if (!sentence) {
    const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) : 0
    return (
      <div className="page">
        <PageHeader title={title} back="/dictation" />
        <div className="summary">
          <div className="summary-hero">
            <span className="summary-icon" aria-hidden="true">
              <Icon name="star" size={34} />
            </span>
            <h2>Xong {scores.length} câu!</h2>
            <p className="muted">
              Trung bình {avg}% từ đúng. {cheer}
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
              Luyện lại lượt nữa
            </button>
            <Link to="/dictation" className="btn btn-secondary btn-block">
              Chọn mức khác
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title={title} back="/dictation" />
      <ProgressBar value={index} max={sentences.length} label={`${index + 1}/${sentences.length}`} />
      <DictationExercise
        key={`${round}-${index}`}
        text={sentence.text}
        meaning={sentence.meaning_vi}
        youglishQuery={sentence.youglish_query}
        level={sentence.level}
        sentenceId={sentence.id}
        rate={rate}
        onRateChange={setRate}
        onDone={(r) => {
          setScores((list) => [...list, r.score])
          setIndex((i) => i + 1)
          window.scrollTo(0, 0)
        }}
        doneLabel={index + 1 >= sentences.length ? 'Xem kết quả' : 'Câu tiếp theo'}
      />
      <Link to="/dictation" className="btn btn-ghost btn-block finish-early">
        Dừng ở đây cũng được
      </Link>
    </div>
  )
}
