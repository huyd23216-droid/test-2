import { describe, expect, it } from 'vitest'
import { gradeAnswer, groupOpsForDisplay, tokenize } from '../grading.js'

describe('gradeAnswer', () => {
  it('ignores case and punctuation', () => {
    const r = gradeAnswer('What are you trying to prove?', 'what ARE you trying to prove')
    expect(r).toMatchObject({ total: 6, correct: 6, perfect: true, score: 1 })
  })

  it('accepts contractions, expansions and curly apostrophes', () => {
    expect(gradeAnswer("I don't know.", 'I do not know').perfect).toBe(true)
    expect(gradeAnswer('I do not know.', "I don't know").perfect).toBe(true)
    expect(gradeAnswer("I don't know.", 'I don’t know').perfect).toBe(true)
    expect(gradeAnswer("I don't know.", 'i dont know').perfect).toBe(true)
    expect(gradeAnswer("We're late.", 'were late').perfect).toBe(false)
  })

  it('marks wrong, missing and extra words', () => {
    const r = gradeAnswer('I like green tea', 'I like tea very')
    expect(r.correct).toBe(3)
    expect(r.missing).toBe(1)
    expect(r.extra).toBe(1)
    expect(r.perfect).toBe(false)
    const types = r.ops.map((o) => o.type)
    expect(types).toEqual(['match', 'match', 'missing', 'match', 'extra'])

    const w = gradeAnswer('She lives in a big city', 'She leaves in a big city')
    expect(w.ops[1]).toMatchObject({ type: 'wrong' })
    expect(w.correct).toBe(5)
  })

  it('handles empty answers', () => {
    const r = gradeAnswer('Pick it up.', '')
    expect(r).toMatchObject({ total: 3, correct: 0, missing: 3, score: 0 })
  })

  it('splits hyphenated words', () => {
    expect(tokenize('Tur-noff the light.').map((t) => t.key)).toEqual(['tur', 'noff', 'the', 'light'])
  })

  it('shows the original contraction when fully correct', () => {
    const r = gradeAnswer("I don't know.", "I don't know")
    expect(groupOpsForDisplay(r.ops)).toEqual([
      { type: 'match', text: 'I' },
      { type: 'match', text: "don't" },
      { type: 'match', text: 'know' },
    ])
  })
})
