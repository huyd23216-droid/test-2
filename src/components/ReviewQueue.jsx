import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Flashcard from './Flashcard.jsx'
import ProgressBar from './ProgressBar.jsx'
import { useData } from '../context/DataContext.jsx'
import { useTracker } from '../context/StudyTracker.jsx'
import { isNewCard } from '../lib/srs.js'

const MAX_REPEATS = 2 // thẻ bấm "Quên" được đưa lại cuối hàng tối đa 2 lần mỗi lượt

export default function ReviewQueue({ cardIds, onAnswer, onFinish }) {
  const { cards, gradeCard, settings } = useData()
  const tracker = useTracker()
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])

  const [queue, setQueue] = useState(() => cardIds.map((id) => ({ id, repeats: 0 })))
  const [pos, setPos] = useState(0)
  const stats = useRef({ reviewed: 0, learnedNew: 0, again: 0, hard: 0, good: 0, easy: 0 })
  const finished = useRef(false)

  // Bỏ qua thẻ đã bị xóa (vd xóa ở thiết bị khác trong lúc đang ôn)
  let index = pos
  while (index < queue.length && !byId.has(queue[index].id)) index++
  const item = queue[index]
  const card = item ? byId.get(item.id) : null

  useEffect(() => {
    if (index >= queue.length && !finished.current) {
      finished.current = true
      onFinish?.({ ...stats.current })
    }
  }, [index, queue.length, onFinish])

  const handleGrade = useCallback(
    (grade) => {
      if (!card) return
      const wasNew = isNewCard(card)
      gradeCard(card, grade)
      tracker.addActivity(wasNew ? 'vocab_new' : 'vocab_review')
      const s = stats.current
      s[grade] += 1
      if (wasNew) s.learnedNew += 1
      else s.reviewed += 1
      onAnswer?.({ grade, wasNew })
      if (grade === 'again' && item.repeats < MAX_REPEATS) {
        setQueue((q) => [...q, { id: item.id, repeats: item.repeats + 1 }])
      }
      setPos(index + 1)
    },
    [card, item, index, gradeCard, tracker, onAnswer],
  )

  if (!card) return null

  return (
    <div className="review">
      <ProgressBar value={index} max={queue.length} label={`${index + 1}/${queue.length}`} />
      <Flashcard
        key={`${card.id}-${index}`}
        card={card}
        rate={settings?.tts_rate ?? 1}
        retention={Number(settings?.desired_retention) || undefined}
        onGrade={handleGrade}
        badge={isNewCard(card) ? 'Từ mới' : null}
      />
    </div>
  )
}
