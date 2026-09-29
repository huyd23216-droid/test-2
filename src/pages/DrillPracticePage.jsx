import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import RateSelector from '../components/RateSelector.jsx'
import SpeakButton from '../components/SpeakButton.jsx'
import { useData } from '../context/DataContext.jsx'
import { useStudyTimer, useTracker } from '../context/StudyTracker.jsx'
import { DRILL_BY_ID } from '../lib/content.js'
import { randomCheer } from '../lib/labels.js'
import { shuffle } from '../lib/planner.js'

// Một câu hỏi: máy đọc 1 trong các câu, bạn chọn câu nghe được
function DrillQuestion({ item, rate, onRateChange, onDone, doneLabel }) {
  const { recordListening } = useData()
  const tracker = useTracker()
  const [spoken] = useState(() => Math.floor(Math.random() * item.options.length))
  const [options] = useState(() => shuffle(item.options.map((text, i) => ({ text, i }))))
  const [picked, setPicked] = useState(null)
  const nextRef = useRef(null)
  const answered = picked !== null
  const right = picked === spoken

  useEffect(() => {
    if (answered) nextRef.current?.focus()
  }, [answered])

  const choose = (i) => {
    if (answered) return
    setPicked(i)
    recordListening(`drill:${item.id}`, 'drill', i === spoken ? 1 : 0)
    tracker.addActivity('drill')
  }

  return (
    <div className="exercise">
      <div className="prompt">
        <SpeakButton text={item.options[spoken]} rate={rate} variant="big" label="Nghe câu" prefetch />
        {onRateChange && <RateSelector value={rate} onChange={onRateChange} />}
        <p className="hint">Bạn nghe thấy câu nào?</p>
      </div>

      <div className="stack">
        {options.map((opt) => {
          let state = ''
          if (answered && opt.i === spoken) state = 'is-ok'
          else if (answered && opt.i === picked) state = 'is-bad'
          return (
            <div key={opt.i} className={`choice ${state}`}>
              <button type="button" className="choice-main" onClick={() => choose(opt.i)} disabled={answered} lang="en">
                {opt.text}
              </button>
              {answered && <SpeakButton text={opt.text} rate={rate} variant="icon" label="Nghe câu này" />}
            </div>
          )
        })}
      </div>

      {answered && (
        <>
          <p className={`notice ${right ? '' : 'notice-warn'}`}>
            {right
              ? 'Chính xác! 🎉 Bấm nút loa bên cạnh mỗi câu để nghe lại và so sánh.'
              : 'Câu máy đọc là câu viền xanh. Bấm nút loa ở từng câu để nghe và so sánh nhé.'}
          </p>
          <button ref={nextRef} type="button" className="btn btn-primary btn-block btn-lg" onClick={() => onDone(right)}>
            {doneLabel}
          </button>
        </>
      )}
    </div>
  )
}

export default function DrillPracticePage() {
  const { id } = useParams()
  const drill = DRILL_BY_ID[id]
  const { settings } = useData()
  useStudyTimer('free')
  const [round, setRound] = useState(0)
  const [items, setItems] = useState(() => (drill ? shuffle(drill.items) : []))
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState([])
  const [rate, setRate] = useState(settings.tts_rate ?? 1)
  const [cheer] = useState(randomCheer)

  if (!drill) {
    return (
      <div className="page">
        <PageHeader title="Không tìm thấy bài" back="/listen/drills" />
      </div>
    )
  }

  const item = items[index]
  if (!item) {
    const right = results.filter(Boolean).length
    return (
      <div className="page">
        <PageHeader title={drill.name} back="/listen/drills" />
        <div className="summary">
          <div className="summary-hero">
            <span className="summary-icon" aria-hidden="true">
              <Icon name="star" size={34} />
            </span>
            <h2>
              Đúng {right}/{results.length} câu
            </h2>
            <p className="muted">{cheer}</p>
          </div>
          <div className="stack">
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              onClick={() => {
                setItems(shuffle(drill.items))
                setIndex(0)
                setResults([])
                setRound((r) => r + 1)
              }}
            >
              Luyện lại (máy đọc câu khác)
            </button>
            <Link to="/listen/drills" className="btn btn-secondary btn-block">
              Chọn bài khác
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title={drill.name} back="/listen/drills" />
      <ProgressBar value={index} max={items.length} label={`${index + 1}/${items.length}`} />
      <DrillQuestion
        key={`${round}-${index}`}
        item={item}
        rate={rate}
        onRateChange={setRate}
        onDone={(ok) => {
          setResults((list) => [...list, ok])
          setIndex((i) => i + 1)
          window.scrollTo(0, 0)
        }}
        doneLabel={index + 1 >= items.length ? 'Xem kết quả' : 'Câu tiếp theo'}
      />
      <Link to="/listen/drills" className="btn btn-ghost btn-block finish-early">
        Dừng ở đây cũng được
      </Link>
    </div>
  )
}
