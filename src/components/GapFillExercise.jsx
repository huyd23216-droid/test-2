import { useEffect, useRef, useState } from 'react'
import RateSelector from './RateSelector.jsx'
import SpeakButton from './SpeakButton.jsx'
import YouGlishButton from './YouGlishButton.jsx'
import { useData } from '../context/DataContext.jsx'
import { useTracker } from '../context/StudyTracker.jsx'
import { GAPS_PER_LEVEL, checkGap, makeGaps } from '../lib/gapfill.js'

// Nghe câu và điền các từ còn thiếu
export default function GapFillExercise({ sentence, rate, onRateChange, onDone, doneLabel = 'Câu tiếp theo' }) {
  const { recordListening } = useData()
  const tracker = useTracker()
  const [parts] = useState(() => makeGaps(sentence.text, GAPS_PER_LEVEL[sentence.level] ?? 3))
  const gaps = parts.filter((p) => p.type === 'gap')
  const [values, setValues] = useState(() => gaps.map(() => ''))
  const [marks, setMarks] = useState(null) // mảng true/false sau khi kiểm tra
  const inputs = useRef([])
  const nextRef = useRef(null)

  useEffect(() => {
    if (marks) nextRef.current?.focus()
  }, [marks])

  const check = () => {
    if (marks) return
    const result = gaps.map((g) => checkGap(g.answer, values[g.n]))
    setMarks(result)
    const score = result.filter(Boolean).length / result.length
    recordListening(`gap:${sentence.id}`, 'gapfill', score)
    tracker.addActivity('gapfill')
  }

  const onKeyDown = (e, n) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (n + 1 < gaps.length) inputs.current[n + 1]?.focus()
    else check()
  }

  const correct = marks ? marks.filter(Boolean).length : 0

  return (
    <div className="exercise">
      <div className="prompt">
        <SpeakButton text={sentence.text} rate={rate} variant="big" label="Nghe câu" prefetch />
        {onRateChange && <RateSelector value={rate} onChange={onRateChange} />}
      </div>

      <p className="gap-sentence" lang="en">
        {parts.map((p, i) =>
          p.type === 'text' ? (
            <span key={i}>{p.text}</span>
          ) : (
            <span key={i} className="gap-slot">
              <input
                ref={(el) => (inputs.current[p.n] = el)}
                className={`gap-input ${marks ? (marks[p.n] ? 'is-ok' : 'is-bad') : ''}`}
                style={{ width: `${Math.max(3, p.answer.length + 1)}ch` }}
                value={values[p.n]}
                disabled={Boolean(marks)}
                onChange={(e) => setValues((v) => v.map((x, j) => (j === p.n ? e.target.value : x)))}
                onKeyDown={(e) => onKeyDown(e, p.n)}
                aria-label={`Chỗ trống ${p.n + 1}`}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint={p.n + 1 < gaps.length ? 'next' : 'done'}
              />
              {marks && !marks[p.n] && <span className="gap-fix">{p.answer}</span>}
            </span>
          ),
        )}
      </p>

      {!marks ? (
        <button type="button" className="btn btn-primary btn-block btn-lg" onClick={check}>
          Kiểm tra
        </button>
      ) : (
        <>
          <div className="diff">
            <p className="diff-score">
              <strong>
                Đúng {correct}/{gaps.length} chỗ trống
              </strong>{' '}
              · {correct === gaps.length ? 'Hoàn hảo! 🎉' : 'Nghe lại và để ý những từ nhỏ nhé.'}
            </p>
            <p className="diff-answer">
              <span className="label">Cả câu</span>
              <span lang="en">{sentence.text}</span>
            </p>
            <p className="muted">Nghĩa: {sentence.meaning_vi}</p>
          </div>
          <div className="button-row">
            <SpeakButton text={sentence.text} rate={rate} label="Nghe lại" />
            <YouGlishButton query={sentence.youglish_query} />
          </div>
          <button ref={nextRef} type="button" className="btn btn-primary btn-block btn-lg" onClick={() => onDone(correct / gaps.length)}>
            {doneLabel}
          </button>
        </>
      )}
    </div>
  )
}
