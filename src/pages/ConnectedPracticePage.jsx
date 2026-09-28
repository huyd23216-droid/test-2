import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ConnectedSpeechExercise from '../components/ConnectedSpeechExercise.jsx'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { useData } from '../context/DataContext.jsx'
import { useStudyTimer } from '../context/StudyTracker.jsx'
import { CS_GROUP_BY_ID, CS_ITEMS } from '../lib/content.js'
import { orderConnectedSpeech } from '../lib/planner.js'
import { CS_MODES, randomCheer } from '../lib/labels.js'

export default function ConnectedPracticePage() {
  const [params] = useSearchParams()
  const groupId = CS_GROUP_BY_ID[params.get('group')] ? params.get('group') : null
  const mode = params.get('mode') === 'listen' ? 'listen' : 'read'
  const { csProgress, settings } = useData()
  useStudyTimer('free')

  const [round, setRound] = useState(0)
  const [items, setItems] = useState(() =>
    orderConnectedSpeech(groupId ? CS_ITEMS.filter((it) => it.group === groupId) : CS_ITEMS, csProgress),
  )
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState([])
  const [rate, setRate] = useState(settings.tts_rate ?? 1)
  const [cheer] = useState(randomCheer)

  const title = groupId ? CS_GROUP_BY_ID[groupId].name : 'Luyện trộn'
  const item = items[index]

  const restart = () => {
    setItems(orderConnectedSpeech(groupId ? CS_ITEMS.filter((it) => it.group === groupId) : CS_ITEMS, csProgress))
    setIndex(0)
    setResults([])
    setRound((r) => r + 1)
  }

  if (!item) {
    const perfect = results.filter((r) => r.perfect).length
    return (
      <div className="page">
        <PageHeader title={title} back="/connected" />
        <div className="summary">
          <div className="summary-hero">
            <span className="summary-icon" aria-hidden="true">
              <Icon name="star" size={34} />
            </span>
            <h2>Hoàn thành {results.length} câu!</h2>
            <p className="muted">
              {perfect} câu đúng hoàn toàn. {cheer}
            </p>
          </div>
          <div className="stack">
            <button type="button" className="btn btn-primary btn-block btn-lg" onClick={restart}>
              Luyện lại lượt nữa
            </button>
            <Link to="/connected" className="btn btn-secondary btn-block">
              Chọn nhóm khác
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title={title} back="/connected" subtitle={CS_MODES[mode]} />
      <ProgressBar value={index} max={items.length} label={`${index + 1}/${items.length}`} />
      <ConnectedSpeechExercise
        key={`${round}-${index}`}
        item={item}
        mode={mode}
        rate={rate}
        onRateChange={setRate}
        onDone={(r) => {
          setResults((list) => [...list, r])
          setIndex((i) => i + 1)
          window.scrollTo(0, 0)
        }}
        doneLabel={index + 1 >= items.length ? 'Xem kết quả' : 'Câu tiếp theo'}
      />
      <Link to="/connected" className="btn btn-ghost btn-block finish-early">
        Dừng ở đây cũng được
      </Link>
    </div>
  )
}
