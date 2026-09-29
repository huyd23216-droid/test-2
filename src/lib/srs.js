// Lặp lại ngắt quãng theo FSRS-5 (Free Spaced Repetition Scheduler), đơn vị ngày.
// FSRS ước lượng 2 đại lượng cho mỗi thẻ:
//   - stability (S): số ngày để khả năng nhớ giảm còn 90%
//   - difficulty (D): độ khó của thẻ, từ 1 đến 10
// rồi xếp lịch sao cho khi đến hạn, bạn vẫn nhớ khoảng `retention` (mặc định 90%).
import { addDays, daysBetween, toDateString } from './dates.js'

export const GRADES = ['again', 'hard', 'good', 'easy']

export const GRADE_LABELS = {
  again: 'Quên',
  hard: 'Khó',
  good: 'Được',
  easy: 'Dễ',
}

const RATING = { again: 1, hard: 2, good: 3, easy: 4 }

// Tham số mặc định của FSRS-5
export const FSRS_WEIGHTS = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11,
  0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
]
const W = FSRS_WEIGHTS
const DECAY = -0.5
const FACTOR = 19 / 81
export const MAX_INTERVAL = 365
export const DEFAULT_RETENTION = 0.9

const clampDifficulty = (d) => Math.min(10, Math.max(1, d))

export function isNewCard(card) {
  return !card.due_date
}

// Khả năng còn nhớ sau `elapsedDays` ngày với độ bền `stability`
export function retrievability(elapsedDays, stability) {
  return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY)
}

function intervalFor(stability, retention) {
  const days = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1)
  return Math.min(MAX_INTERVAL, Math.max(1, Math.round(days)))
}

const initStability = (g) => Math.max(0.1, W[g - 1])
const initDifficulty = (g) => clampDifficulty(W[4] - Math.exp(W[5] * (g - 1)) + 1)

function nextDifficulty(d, g) {
  const delta = -W[6] * (g - 3)
  const damped = d + (delta * (10 - d)) / 9
  return clampDifficulty(W[7] * initDifficulty(4) + (1 - W[7]) * damped)
}

function recallStability(d, s, r, g) {
  const hardPenalty = g === 2 ? W[15] : 1
  const easyBonus = g === 4 ? W[16] : 1
  return (
    s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hardPenalty * easyBonus)
  )
}

function forgetStability(d, s, r) {
  const next = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14])
  return Math.min(next, s)
}

// Ôn lại trong cùng một ngày
const shortTermStability = (s, g) => s * Math.exp(W[17] * (g - 3 + W[18]))

// Trạng thái trí nhớ hiện tại. Thẻ học theo SM-2 trước đây (chưa có
// stability) được quy đổi: stability ≈ khoảng ôn, difficulty suy từ ease.
export function memoryState(card) {
  if (isNewCard(card)) return null
  if (card.stability > 0 && card.difficulty > 0) return { s: card.stability, d: card.difficulty }
  return {
    s: Math.max(0.5, card.interval_days || 1),
    d: clampDifficulty(10 - ((card.ease ?? 2.5) - 1.3) * 4),
  }
}

function elapsedDays(card, today) {
  if (!card.last_reviewed_at) return card.interval_days ?? 0
  return Math.max(0, daysBetween(toDateString(new Date(card.last_reviewed_at)), today))
}

// Kết quả cho cả 4 mức chấm: { again|hard|good|easy: { stability, difficulty, interval } }
export function nextStates(card, today, retention = DEFAULT_RETENTION) {
  const mem = memoryState(card)
  const out = {}
  const elapsed = mem ? elapsedDays(card, today) : 0
  const r = mem ? retrievability(elapsed, mem.s) : 1

  for (const grade of GRADES) {
    const g = RATING[grade]
    let s
    let d
    if (!mem) {
      s = initStability(g)
      d = initDifficulty(g)
    } else {
      d = nextDifficulty(mem.d, g)
      if (elapsed === 0) s = shortTermStability(mem.s, g)
      else s = g === 1 ? forgetStability(mem.d, mem.s, r) : recallStability(mem.d, mem.s, r, g)
    }
    s = Math.max(0.1, s)
    // "Quên" = ôn lại ngay trong lượt học (và đến hạn lại hôm nay)
    out[grade] = { stability: s, difficulty: d, interval: g === 1 ? 0 : intervalFor(s, retention) }
  }

  // Giữ thứ tự: Khó ≤ Được < Dễ (Khó và Được chỉ được bằng nhau khi cùng là 1 ngày)
  out.hard.interval = Math.min(out.hard.interval, out.good.interval)
  if (out.hard.interval > 1) {
    out.good.interval = Math.min(MAX_INTERVAL, Math.max(out.good.interval, out.hard.interval + 1))
  }
  out.easy.interval = Math.min(MAX_INTERVAL, Math.max(out.easy.interval, out.good.interval + 1))
  return out
}

// Số ngày tới lần ôn sau cho từng mức chấm (hiển thị dưới các nút)
export function nextIntervals(card, today, retention = DEFAULT_RETENTION) {
  const states = nextStates(card, today, retention)
  return Object.fromEntries(GRADES.map((g) => [g, states[g].interval]))
}

const round3 = (x) => Math.round(x * 1000) / 1000

// Trả về các trường cần cập nhật cho thẻ sau khi chấm.
export function schedule(card, grade, today, now = new Date(), retention = DEFAULT_RETENTION) {
  if (!GRADES.includes(grade)) throw new Error(`Mức chấm không hợp lệ: ${grade}`)
  const next = nextStates(card, today, retention)[grade]
  const wasNew = isNewCard(card)
  const repetitions = card.repetitions ?? 0

  return {
    stability: round3(next.stability),
    difficulty: round3(next.difficulty),
    interval_days: next.interval,
    repetitions: grade === 'again' ? 0 : repetitions + 1,
    lapses: (card.lapses ?? 0) + (grade === 'again' && !wasNew && repetitions > 0 ? 1 : 0),
    reviews_count: (card.reviews_count ?? 0) + 1,
    due_date: addDays(today, next.interval),
    introduced_on: card.introduced_on ?? today,
    last_reviewed_at: now.toISOString(),
  }
}

export function isDue(card, today) {
  return !isNewCard(card) && card.due_date <= today
}

// Thứ tự học thẻ mới: position nhỏ trước (thẻ bạn tự thêm / bộ từ vừa bật được
// đưa lên đầu hàng), cùng position thì thẻ tạo trước học trước.
export function compareNewCards(a, b) {
  if (a.position !== b.position) return a.position - b.position
  return (a.created_at ?? '').localeCompare(b.created_at ?? '')
}
