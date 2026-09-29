import { useEffect, useMemo, useRef, useState } from 'react'
import AnswerBox from './AnswerBox.jsx'
import DiffView from './DiffView.jsx'
import MistakeWords from './MistakeWords.jsx'
import RateSelector from './RateSelector.jsx'
import SpeakButton from './SpeakButton.jsx'
import YouGlishButton from './YouGlishButton.jsx'
import { useData } from '../context/DataContext.jsx'
import { useTracker } from '../context/StudyTracker.jsx'
import { gradeAnswer } from '../lib/grading.js'
import { missedWords } from '../lib/mistakes.js'

// Bài chép chính tả cho 1 câu.
// - Câu có sẵn: nghe bằng giọng đọc của máy (chỉnh tốc độ, nghe lại thoải mái).
// - Clip thật: truyền `player` (nút mở YouTube) thay cho giọng đọc.
export default function DictationExercise({
  text,
  meaning,
  youglishQuery,
  level = null,
  sentenceId = null,
  clipId = null,
  player = null,
  rate,
  onRateChange,
  onDone,
  doneLabel = 'Câu tiếp theo',
}) {
  const { recordDictation } = useData()
  const tracker = useTracker()
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null)
  const [plays, setPlays] = useState(0)
  const startedAt = useRef(0)
  const nextRef = useRef(null)
  const isClip = Boolean(clipId)
  const missed = useMemo(() => (result ? missedWords(text, answer, result) : []), [result, text, answer])

  useEffect(() => {
    startedAt.current = Date.now()
  }, [])

  useEffect(() => {
    if (result) nextRef.current?.focus()
  }, [result])

  const check = () => {
    if (result) return
    const r = gradeAnswer(text, answer)
    setResult(r)
    recordDictation({
      source: isClip ? 'clip' : 'builtin',
      sentence_id: sentenceId,
      clip_id: clipId,
      level,
      sentence: text,
      answer,
      total_words: r.total,
      correct_words: r.correct,
      wrong_words: r.wrong,
      missing_words: r.missing,
      extra_words: r.extra,
      score: r.score,
      replays: plays,
      rate: isClip ? null : rate,
      duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
    })
    tracker.addActivity(isClip ? 'clip_dictation' : 'dictation')
  }

  return (
    <div className="exercise">
      <div className="prompt">
        {player ?? (
          <>
            <SpeakButton
              text={text}
              rate={rate}
              variant="big"
              label={plays === 0 ? 'Nghe câu' : 'Nghe lại'}
              onPlay={() => setPlays((n) => n + 1)}
            />
            {onRateChange && <RateSelector value={rate} onChange={onRateChange} />}
            <p className="hint">
              {plays === 0 ? 'Nghe bao nhiêu lần cũng được.' : `Đã nghe ${plays} lần. Cứ nghe tiếp nếu cần nhé.`}
            </p>
          </>
        )}
      </div>

      <AnswerBox value={answer} onChange={setAnswer} onSubmit={check} disabled={!!result} autoFocus={!isClip} />

      {!result ? (
        <button type="button" className="btn btn-primary btn-block btn-lg" onClick={check}>
          Kiểm tra
        </button>
      ) : (
        <>
          <DiffView result={result} answerText={text} />
          {meaning && <p className="muted meaning">Nghĩa: {meaning}</p>}
          <MistakeWords
            items={missed}
            sentence={text}
            sentenceMeaning={meaning}
            title="Từ bạn chưa nghe ra: bấm để thêm vào thẻ ôn tập"
          />
          <div className="button-row">
            {!isClip && <SpeakButton text={text} rate={rate} label="Nghe lại" />}
            <YouGlishButton query={youglishQuery} />
          </div>
          <button ref={nextRef} type="button" className="btn btn-primary btn-block btn-lg" onClick={() => onDone(result)}>
            {doneLabel}
          </button>
        </>
      )}
    </div>
  )
}
