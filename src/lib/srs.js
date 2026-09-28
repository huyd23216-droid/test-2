// Lặp lại ngắt quãng theo kiểu SM-2 (giống Anki, đơn vị là ngày).
import { addDays } from './dates.js'

export const GRADES = ['again', 'hard', 'good', 'easy']

export const GRADE_LABELS = {
  again: 'Quên',
  hard: 'Khó',
  good: 'Được',
  easy: 'Dễ',
}

const MIN_EASE = 1.3
const MAX_INTERVAL = 365

export function isNewCard(card) {
  return !card.due_date
}

// Khoảng ôn (ngày) cho từng mức chấm, dùng để hiển thị dưới nút và để lập lịch.
export function nextIntervals(card) {
  const n = card.repetitions ?? 0
  const prev = card.interval_days ?? 0
  const ease = card.ease ?? 2.5

  if (n === 0) {
    // Thẻ mới hoặc vừa quên: "Quên" = ôn lại ngay hôm nay
    return { again: 0, hard: 1, good: 1, easy: 4 }
  }

  const good = n === 1 ? 3 : Math.max(prev + 1, Math.round(prev * ease))
  const hard = Math.min(good, Math.max(prev + 1, Math.round(prev * 1.2)))
  const easy = Math.max(good + 1, Math.round(prev * (ease + 0.15) * 1.3))

  const cap = (d) => Math.min(MAX_INTERVAL, d)
  return { again: 0, hard: cap(hard), good: cap(good), easy: cap(Math.max(easy, good + 1)) }
}

// Trả về các trường cần cập nhật cho thẻ sau khi chấm.
export function schedule(card, grade, today, now = new Date()) {
  if (!GRADES.includes(grade)) throw new Error(`Mức chấm không hợp lệ: ${grade}`)

  const intervals = nextIntervals(card)
  const wasNew = isNewCard(card)
  let ease = card.ease ?? 2.5
  let repetitions = card.repetitions ?? 0
  let lapses = card.lapses ?? 0

  if (grade === 'again') {
    if (!wasNew && repetitions > 0) lapses += 1
    repetitions = 0
    ease = Math.max(MIN_EASE, ease - 0.2)
  } else {
    repetitions += 1
    if (grade === 'hard') ease = Math.max(MIN_EASE, ease - 0.15)
    if (grade === 'easy') ease = ease + 0.15
  }

  const interval = intervals[grade]
  return {
    ease: Math.round(ease * 100) / 100,
    interval_days: interval,
    repetitions,
    lapses,
    reviews_count: (card.reviews_count ?? 0) + 1,
    due_date: addDays(today, interval),
    introduced_on: card.introduced_on ?? today,
    last_reviewed_at: now.toISOString(),
  }
}

export function isDue(card, today) {
  return !isNewCard(card) && card.due_date <= today
}

// Sắp xếp thẻ mới: thẻ tự thêm (position 0) trước, sau đó theo thứ tự trong JSON
export function compareNewCards(a, b) {
  if (a.position !== b.position) return a.position - b.position
  return (a.created_at ?? '').localeCompare(b.created_at ?? '')
}
