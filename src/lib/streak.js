// Chuỗi ngày học: mỗi tuần (Thứ Hai → Chủ nhật) được nghỉ tối đa `restDays`
// ngày mà chuỗi vẫn giữ nguyên. Chuỗi = số ngày đã học liên tục theo luật đó.
import { STREAK_REST_DAYS_PER_WEEK } from '../config.js'
import { addDays, mondayOf } from './dates.js'

// Một buổi được tính là "đã học" nếu có hoạt động hoặc học ít nhất 1 phút
export function isCountedSession(session) {
  const activityCount = Object.values(session.activities ?? {}).reduce(
    (sum, v) => sum + (Number(v) || 0),
    0,
  )
  return activityCount > 0 || (session.duration_seconds ?? 0) >= 60
}

export function studyDatesFromSessions(sessions) {
  return new Set(sessions.filter(isCountedSession).map((s) => s.study_date))
}

export function computeStreak(studyDates, today, restDays = STREAK_REST_DAYS_PER_WEEK) {
  const studiedToday = studyDates.has(today)
  const thisMonday = mondayOf(today)

  if (studyDates.size === 0) {
    return { streak: 0, studiedToday: false, restDaysLeft: restDays }
  }

  const earliest = [...studyDates].sort()[0]
  const restUsed = new Map()
  let streak = 0
  let broken = false

  // Hôm nay chưa học thì chưa tính là ngày nghỉ (ngày vẫn còn).
  if (studiedToday) streak += 1
  let day = addDays(today, -1)

  while (day >= earliest) {
    if (studyDates.has(day)) {
      streak += 1
    } else {
      const week = mondayOf(day)
      const used = (restUsed.get(week) ?? 0) + 1
      restUsed.set(week, used)
      if (used > restDays) {
        broken = true
        break
      }
    }
    day = addDays(day, -1)
  }

  // Số ngày nghỉ còn lại của tuần này (chỉ tính những ngày đã qua)
  let usedThisWeek = 0
  for (let d = thisMonday; d < today; d = addDays(d, 1)) {
    if (d >= earliest && !studyDates.has(d)) usedThisWeek += 1
  }

  return {
    streak,
    studiedToday,
    restDaysLeft: Math.max(0, restDays - usedThisWeek),
    broken,
  }
}

export function weekSeconds(sessions, today) {
  const monday = mondayOf(today)
  return sessions
    .filter((s) => s.study_date >= monday && s.study_date <= today)
    .reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0)
}
