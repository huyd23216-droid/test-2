import { describe, expect, it } from 'vitest'
import { aggregateMistakes, missedWords } from '../mistakes.js'

describe('missed words', () => {
  it('lists wrong and missing content words only', () => {
    expect(missedWords('She lives in a big city.', 'She leaves in big city')).toEqual([{ key: 'lives', word: 'lives' }])
    expect(missedWords("I don't know what you're talking about.", 'I know what you talking')).toEqual([
      { key: 'about', word: 'about' },
    ])
    expect(missedWords('Perfect answer.', 'perfect answer')).toEqual([])
  })

  it('aggregates across history', () => {
    const history = [
      { sentence: 'The weather is nice today.', answer: 'the whether is nice today' },
      { sentence: 'What is the weather like?', answer: 'what is the whether like' },
      { sentence: 'She lives in a big city.', answer: 'she leaves in a big city' },
      { sentence: 'No answer yet', answer: null },
    ]
    expect(aggregateMistakes(history)).toEqual([{ key: 'weather', word: 'weather', count: 2, sentence: 'The weather is nice today.' }])
    expect(aggregateMistakes(history, { minCount: 1 }).map((m) => m.key)).toEqual(['weather', 'lives'])
  })
})
