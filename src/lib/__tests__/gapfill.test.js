import { describe, expect, it } from 'vitest'
import { checkGap, makeGaps } from '../gapfill.js'

// Bộ sinh số ngẫu nhiên cố định để test ổn định
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

describe('gap fill', () => {
  it('creates the requested number of gaps and keeps punctuation outside', () => {
    const parts = makeGaps('I have to go to work, and I can\'t stay.', 3, seeded(7))
    const gaps = parts.filter((p) => p.type === 'gap')
    expect(gaps).toHaveLength(3)
    expect(gaps.map((g) => g.n)).toEqual([0, 1, 2])
    const rebuilt = parts.map((p) => (p.type === 'gap' ? p.answer : p.text)).join('')
    expect(rebuilt).toBe("I have to go to work, and I can't stay.")
    expect(gaps.some((g) => ['have', 'to', 'and', "can't"].includes(g.answer) || g.answer === 'to')).toBe(true)
  })

  it('never makes more gaps than words', () => {
    expect(makeGaps('Hello there!', 5, seeded(3)).filter((p) => p.type === 'gap')).toHaveLength(2)
  })

  it('checks answers leniently', () => {
    expect(checkGap("can't", 'Cant')).toBe(true)
    expect(checkGap("can't", 'can’t')).toBe(true)
    expect(checkGap('work', 'walk')).toBe(false)
    expect(checkGap('work', '')).toBe(false)
  })
})
