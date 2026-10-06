import { useEffect, useRef, useState } from 'react'
import { SET_ITEM_TYPES, gradeItem, splitGap } from '../lib/homeworkSets.js'

const PRAISE = ['Chính xác! 🎉', 'Đúng rồi, giỏi lắm!', 'Tuyệt vời!', 'Chuẩn luôn! 👏']
const isTyping = (el) => Boolean(el?.closest?.('input, textarea, select'))

// Một câu trong bộ bài tập: chấm ngay khi trả lời và hiện giải thích.
// Bàn phím: 1–4 để chọn đáp án trắc nghiệm, Enter để kiểm tra / sang câu sau.
export default function SetItem({ item, source, onAnswer, onNext, nextLabel }) {
  const [value, setValue] = useState(() => (item.type === 'fix' ? item.prompt : ''))
  const [picked, setPicked] = useState(null)
  const [result, setResult] = useState(null) // { isCorrect: true | false | null }
  const [praise] = useState(() => PRAISE[Math.floor(Math.random() * PRAISE.length)])
  const inputRef = useRef(null)
  const nextRef = useRef(null)

  const submit = (answer) => {
    if (result) return
    const isCorrect = gradeItem(item, answer)
    setResult({ isCorrect })
    onAnswer(answer, isCorrect)
  }

  useEffect(() => {
    if (result) nextRef.current?.focus()
    else inputRef.current?.focus({ preventScroll: true })
  }, [result])

  // Phím tắt giống màn hình ôn thẻ
  useEffect(() => {
    const onKey = (e) => {
      if (isTyping(e.target)) return
      if (!result && item.type === 'mcq' && /^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1
        if (i < item.options.length) {
          e.preventDefault()
          setPicked(i)
          submit(item.options[i])
        }
      } else if (result && e.key === 'Enter' && e.target?.tagName !== 'BUTTON') {
        e.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onInputKey = (e) => {
    if (e.key !== 'Enter') return
    if (item.type === 'write' && !(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    if (!result && value.trim()) submit(value)
  }

  const gap = item.type === 'gap' ? splitGap(item.prompt) : null
  const inputProps = {
    ref: inputRef,
    value,
    disabled: Boolean(result),
    onChange: (e) => setValue(e.target.value),
    onKeyDown: onInputKey,
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'none',
    spellCheck: false,
    lang: 'en',
  }
  const inputState = result ? (result.isCorrect ? 'is-ok' : result.isCorrect === false ? 'is-bad' : '') : ''

  return (
    <div className="exercise set-item">
      <div className="set-item-head">
        <span className="badge">{SET_ITEM_TYPES[item.type]}</span>
        {source && <span className="muted set-source">{source}</span>}
      </div>

      {item.type === 'mcq' && (
        <>
          <p className="set-prompt" lang="en">
            {item.prompt}
          </p>
          <div className="stack">
            {item.options.map((opt, i) => {
              let state = ''
              if (result && opt === item.answer) state = 'is-ok'
              else if (result && i === picked) state = 'is-bad'
              return (
                <div key={i} className={`choice ${state}`}>
                  <button
                    type="button"
                    className="choice-main"
                    disabled={Boolean(result)}
                    onClick={() => {
                      setPicked(i)
                      submit(opt)
                    }}
                    lang="en"
                  >
                    {item.options.length <= 9 && <span className="choice-key">{i + 1}</span>}
                    {opt}
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {item.type === 'gap' &&
        (gap ? (
          <p className="set-prompt gap-sentence" lang="en">
            {gap.before}
            <input
              {...inputProps}
              className={`gap-input ${inputState}`}
              style={{ width: `${Math.max(6, value.length + 2, (item.answer?.length ?? 0) + 2)}ch` }}
              aria-label="Điền vào chỗ trống"
              enterKeyHint="done"
            />
            {gap.after}
          </p>
        ) : (
          <>
            <p className="set-prompt" lang="en">
              {item.prompt}
            </p>
            <input {...inputProps} className={`hw-input ${inputState}`} aria-label="Câu trả lời" enterKeyHint="done" />
          </>
        ))}

      {item.type === 'fix' && (
        <>
          <p className="label">Câu sai</p>
          <p className="set-prompt set-wrong" lang="en">
            {item.prompt}
          </p>
          <textarea
            {...inputProps}
            className={`set-text ${inputState}`}
            rows={2}
            aria-label="Câu đã sửa"
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (!result && value.trim()) submit(value)
              }
            }}
          />
          {!result && <p className="hint">Sửa lại câu ở trên cho đúng rồi bấm Kiểm tra (hoặc Enter).</p>}
        </>
      )}

      {item.type === 'write' && (
        <>
          <p className="set-prompt">{item.prompt}</p>
          <textarea
            {...inputProps}
            className="set-text set-write"
            rows={6}
            aria-label="Bài viết của bạn"
            placeholder="Viết bằng tiếng Anh…"
          />
          {!result && <p className="hint">Câu này không chấm tự động. Viết xong bấm Nộp bài (hoặc Ctrl + Enter).</p>}
        </>
      )}

      {!result && item.type !== 'mcq' && (
        <button
          type="button"
          className="btn btn-primary btn-block btn-lg"
          disabled={!value.trim() || (item.type === 'fix' && value.trim() === item.prompt.trim())}
          onClick={() => submit(value)}
        >
          {item.type === 'write' ? 'Nộp bài' : 'Kiểm tra'}
        </button>
      )}

      {result && (
        <>
          <div
            className={`hw-feedback ${result.isCorrect ? 'is-correct' : result.isCorrect === false ? 'is-wrong' : 'is-saved'}`}
            role="status"
          >
            <p className="hw-verdict">
              {result.isCorrect === true
                ? praise
                : result.isCorrect === false
                  ? 'Chưa đúng, không sao cả.'
                  : 'Đã lưu bài viết của bạn.'}
            </p>
            {result.isCorrect === false && item.type !== 'mcq' && (
              <p className="diff-answer">
                <span className="label">Đáp án</span>
                <strong lang="en">{item.answer}</strong>
              </p>
            )}
            {item.explain_vi && (
              <p className="set-explain">
                <span className="label">Giải thích</span>
                {item.explain_vi}
              </p>
            )}
            {result.isCorrect === false && <p className="hint">Câu này sẽ quay lại ở mục Ôn câu sai vào ngày mai.</p>}
            {result.isCorrect === null && <p className="hint">Giáo viên sẽ nhận xét sau, nhận xét sẽ hiện trong phần Xem lại bài.</p>}
          </div>
          <button ref={nextRef} type="button" className="btn btn-primary btn-block btn-lg" onClick={onNext}>
            {nextLabel}
          </button>
        </>
      )}
    </div>
  )
}
