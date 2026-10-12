import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import SpeakButton from './SpeakButton.jsx'

const ADD_LABELS = { new: '+ Thêm vào thẻ', added: 'Đã thêm ✓', exists: 'Đã có thẻ ✓' }

// Ô nhỏ hiện nghĩa của một từ trong glossary, ngay dưới từ được chạm.
// anchor: nút của từ đó; container: khung đoạn văn (position: relative) chứa ô này.
// status: 'new' | 'added' | 'exists'. Chạm ra ngoài hoặc bấm Esc để đóng.
export default function GlossaryPopover({ term, anchor, container, rate, status, onAdd, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    const place = () => {
      const box = container.getBoundingClientRect()
      const a = anchor.getBoundingClientRect()
      const width = ref.current.offsetWidth
      const center = a.left + a.width / 2 - box.left
      const left = Math.max(0, Math.min(center - width / 2, box.width - width))
      setPos({ left, top: a.bottom - box.top + 6, arrow: Math.max(14, Math.min(center - left, width - 14)) })
    }
    place()
    // Đoạn văn đổi kích thước (xoay màn hình, hiện đáp án sau khi kiểm tra) thì đặt lại
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null
    observer?.observe(container)
    window.addEventListener('resize', place)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [anchor, container])

  // Ô bị khuất ở mép dưới màn hình thì cuộn lên một chút
  const placed = pos != null
  useEffect(() => {
    if (!placed) return
    const bottom = ref.current.getBoundingClientRect().bottom
    const limit = window.innerHeight - 80
    if (bottom > limit) window.scrollBy({ top: bottom - limit, behavior: 'smooth' })
  }, [placed])

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchor.contains(e.target)) return
      onClose()
    }
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      onClose()
      anchor.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchor, onClose])

  return (
    <div
      ref={ref}
      className="gloss-pop"
      role="dialog"
      aria-label={`Nghĩa của “${term.word}”`}
      lang="vi"
      style={pos ? { left: pos.left, top: pos.top, '--arrow-x': `${pos.arrow}px` } : { visibility: 'hidden' }}
    >
      <p className="gloss-word" lang="en">
        {term.word}
      </p>
      <p className="gloss-meaning">{term.meaning}</p>
      <div className="gloss-actions">
        <SpeakButton text={term.word} rate={rate} variant="icon" label="Nghe" />
        <button
          type="button"
          className={`btn btn-sm btn-secondary gloss-add ${status !== 'new' ? 'is-done' : ''}`}
          disabled={status !== 'new'}
          onClick={onAdd}
        >
          {ADD_LABELS[status]}
        </button>
      </div>
    </div>
  )
}
