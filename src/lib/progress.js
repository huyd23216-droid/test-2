// Chuẩn bị số liệu cho trang Tiến độ (hàm thuần, dễ kiểm thử)
import { addDays, mondayOf, parseDate } from './dates.js'
import { isCountedSession } from './streak.js'

const pad = (n) => String(n).padStart(2, '0')
export const shortDate = (str) => {
  const d = parseDate(str)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}

// Tổng số giây và số hoạt động theo từng ngày
export function dailyTotals(sessions) {
  const map = new Map()
  for (const s of sessions) {
    const cur = map.get(s.study_date) ?? { seconds: 0, studied: false }
    cur.seconds += s.duration_seconds ?? 0
    cur.studied = cur.studied || isCountedSession(s)
    map.set(s.study_date, cur)
  }
  return map
}

// Số phút học của `weeks` tuần gần nhất (tuần bắt đầu từ Thứ Hai), cũ → mới
export function weeklyMinutes(sessions, today, weeks = 12) {
  const daily = dailyTotals(sessions)
  const thisMonday = mondayOf(today)
  return Array.from({ length: weeks }, (_, k) => {
    const start = addDays(thisMonday, -7 * (weeks - 1 - k))
    let seconds = 0
    for (let d = 0; d < 7; d++) seconds += daily.get(addDays(start, d))?.seconds ?? 0
    return { start, end: addDays(start, 6), minutes: Math.round(seconds / 60), current: start === thisMonday }
  })
}

// Mức màu cho lịch học: 0 = không học, 1–4 = học ít → nhiều
export function dayLevel(minutes, studied) {
  if (!studied && minutes < 1) return 0
  if (minutes < 10) return 1
  if (minutes < 20) return 2
  if (minutes < 40) return 3
  return 4
}

// Lưới lịch học: mỗi cột một tuần (Thứ Hai → Chủ nhật), cũ → mới
export function calendarGrid(sessions, today, weeks = 18) {
  const daily = dailyTotals(sessions)
  const thisMonday = mondayOf(today)
  return Array.from({ length: weeks }, (_, k) => {
    const start = addDays(thisMonday, -7 * (weeks - 1 - k))
    return {
      start,
      days: Array.from({ length: 7 }, (_, d) => {
        const date = addDays(start, d)
        const t = daily.get(date)
        const minutes = Math.round((t?.seconds ?? 0) / 60)
        return { date, minutes, studied: Boolean(t?.studied), level: dayLevel(minutes, t?.studied), future: date > today }
      }),
    }
  })
}

// Mốc trục tung "tròn" (0, 15, 30…) bao trọn giá trị lớn nhất
export function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 10, 20, 30]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Math.round(i * step * 100) / 100)
}

// Độ chính xác gần đây của từng kiểu luyện nghe (%), bỏ qua kiểu chưa làm
export function listeningAccuracy({ history, csRows, listening }) {
  const avg = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) : null)
  const recentDictation = history.filter((h) => h.source === 'builtin').slice(0, 30).map((h) => h.score)
  const clips = history.filter((h) => h.source === 'clip').slice(0, 30).map((h) => h.score)
  const cs = csRows.filter((r) => r.attempts > 0).map((r) => r.last_score ?? 0)
  const gaps = listening.filter((r) => r.kind === 'gapfill').map((r) => r.last_score ?? 0)
  const drills = listening.filter((r) => r.kind === 'drill')
  const drillAttempts = drills.reduce((n, r) => n + r.attempts, 0)
  const drillCorrect = drills.reduce((n, r) => n + r.correct_count, 0)
  return [
    { label: 'Chép chính tả', value: avg(recentDictation), count: recentDictation.length },
    { label: 'Nối âm', value: avg(cs), count: cs.length },
    { label: 'Điền từ', value: avg(gaps), count: gaps.length },
    { label: 'Phân biệt âm', value: drillAttempts ? Math.round((drillCorrect / drillAttempts) * 100) : null, count: drillAttempts },
    { label: 'Clip thật', value: avg(clips), count: clips.length },
  ].filter((row) => row.value !== null)
}
