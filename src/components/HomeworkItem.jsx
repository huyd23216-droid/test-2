import { useEffect, useMemo, useRef, useState } from 'react'
import SpeakButton from './SpeakButton.jsx'
import YouGlishButton from './YouGlishButton.jsx'
import { HOMEWORK_TYPES, checkAnswer } from '../lib/homework.js'
import { posLabel } from '../lib/labels.js'

const PRAISE = ['Chính xác! 🎉', 'Đúng rồi, giỏi lắm!', 'Tuyệt vời!', 'Chuẩn luôn! 👏']

const INPUT_MODE = { digits: 'numeric', money: 'decimal' }

// Một câu bài tập: hiện đề, nhận câu trả lời, chấm và giải thích.
// onAnswered(result) được gọi ngay khi chấm (để lưu tiến độ); onNext() khi bấm sang câu sau.
export default function HomeworkItem({ item, rate, onAnswered, onNext, nextLabel }) {
  const [value, setValue] = useState('')
  const [picked, setPicked] = useState(null)
  const [order, setOrder] = useState([]) // chỉ số các mảnh đã chọn (bài sắp xếp câu)
  const [hint, setHint] = useState(false)
  const [outcome, setOutcome] = useState(null) // { result, note }
  const [praise] = useState(() => PRAISE[Math.floor(Math.random() * PRAISE.length)])
  const inputRef = useRef(null)
  const nextRef = useRef(null)

  useEffect(() => {
    if (outcome) nextRef.current?.focus()
    else if (item.check.kind !== 'choice' && item.type !== 'order') inputRef.current?.focus({ preventScroll: true })
  }, [outcome, item])

  const submit = (answer) => {
    if (outcome) return
    const res = checkAnswer(item, answer)
    // Dùng gợi ý chữ đầu mà vẫn đúng thì tính là "gần đúng" để mai ôn lại
    const final = res.result === 'correct' && hint ? { result: 'close', note: 'Đúng rồi! Lần sau thử không cần gợi ý nhé.' } : res
    setOutcome(final)
    onAnswered(final.result, answer)
  }

  const onKeyDown = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (outcome) onNext()
    else if (value.trim()) submit(value)
  }

  const typeInfo = HOMEWORK_TYPES[item.type]

  return (
    <div className="exercise hw-item">
      <span className="badge hw-type">{item.fromDictation ? 'Từ bạn hay chép sai' : typeInfo?.label}</span>
      <Prompt item={item} rate={rate} hint={hint} />

      {item.check.kind === 'choice' ? (
        <div className="stack">
          {item.options.map((opt, i) => {
            let state = ''
            if (outcome && i === item.check.index) state = 'is-ok'
            else if (outcome && i === picked) state = 'is-bad'
            return (
              <div key={i} className={`choice ${state}`}>
                <button
                  type="button"
                  className="choice-main"
                  disabled={Boolean(outcome)}
                  onClick={() => {
                    setPicked(i)
                    submit(i)
                  }}
                >
                  {opt}
                </button>
              </div>
            )
          })}
        </div>
      ) : item.type === 'order' ? (
        <OrderBoard item={item} order={order} setOrder={setOrder} locked={Boolean(outcome)} onCheck={submit} />
      ) : (
        <div className="stack">
          <input
            ref={inputRef}
            className={`hw-input ${outcome ? `is-${outcome.result}` : ''}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={Boolean(outcome)}
            placeholder={item.hint ?? 'Gõ câu trả lời'}
            aria-label="Câu trả lời"
            inputMode={INPUT_MODE[item.check.kind] ?? 'text'}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="done"
            lang="en"
          />
          {!outcome && (
            <div className="button-row">
              {item.type === 'meaning' && !hint && (
                <button type="button" className="btn btn-ghost" onClick={() => setHint(true)}>
                  Gợi ý chữ đầu
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-lg hw-check"
                disabled={!value.trim()}
                onClick={() => submit(value)}
              >
                Kiểm tra
              </button>
            </div>
          )}
        </div>
      )}

      {outcome && (
        <>
          <Feedback item={item} outcome={outcome} praise={praise} rate={rate} />
          <button ref={nextRef} type="button" className="btn btn-primary btn-block btn-lg" onClick={onNext}>
            {nextLabel}
          </button>
        </>
      )}
    </div>
  )
}

function Prompt({ item, rate, hint }) {
  switch (item.type) {
    case 'meaning':
      return (
        <div className="prompt hw-prompt">
          <p className="hw-meaning">{item.meaning}</p>
          {item.pos && <p className="muted">{posLabel(item.pos)}</p>}
          <p className="hw-slots" aria-label={`Từ có ${item.answer.length} chữ cái`}>
            {item.answer.split('').map((ch, i) => (
              <span key={i}>{i === 0 && hint ? ch : '_'}</span>
            ))}
          </p>
          <p className="hint">Gõ từ tiếng Anh có nghĩa như trên ({item.answer.length} chữ cái).</p>
        </div>
      )
    case 'cloze':
      return (
        <div className="prompt hw-prompt">
          <p className="hw-sentence" lang="en">
            {item.before}
            <span className="hw-blank">{'_'.repeat(Math.max(4, item.answer.length))}</span>
            {item.after}
          </p>
          {item.exampleVi && <p className="muted">{item.exampleVi}</p>}
          <p className="hint">
            Gợi ý: từ có nghĩa “{item.meaning}”. Nhớ chia đúng dạng (thêm -s, -ed, -ing… nếu cần).
          </p>
        </div>
      )
    case 'listen-meaning':
      return (
        <div className="prompt hw-prompt">
          <SpeakButton text={item.audio.text} rate={rate} variant="big" label="Nghe từ" autoPlay prefetch />
          <p className="hint">Nghe từ (không nhìn chữ) rồi chọn nghĩa đúng.</p>
        </div>
      )
    case 'listen-spell':
      return (
        <div className="prompt hw-prompt">
          <SpeakButton text={item.audio.text} rate={rate} variant="big" label="Nghe từ" autoPlay prefetch />
          <p className="hint">Nghe và viết lại từ đó cho đúng chính tả.</p>
        </div>
      )
    case 'order':
      return (
        <div className="prompt hw-prompt">
          {item.exampleVi && <p className="hw-meaning">{item.exampleVi}</p>}
          <p className="hint">Chạm vào các mảnh theo thứ tự để ghép thành câu tiếng Anh đúng.</p>
        </div>
      )
    case 'numbers':
    case 'spelling':
      return (
        <div className="prompt hw-prompt">
          <SpeakButton
            text={item.audio.text}
            rate={rate}
            variant="big"
            label="Nghe"
            accent={item.audio.accent}
            autoPlay
            prefetch
          />
          <p className="hint">
            {item.type === 'numbers'
              ? 'Nghe và ghi lại thông tin như trong bài thi IELTS Listening Part 1.'
              : 'Nghe người nói đánh vần từng chữ cái rồi ghi lại tên.'}
          </p>
        </div>
      )
    default:
      return null
  }
}

function OrderBoard({ item, order, setOrder, locked, onCheck }) {
  const chosen = new Set(order)
  const sentence = useMemo(() => order.map((i) => item.tokens[i]).join(' '), [order, item.tokens])
  return (
    <div className="stack">
      <div className="order-line" aria-label="Câu bạn đang ghép" lang="en">
        {order.length === 0 && <span className="muted">Câu của bạn sẽ hiện ở đây</span>}
        {order.map((i) => (
          <button
            key={i}
            type="button"
            className="tile tile-placed"
            disabled={locked}
            onClick={() => setOrder(order.filter((x) => x !== i))}
          >
            {item.tokens[i]}
          </button>
        ))}
      </div>
      <div className="order-tiles" lang="en">
        {item.tokens.map((t, i) => (
          <button
            key={i}
            type="button"
            className="tile"
            disabled={locked || chosen.has(i)}
            onClick={() => setOrder([...order, i])}
          >
            {t}
          </button>
        ))}
      </div>
      {!locked && (
        <div className="button-row">
          <button type="button" className="btn btn-ghost" disabled={!order.length} onClick={() => setOrder([])}>
            Xếp lại
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg hw-check"
            disabled={order.length !== item.tokens.length}
            onClick={() => onCheck(sentence)}
          >
            Kiểm tra
          </button>
        </div>
      )}
    </div>
  )
}

function Feedback({ item, outcome, praise, rate }) {
  const { result, note } = outcome
  const spaced = !item.stat
  const verdict = result === 'correct' ? praise : result === 'close' ? 'Gần đúng rồi!' : 'Chưa đúng lần này, không sao cả.'
  const showAnswer = result !== 'correct' && item.check.kind !== 'choice'
  return (
    <div className={`hw-feedback is-${result}`} role="status">
      <p className="hw-verdict">{verdict}</p>
      {note && <p>{note}</p>}
      {showAnswer && (
        <p className="diff-answer">
          <span className="label">Đáp án</span>
          <strong lang="en">{item.answer}</strong>
        </p>
      )}

      {item.cardId && (
        <div className="hw-detail">
          <p lang="en">
            <strong>{item.word}</strong> {item.ipa && <span className="muted">{item.ipa}</span>}
          </p>
          <p>{item.meaning}</p>
          {item.example && (
            <p lang="en" className="hw-example">
              {item.example}
            </p>
          )}
          {item.exampleVi && <p className="muted">{item.exampleVi}</p>}
          <div className="button-row">
            <SpeakButton text={item.word} rate={rate} label="Nghe từ" />
            {item.example && <SpeakButton text={item.example} rate={rate} label="Nghe câu" />}
            <YouGlishButton query={item.word} />
          </div>
        </div>
      )}

      {item.fromDictation && (
        <div className="hw-detail">
          {item.example && (
            <p lang="en" className="hw-example">
              {item.example}
            </p>
          )}
          <div className="button-row">
            <SpeakButton text={item.word} rate={rate} label="Nghe từ" />
            <YouGlishButton query={item.word} />
          </div>
        </div>
      )}

      {(item.type === 'numbers' || item.type === 'spelling') && (
        <div className="hw-detail">
          <p className="label">Câu vừa nghe</p>
          <p lang="en" className="hw-example">
            {item.audio.text}
          </p>
          <div className="button-row">
            <SpeakButton text={item.audio.text} rate={rate} label="Nghe lại" accent={item.audio.accent} />
          </div>
        </div>
      )}

      {result !== 'correct' && (
        <p className="hint">
          {spaced
            ? 'Câu này sẽ quay lại trong bài ngày mai để bạn thử lại.'
            : 'Dạng này sẽ được ra nhiều hơn trong các bài sau để bạn quen tai.'}
        </p>
      )}
    </div>
  )
}
