import { describe, expect, it } from 'vitest'
import { nextIntervals, schedule, isDue, isNewCard } from '../srs.js'

const NEW = { ease: 2.5, interval_days: 0, repetitions: 0, lapses: 0, reviews_count: 0, due_date: null }
const TODAY = '2026-09-28'

describe('SM-2 scheduling', () => {
  it('schedules a new card', () => {
    expect(isNewCard(NEW)).toBe(true)
    expect(nextIntervals(NEW)).toEqual({ again: 0, hard: 1, good: 1, easy: 4 })
    const good = schedule(NEW, 'good', TODAY)
    expect(good).toMatchObject({ interval_days: 1, repetitions: 1, due_date: '2026-09-29', introduced_on: TODAY, reviews_count: 1 })
    const again = schedule(NEW, 'again', TODAY)
    expect(again).toMatchObject({ interval_days: 0, repetitions: 0, lapses: 0, due_date: TODAY })
  })

  it('grows intervals with "good"', () => {
    let card = { ...NEW }
    const intervals = []
    for (let i = 0; i < 5; i++) {
      card = { ...card, ...schedule(card, 'good', TODAY) }
      intervals.push(card.interval_days)
    }
    expect(intervals).toEqual([1, 3, 8, 20, 50])
  })

  it('keeps button intervals ordered and resets on lapse', () => {
    const card = { ease: 2.5, interval_days: 10, repetitions: 3, lapses: 0, reviews_count: 3, due_date: TODAY }
    const iv = nextIntervals(card)
    expect(iv.again).toBe(0)
    expect(iv.hard).toBeLessThanOrEqual(iv.good)
    expect(iv.good).toBeLessThan(iv.easy)
    const lapsed = schedule(card, 'again', TODAY)
    expect(lapsed).toMatchObject({ repetitions: 0, lapses: 1, interval_days: 0, ease: 2.3 })
  })

  it('never lets ease drop below 1.3 and caps the interval', () => {
    let card = { ease: 1.35, interval_days: 300, repetitions: 8, lapses: 0, reviews_count: 8, due_date: TODAY }
    card = { ...card, ...schedule(card, 'hard', TODAY) }
    expect(card.ease).toBe(1.3)
    card = { ...card, ...schedule(card, 'easy', TODAY) }
    expect(card.interval_days).toBeLessThanOrEqual(365)
  })

  it('detects due cards', () => {
    expect(isDue({ due_date: '2026-09-27' }, TODAY)).toBe(true)
    expect(isDue({ due_date: TODAY }, TODAY)).toBe(true)
    expect(isDue({ due_date: '2026-09-29' }, TODAY)).toBe(false)
    expect(isDue({ due_date: null }, TODAY)).toBe(false)
  })
})
