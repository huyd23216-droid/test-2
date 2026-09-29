import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ConnectedSpeechExercise from '../components/ConnectedSpeechExercise.jsx'
import DictationExercise from '../components/DictationExercise.jsx'
import Icon from '../components/Icon.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import ReviewQueue from '../components/ReviewQueue.jsx'
import { useData } from '../context/DataContext.jsx'
import { useStudyTimer } from '../context/StudyTracker.jsx'
import { CS_ITEMS, DICTATION_SENTENCES } from '../lib/content.js'
import { orderConnectedSpeech, orderDictation } from '../lib/planner.js'
import { randomCheer } from '../lib/labels.js'
import {
  DAILY_SESSION_CONNECTED_SPEECH,
  DAILY_SESSION_DICTATION,
  DAILY_SESSION_MAX_REVIEWS,
} from '../config.js'

// Ghép buổi học: thẻ đến hạn → từ mới → nối âm → chính tả
function buildPlan({ stats, csProgress, dictationStats }) {
  const steps = []
  const reviews = stats.dueCards.slice(0, DAILY_SESSION_MAX_REVIEWS).map((c) => c.id)
  if (reviews.length) steps.push({ type: 'review', title: `Ôn ${reviews.length} thẻ đến hạn`, cardIds: reviews })

  const fresh = stats.newCards.slice(0, stats.newQuotaLeft).map((c) => c.id)
  if (fresh.length) steps.push({ type: 'new', title: `${fresh.length} từ mới`, cardIds: fresh })

  orderConnectedSpeech(CS_ITEMS, csProgress)
    .slice(0, DAILY_SESSION_CONNECTED_SPEECH)
    .forEach((item) =>
      steps.push({ type: 'cs', title: 'Nối âm', item, mode: Math.random() < 0.5 ? 'read' : 'listen' }),
    )

  const sentences = orderDictation(DICTATION_SENTENCES, dictationStats).slice(0, DAILY_SESSION_DICTATION)
  sentences.forEach((sentence, i) =>
    steps.push({ type: 'dictation', title: `Chính tả ${i + 1}/${sentences.length}`, sentence }),
  )
  return steps
}

function useElapsedMinutes(tracker) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSeconds(tracker.getCurrent().duration_seconds), 5000)
    return () => clearInterval(t)
  }, [tracker])
  return Math.floor(seconds / 60)
}

function Summary({ results, seconds, remainingDue }) {
  const [cheer] = useState(randomCheer)
  const minutes = Math.max(1, Math.round(seconds / 60))
  const dictAvg = results.dictation.length
    ? Math.round((results.dictation.reduce((s, r) => s + r.score, 0) / results.dictation.length) * 100)
    : null

  return (
    <div className="summary">
      <div className="summary-hero">
        <span className="summary-icon" aria-hidden="true">
          <Icon name="star" size={34} />
        </span>
        <h2>Xong buổi học hôm nay!</h2>
        <p className="muted">{cheer}</p>
      </div>
      <ul className="summary-list">
        <li>
          <span>Thời gian học</span>
          <strong>{minutes} phút</strong>
        </li>
        {results.reviewed > 0 && (
          <li>
            <span>Thẻ đã ôn</span>
            <strong>{results.reviewed}</strong>
          </li>
        )}
        {results.learnedNew > 0 && (
          <li>
            <span>Từ mới</span>
            <strong>{results.learnedNew}</strong>
          </li>
        )}
        {results.cs.map((r, i) => (
          <li key={`cs-${i}`}>
            <span>Nối âm</span>
            <strong>
              {r.correct}/{r.total} từ đúng
            </strong>
          </li>
        ))}
        {dictAvg !== null && (
          <li>
            <span>Chép chính tả ({results.dictation.length} câu)</span>
            <strong>{dictAvg}% từ đúng</strong>
          </li>
        )}
      </ul>
      {remainingDue > 0 && (
        <p className="hint">
          Còn {remainingDue} thẻ đến hạn. Khi nào thích, bạn có thể ôn thêm ở mục Từ vựng.
        </p>
      )}
      <div className="stack">
        <Link to="/" className="btn btn-primary btn-block btn-lg">
          Về trang chủ
        </Link>
        <Link to="/connected" className="btn btn-secondary btn-block">
          Luyện thêm nối âm
        </Link>
        <Link to="/dictation" className="btn btn-secondary btn-block">
          Luyện thêm chính tả
        </Link>
      </div>
    </div>
  )
}

export default function SessionPage() {
  const data = useData()
  const tracker = useStudyTimer('daily')
  const [plan] = useState(() => buildPlan(data))
  const [step, setStep] = useState(0)
  const [finished, setFinished] = useState(false)
  const [rate, setRate] = useState(data.settings.tts_rate ?? 1)
  const [results, setResults] = useState({ reviewed: 0, learnedNew: 0, cs: [], dictation: [] })
  const [finalSeconds, setFinalSeconds] = useState(0)
  const elapsed = useElapsedMinutes(tracker)

  const current = plan[step]

  const next = useCallback(() => {
    window.scrollTo(0, 0)
    if (step + 1 >= plan.length) {
      setFinalSeconds(tracker.getCurrent().duration_seconds)
      setFinished(true)
      tracker.flush()
    } else {
      setStep((s) => s + 1)
    }
  }, [step, plan.length, tracker])

  const finishEarly = () => {
    setFinalSeconds(tracker.getCurrent().duration_seconds)
    setFinished(true)
    tracker.flush()
  }

  const onAnswer = useCallback(({ wasNew }) => {
    setResults((r) => (wasNew ? { ...r, learnedNew: r.learnedNew + 1 } : { ...r, reviewed: r.reviewed + 1 }))
  }, [])

  if (finished) {
    return (
      <div className="page">
        <Summary
          results={results}
          seconds={finalSeconds}
          remainingDue={data.stats.dueCards.length}
        />
      </div>
    )
  }

  return (
    <div className="page session">
      <header className="session-head">
        <Link to="/" className="icon-btn" aria-label="Thoát buổi học">
          <Icon name="back" />
        </Link>
        <div className="session-title">
          <p className="session-step">
            Bước {step + 1}/{plan.length} · {current.title}
          </p>
          <ProgressBar value={step} max={plan.length} />
        </div>
        <span className="session-time" title="Thời gian học">
          <Icon name="clock" size={16} /> {elapsed}′
        </span>
      </header>

      {(current.type === 'review' || current.type === 'new') && (
        <ReviewQueue key={step} cardIds={current.cardIds} onAnswer={onAnswer} onFinish={next} />
      )}

      {current.type === 'cs' && (
        <ConnectedSpeechExercise
          key={step}
          item={current.item}
          mode={current.mode}
          rate={rate}
          onRateChange={setRate}
          onDone={(r) => {
            setResults((res) => ({ ...res, cs: [...res.cs, r] }))
            next()
          }}
          doneLabel={step + 1 >= plan.length ? 'Xem kết quả' : 'Tiếp tục'}
        />
      )}

      {current.type === 'dictation' && (
        <DictationExercise
          key={step}
          text={current.sentence.text}
          meaning={current.sentence.meaning_vi}
          youglishQuery={current.sentence.youglish_query}
          level={current.sentence.level}
          sentenceId={current.sentence.id}
          rate={rate}
          onRateChange={setRate}
          onDone={(r) => {
            setResults((res) => ({ ...res, dictation: [...res.dictation, r] }))
            next()
          }}
          doneLabel={step + 1 >= plan.length ? 'Xem kết quả' : 'Tiếp tục'}
        />
      )}

      <button type="button" className="btn btn-ghost btn-block finish-early" onClick={finishEarly}>
        Dừng ở đây cũng được
      </button>
    </div>
  )
}
