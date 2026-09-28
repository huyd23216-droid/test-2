import { useEffect, useState } from 'react'
import SpeakButton from './SpeakButton.jsx'
import YouGlishButton from './YouGlishButton.jsx'
import { GRADES, GRADE_LABELS, nextIntervals } from '../lib/srs.js'
import { describeInterval, todayString } from '../lib/dates.js'
import { posLabel } from '../lib/labels.js'

// Thẻ từ vựng: mặt trước là từ + nút nghe, lật ra mặt sau để xem nghĩa và chấm.
// Trên máy tính: phím Space để lật, phím 1–4 để chấm.
export default function Flashcard({ card, rate, retention, onGrade, badge }) {
  const [flipped, setFlipped] = useState(false)
  const intervals = nextIntervals(card, todayString(), retention)

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return
      if (!flipped && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setFlipped(true)
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
        onGrade(GRADES[Number(e.key) - 1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, onGrade])

  return (
    <div className="flashcard">
      <div
        className={`fc-face ${flipped ? 'is-flipped' : 'is-front'}`}
        onClick={() => setFlipped(true)}
        role={flipped ? undefined : 'button'}
        tabIndex={flipped ? undefined : 0}
        aria-label={flipped ? undefined : 'Lật thẻ'}
      >
        {badge && <span className="badge badge-new">{badge}</span>}
        <div className="fc-word-row">
          <h2 className="fc-word" lang="en">
            {card.word}
          </h2>
          <SpeakButton text={card.word} rate={rate} variant="icon" label="Nghe từ" />
        </div>

        {flipped ? (
          <div className="fc-back">
            <p className="fc-ipa">
              {card.ipa && <span lang="en">{card.ipa}</span>}
              {card.pos && <span className="fc-pos">{posLabel(card.pos)}</span>}
            </p>
            <p className="fc-meaning">{card.meaning_vi}</p>
            {card.example_en && (
              <div className="fc-example">
                <div className="fc-example-en">
                  <p lang="en">{card.example_en}</p>
                  <SpeakButton text={card.example_en} rate={rate} variant="icon" label="Nghe câu ví dụ" />
                </div>
                {card.example_vi && <p className="muted">{card.example_vi}</p>}
              </div>
            )}
          </div>
        ) : (
          <p className="fc-tap">Nhớ nghĩa rồi chạm để lật thẻ</p>
        )}

        <YouGlishButton query={card.youglish_query || card.word} compact />
      </div>

      {flipped ? (
        <div className="grades">
          {GRADES.map((g, i) => (
            <button key={g} type="button" className={`grade grade-${g}`} onClick={() => onGrade(g)}>
              <span className="grade-label">{GRADE_LABELS[g]}</span>
              <span className="grade-when">
                {g === 'again' ? 'ôn lại ngay' : describeInterval(intervals[g])}
              </span>
              <kbd className="grade-key">{i + 1}</kbd>
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => setFlipped(true)}>
          Lật thẻ
        </button>
      )}
    </div>
  )
}
