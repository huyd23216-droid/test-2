import { describe, expect, it } from 'vitest'
import { nextIntervals, schedule, isDue, isNewCard, memoryState, retrievability } from '../srs.js'

const NEW = { interval_days: 0, repetitions: 0, lapses: 0, reviews_count: 0, due_date: null }
const TODAY = '2026-09-28'
const at = (day) => new Date(`${day}T10:00:00`)

describe('FSRS scheduling', () => {
  it('schedules a new card with the FSRS-5 initial stabilities', () => {
    expect(isNewCard(NEW)).toBe(true)
    expect(nextIntervals(NEW, TODAY)).toEqual({ again: 0, hard: 1, good: 3, easy: 16 })
    const good = schedule(NEW, 'good', TODAY, at(TODAY))
    expect(good).toMatchObject({ interval_days: 3, repetitions: 1, due_date: '2026-10-01', introduced_on: TODAY, reviews_count: 1 })
    expect(good.stability).toBeCloseTo(3.173, 2)
    expect(good.difficulty).toBeGreaterThan(1)
    const again = schedule(NEW, 'again', TODAY, at(TODAY))
    expect(again).toMatchObject({ interval_days: 0, repetitions: 0, lapses: 0, due_date: TODAY })
  })

  it('grows intervals when reviewed on time with "good"', () => {
    let card = { ...NEW }
    let day = TODAY
    const intervals = []
    for (let i = 0; i < 5; i++) {
      card = { ...card, ...schedule(card, 'good', day, at(day)) }
      intervals.push(card.interval_days)
      day = card.due_date
    }
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1] * 2)
    expect(intervals[0]).toBe(3)
    expect(intervals[1]).toBe(11)
  })

  it('keeps button intervals ordered and lowers stability on a lapse', () => {
    const card = { ...NEW, ...schedule(NEW, 'good', TODAY, at(TODAY)) }
    const due = card.due_date
    const iv = nextIntervals(card, due)
    expect(iv.again).toBe(0)
    expect(iv.hard).toBeLessThan(iv.good)
    expect(iv.good).toBeLessThan(iv.easy)
    const reviewed = { ...card, ...schedule(card, 'good', due, at(due)) }
    const lapsed = schedule(reviewed, 'again', reviewed.due_date, at(reviewed.due_date))
    expect(lapsed.lapses).toBe(1)
    expect(lapsed.interval_days).toBe(0)
    expect(lapsed.stability).toBeLessThan(reviewed.stability)
    expect(lapsed.difficulty).toBeGreaterThan(reviewed.difficulty)
  })

  it('handles same-day re-reviews (again → good in one session)', () => {
    const again = { ...NEW, ...schedule(NEW, 'again', TODAY, at(TODAY)) }
    const good = schedule(again, 'good', TODAY, at(TODAY))
    expect(good.interval_days).toBe(1)
    expect(good.stability).toBeGreaterThan(again.stability)
  })

  it('converts SM-2 cards without losing progress', () => {
    const sm2 = { ease: 2.5, interval_days: 10, repetitions: 3, reviews_count: 3, due_date: TODAY, last_reviewed_at: '2026-09-18T10:00:00' }
    expect(memoryState(sm2)).toMatchObject({ s: 10 })
    expect(nextIntervals(sm2, TODAY).good).toBeGreaterThan(10)
  })

  it('reviews more often with a higher desired retention', () => {
    expect(nextIntervals(NEW, TODAY, 0.95).good).toBeLessThan(nextIntervals(NEW, TODAY, 0.85).good)
    expect(retrievability(0, 5)).toBe(1)
    expect(retrievability(5, 5)).toBeCloseTo(0.9, 5)
  })

  it('caps intervals at one year', () => {
    const strong = { ...NEW, due_date: TODAY, stability: 400, difficulty: 3, repetitions: 8, last_reviewed_at: '2025-09-28T10:00:00', interval_days: 365 }
    expect(nextIntervals(strong, TODAY).easy).toBeLessThanOrEqual(365)
  })

  it('detects due cards', () => {
    expect(isDue({ due_date: '2026-09-27' }, TODAY)).toBe(true)
    expect(isDue({ due_date: TODAY }, TODAY)).toBe(true)
    expect(isDue({ due_date: '2026-09-29' }, TODAY)).toBe(false)
    expect(isDue({ due_date: null }, TODAY)).toBe(false)
  })
})
