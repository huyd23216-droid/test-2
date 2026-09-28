import { describe, expect, it } from 'vitest'
import { computeStreak, isCountedSession, weekSeconds } from '../streak.js'

// 2026-09-28 là Thứ Hai
const set = (...days) => new Set(days)

describe('computeStreak', () => {
  it('is zero without history', () => {
    expect(computeStreak(new Set(), '2026-09-30')).toMatchObject({ streak: 0, studiedToday: false })
  })

  it('counts consecutive days and does not punish today before studying', () => {
    const days = set('2026-09-28', '2026-09-29')
    expect(computeStreak(days, '2026-09-30')).toMatchObject({ streak: 2, studiedToday: false, restDaysLeft: 2 })
    expect(computeStreak(set(...days, '2026-09-30'), '2026-09-30')).toMatchObject({ streak: 3, studiedToday: true })
  })

  it('allows two rest days per week', () => {
    // Tuần 21–27/9: nghỉ 23 và 25 → vẫn giữ chuỗi
    const days = set('2026-09-21', '2026-09-22', '2026-09-24', '2026-09-26', '2026-09-27', '2026-09-28')
    expect(computeStreak(days, '2026-09-28').streak).toBe(6)
  })

  it('breaks after a third missed day in the same week', () => {
    // Tuần 21–27/9: nghỉ 23, 24, 25 → chuỗi chỉ tính từ 26
    const days = set('2026-09-21', '2026-09-22', '2026-09-26', '2026-09-27', '2026-09-28')
    expect(computeStreak(days, '2026-09-28').streak).toBe(3)
  })

  it('reports rest days left this week', () => {
    // Thứ Tư 30/9, đã nghỉ Thứ Hai 28/9
    const days = set('2026-09-25', '2026-09-26', '2026-09-27', '2026-09-29')
    expect(computeStreak(days, '2026-09-30')).toMatchObject({ streak: 4, restDaysLeft: 1 })
  })
})

describe('sessions', () => {
  it('counts sessions with activity or at least a minute', () => {
    expect(isCountedSession({ activities: { dictation: 1 }, duration_seconds: 5 })).toBe(true)
    expect(isCountedSession({ activities: {}, duration_seconds: 90 })).toBe(true)
    expect(isCountedSession({ activities: {}, duration_seconds: 20 })).toBe(false)
  })

  it('sums this week only', () => {
    const sessions = [
      { study_date: '2026-09-27', duration_seconds: 600 },
      { study_date: '2026-09-28', duration_seconds: 300 },
      { study_date: '2026-09-30', duration_seconds: 120 },
    ]
    expect(weekSeconds(sessions, '2026-09-30')).toBe(420)
  })
})
