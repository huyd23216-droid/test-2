import { useEffect, useRef, useState } from 'react'
import AnswerBox from './AnswerBox.jsx'
import DiffView from './DiffView.jsx'
import RateSelector from './RateSelector.jsx'
import SpeakButton from './SpeakButton.jsx'
import YouGlishButton from './YouGlishButton.jsx'
import { useData } from '../context/DataContext.jsx'
import { useTracker } from '../context/StudyTracker.jsx'
import { CS_GROUP_BY_ID } from '../lib/content.js'
import { gradeAnswer } from '../lib/grading.js'

// mode "read": hiện cách đọc rút gọn, gõ lại câu đầy đủ
// mode "listen": nghe câu, gõ lại câu đầy đủ
export default function ConnectedSpeechExercise({ item, mode, rate, onRateChange, onDone, doneLabel = 'Câu tiếp theo' }) {
  const { recordConnectedSpeech } = useData()
  const tracker = useTracker()
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const nextRef = useRef(null)
  const group = CS_GROUP_BY_ID[item.group]

  useEffect(() => {
    if (result) nextRef.current?.focus()
  }, [result])

  const check = () => {
    if (result) return
    const r = gradeAnswer(item.full, answer)
    setResult(r)
    recordConnectedSpeech(item.id, r, mode)
    tracker.addActivity('connected_speech')
  }

  return (
    <div className="exercise">
      <div className="exercise-head">
        <span className="badge">{group?.name ?? item.group}</span>
      </div>

      {mode === 'read' ? (
        <div className="prompt">
          <p className="prompt-label">Người bản xứ nói:</p>
          <p className="reduced" lang="en">
            “{item.reduced}”
          </p>
          <p className="hint">Gõ lại câu đầy đủ theo cách viết chuẩn.</p>
        </div>
      ) : (
        <div className="prompt">
          <p className="prompt-label">Nghe rồi gõ lại câu đầy đủ</p>
          <SpeakButton text={item.full} rate={rate} variant="big" label="Nghe câu" />
          {onRateChange && <RateSelector value={rate} onChange={onRateChange} />}
        </div>
      )}

      <AnswerBox value={answer} onChange={setAnswer} onSubmit={check} disabled={!!result} placeholder="Gõ câu đầy đủ…" />

      {!result ? (
        <button type="button" className="btn btn-primary btn-block btn-lg" onClick={check}>
          Kiểm tra
        </button>
      ) : (
        <>
          <DiffView result={result} answerText={item.full} />
          <div className="explain">
            <p>
              <span className="label">Người bản xứ nói</span>
              <span lang="en" className="reduced-small">“{item.reduced}”</span>
            </p>
            <p>{item.note_vi}</p>
            <p className="muted">Nghĩa: {item.meaning_vi}</p>
          </div>
          <div className="button-row">
            <SpeakButton text={item.full} rate={rate} label="Nghe lại" />
            <YouGlishButton query={item.youglish_query} />
          </div>
          <button ref={nextRef} type="button" className="btn btn-primary btn-block btn-lg" onClick={() => onDone(result)}>
            {doneLabel}
          </button>
        </>
      )}
    </div>
  )
}
