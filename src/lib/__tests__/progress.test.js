import { describe, expect, it } from 'vitest'
import { calendarGrid, dayLevel, listeningAccuracy, niceTicks, weeklyMinutes } from '../progress.js'

const sessions = [
  { study_date: '2026-09-28', duration_seconds: 600, activities: { dictation: 1 } },
  { study_date: '2026-09-28', duration_seconds: 300, activities: {} },
  { study_date: '2026-09-22', duration_seconds: 1500, activities: { vocab_review: 3 } },
  { study_date: '2026-09-23', duration_seconds: 20, activities: { drill: 1 } },
]

describe('progress data', () => {
  it('sums minutes per Monday-based week', () => {
    const weeks = weeklyMinutes(sessions, '2026-09-30', 3)
    expect(weeks.map((w) => [w.start, w.minutes, w.current])).toEqual([
      ['2026-09-14', 0, false],
      ['2026-09-21', 25, false],
      ['2026-09-28', 15, true],
    ])
  })

  it('builds a calendar with activity levels and future days', () => {
    const grid = calendarGrid(sessions, '2026-09-30', 2)
    expect(grid).toHaveLength(2)
    const lastWeek = grid[1].days
    expect(lastWeek[0]).toMatchObject({ date: '2026-09-28', minutes: 15, level: 2, future: false })
    expect(lastWeek[3].future).toBe(true)
    expect(grid[0].days[2]).toMatchObject({ date: '2026-09-23', minutes: 0, studied: true, level: 1 })
    expect(dayLevel(0, false)).toBe(0)
    expect(dayLevel(45, true)).toBe(4)
  })

  it('picks round axis ticks', () => {
    expect(niceTicks(47)).toEqual([0, 20, 40, 60])
    expect(niceTicks(0)).toEqual([0, 10, 20, 30])
    expect(niceTicks(130)).toEqual([0, 50, 100, 150])
  })

  it('computes listening accuracy only for practiced modes', () => {
    const rows = listeningAccuracy({
      history: [{ source: 'builtin', score: 1 }, { source: 'builtin', score: 0.5 }],
      csRows: [],
      listening: [{ kind: 'drill', attempts: 4, correct_count: 3 }],
    })
    expect(rows).toEqual([
      { label: 'Chép chính tả', value: 75, count: 2 },
      { label: 'Phân biệt âm', value: 75, count: 4 },
    ])
  })
})
