import { useEffect, useMemo, useRef, useState } from 'react'
import PassageSpeaker from './PassageSpeaker.jsx'
import {
  SET_ITEM_TYPES,
  clozeBlankNumbers,
  clozeSpeechLines,
  gradeBlank,
  parseCloze,
  reviewBank,
} from '../lib/homeworkSets.js'

const isTyping = (el) => Boolean(el?.closest?.('input, textarea, select'))

// Câu "cloze": một đoạn văn dài có chỗ trống đánh số, điền bằng các từ trong ngân hàng từ.
// - dueBlanks: chỉ các chỗ này được điền (lượt ôn câu sai); chỗ khác điền sẵn và khóa.
// - shown: { [n]: { answer, isCorrect } } để xem lại bài đã làm (không tương tác).
// onAnswer([{ n, answer, isCorrect }]) được gọi một lần khi bấm Kiểm tra.
export default function ClozeItem({ item, dueBlanks, shown, source, rate = 1, onAnswer, onNext, nextLabel }) {
  const numbers = useMemo(() => clozeBlankNumbers(item.text), [item.text])
  const lines = useMemo(() => parseCloze(item.text), [item.text])
  const locked = useMemo(
    () => (dueBlanks ? numbers.filter((n) => !dueBlanks.includes(n)) : []),
    [numbers, dueBlanks],
  )
  const active = numbers.filter((n) => !locked.includes(n))
  const [bank] = useState(() => (dueBlanks ? reviewBank(item, dueBlanks) : item.bank))
  const [fill, setFill] = useState({}) // số chỗ trống → vị trí từ trong ngân hàng
  const [selected, setSelected] = useState(() => active[0] ?? null)
  const [result, setResult] = useState(null) // số chỗ trống → { answer, isCorrect }
  const bankRef = useRef(null)
  const slotRefs = useRef({})
  const nextRef = useRef(null)

  const outcome = shown ?? result
  const used = new Set(Object.values(fill))
  const allFilled = active.every((n) => fill[n] !== undefined)
  // Chỗ trống đủ rộng cho từ dài nhất trong ngân hàng
  const slotWidth = Math.max(...[...item.bank, ...numbers.map((n) => item.blanks[n].answer)].map((w) => w.length))

  // Chỗ trống đang chọn luôn nằm trong tầm nhìn, không bị ngân hàng từ che
  useEffect(() => {
    const el = selected != null ? slotRefs.current[selected] : null
    if (!el) return
    const top = el.getBoundingClientRect().top
    const covered = (bankRef.current?.offsetHeight ?? 0) + 12
    if (top < covered || top > window.innerHeight - 60) {
      window.scrollBy({ top: top - covered - 80, behavior: 'smooth' })
    }
  }, [selected])

  useEffect(() => {
    if (result) nextRef.current?.focus()
  }, [result])

  const nextEmpty = (after, filled) => {
    const start = active.indexOf(after)
    for (let k = 1; k <= active.length; k++) {
      const n = active[(start + k) % active.length]
      if (filled[n] === undefined) return n
    }
    return null
  }

  const tapBlank = (n) => {
    if (outcome) return
    if (fill[n] !== undefined) {
      // Trả từ về ngân hàng
      const next = { ...fill }
      delete next[n]
      setFill(next)
    }
    setSelected(n)
  }

  const tapChip = (i) => {
    if (outcome || used.has(i) || selected == null) return
    const next = { ...fill, [selected]: i }
    setFill(next)
    setSelected(nextEmpty(selected, next))
  }

  const check = () => {
    if (outcome || !allFilled) return
    const res = {}
    const list = active.map((n) => {
      const answer = bank[fill[n]]
      const isCorrect = gradeBlank(item.blanks[n], answer)
      res[n] = { answer, isCorrect }
      return { n, answer, isCorrect }
    })
    setResult(res)
    setSelected(null)
    onAnswer?.(list)
  }

  useEffect(() => {
    if (shown) return undefined
    const onKey = (e) => {
      if (e.key !== 'Enter' || isTyping(e.target) || e.target?.tagName === 'BUTTON') return
      if (!result && allFilled) {
        e.preventDefault()
        check()
      } else if (result) {
        e.preventDefault()
        onNext?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const renderBlank = (n) => {
    const style = { minWidth: `min(${slotWidth + 2}ch, 100%)` }
    const correct = item.blanks[n].answer
    if (locked.includes(n)) {
      return (
        <span key={`b${n}`} className="cloze-slot is-locked" style={style} aria-label={`Chỗ trống ${n}: ${correct}`}>
          {correct}
        </span>
      )
    }
    if (outcome) {
      const r = outcome[n]
      return (
        <span key={`b${n}`} className={`cloze-slot is-checked ${r?.isCorrect ? 'is-ok' : 'is-bad'}`} style={style}>
          <span className="cloze-word">{r?.answer ?? '—'}</span>
          {!r?.isCorrect && <span className="cloze-fix">{correct}</span>}
        </span>
      )
    }
    const word = fill[n] !== undefined ? bank[fill[n]] : null
    return (
      <button
        key={`b${n}`}
        ref={(el) => (slotRefs.current[n] = el)}
        type="button"
        className={`cloze-slot ${word ? 'is-filled' : ''} ${selected === n ? 'is-selected' : ''}`}
        style={style}
        onClick={() => tapBlank(n)}
        aria-pressed={selected === n}
        aria-label={word ? `Chỗ trống ${n}: ${word}. Chạm để bỏ từ này` : `Chỗ trống ${n}, còn trống`}
      >
        {word ?? <span className="cloze-num">{n}</span>}
      </button>
    )
  }

  const wrong = outcome ? active.filter((n) => outcome[n] && !outcome[n].isCorrect) : []
  const right = outcome ? active.filter((n) => outcome[n]?.isCorrect).length : 0

  return (
    <div className="exercise cloze">
      {!shown && (
        <div className="set-item-head">
          <span className="badge">{SET_ITEM_TYPES.cloze}</span>
          {source && <span className="muted set-source">{source}</span>}
        </div>
      )}

      {!outcome && (
        <div className="cloze-bank" ref={bankRef}>
          <div className="cloze-chips" role="group" aria-label="Ngân hàng từ">
            {bank.map((w, i) => (
              <button
                key={i}
                type="button"
                className={`cloze-chip ${used.has(i) ? 'is-used' : ''}`}
                disabled={used.has(i)}
                onClick={() => tapChip(i)}
                lang="en"
              >
                {w}
              </button>
            ))}
          </div>
          <p className="hint cloze-hint">
            {selected != null
              ? `Chọn từ cho chỗ trống số ${selected}.`
              : allFilled
                ? 'Đã điền đủ. Bấm Kiểm tra nhé.'
                : 'Chạm vào một chỗ trống để chọn.'}
          </p>
        </div>
      )}

      <div className="cloze-passage" lang="en">
        {lines.map((line, i) => (
          <p key={i} className="cloze-line">
            {line.speaker && <strong className="cloze-speaker">{line.speaker}: </strong>}
            {line.parts.map((p, j) => (p.type === 'text' ? <span key={j}>{p.text}</span> : renderBlank(p.n)))}
          </p>
        ))}
      </div>

      {!outcome && (
        <button type="button" className="btn btn-primary btn-block btn-lg" disabled={!allFilled} onClick={check}>
          Kiểm tra
        </button>
      )}

      {outcome && (
        <>
          <div className={`hw-feedback ${wrong.length ? 'is-wrong' : 'is-correct'}`} role="status">
            <p className="hw-verdict">
              {wrong.length === 0
                ? `Đúng hết ${active.length}/${active.length} chỗ trống! 🎉`
                : `Đúng ${right}/${active.length} chỗ trống. Không sao cả, xem lại các chỗ chưa đúng nhé.`}
            </p>
            {wrong.length > 0 && (
              <ul className="cloze-explain">
                {wrong.map((n) => (
                  <li key={n}>
                    <span className="cloze-num">{n}</span>
                    <span>
                      <strong lang="en">{item.blanks[n].answer}</strong>
                      {item.blanks[n].explain_vi ? ` · ${item.blanks[n].explain_vi}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {wrong.length > 0 && !shown && (
              <p className="hint">Các chỗ chưa đúng sẽ quay lại ở mục Ôn câu sai vào ngày mai.</p>
            )}
            <div className="button-row">
              <PassageSpeaker lines={clozeSpeechLines(item)} rate={rate} />
            </div>
          </div>
          {onNext && (
            <button ref={nextRef} type="button" className="btn btn-primary btn-block btn-lg" onClick={onNext}>
              {nextLabel}
            </button>
          )}
        </>
      )}
    </div>
  )
}
