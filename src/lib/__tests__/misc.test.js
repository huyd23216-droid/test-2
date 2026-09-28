import { describe, expect, it } from 'vitest'
import { youglishUrl } from '../youglish.js'
import { parseYouTubeId, parseYouTubeStart, youtubeWatchUrl } from '../youtube.js'
import { addDays, mondayOf, parseTimestamp, formatSeconds } from '../dates.js'
import { validateContent, SEED_CARDS, CS_ITEMS, DICTATION_SENTENCES, CS_GROUPS } from '../content.js'
import { posLabel } from '../labels.js'
import { accentFor } from '../tts.js'

describe('youglish', () => {
  it('builds the URL', () => {
    expect(youglishUrl("don't you")).toBe('https://youglish.com/pronounce/don\'t%20you/english/us')
    expect(youglishUrl(' what  are you ')).toBe('https://youglish.com/pronounce/what%20are%20you/english/us')
    expect(youglishUrl('water', 'uk')).toBe('https://youglish.com/pronounce/water/english/uk')
    expect(youglishUrl('water', 'mixed')).toBe('https://youglish.com/pronounce/water/english')
  })
})

describe('youtube', () => {
  it('parses ids and start times', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe('dQw4w9WgXcQ')
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ')
    expect(parseYouTubeId('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(parseYouTubeId('javascript:alert(1)')).toBe(null)
    expect(parseYouTubeId('https://evil.com/watch?v=dQw4w9WgXcQ')).toBe(null)
    expect(parseYouTubeStart('https://youtu.be/dQw4w9WgXcQ?t=1m23s')).toBe(83)
    expect(parseYouTubeStart('https://youtu.be/dQw4w9WgXcQ?t=95')).toBe(95)
    expect(youtubeWatchUrl('https://youtu.be/dQw4w9WgXcQ', 83)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=83s')
  })
})

describe('accent', () => {
  it('keeps one accent per sentence in mixed mode', () => {
    expect(accentFor('Hello there', 'us')).toBe('us')
    expect(accentFor('Hello there', 'uk')).toBe('uk')
    const a = accentFor('What are you trying to prove?', 'mixed')
    expect(accentFor('What are you trying to prove?', 'mixed')).toBe(a)
    const picks = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((t) => accentFor(t, 'mixed')))
    expect(picks).toEqual(new Set(['us', 'uk']))
  })
})

describe('dates', () => {
  it('handles weeks and timestamps', () => {
    expect(mondayOf('2026-10-04')).toBe('2026-09-28')
    expect(mondayOf('2026-09-28')).toBe('2026-09-28')
    expect(addDays('2026-09-30', 2)).toBe('2026-10-02')
    expect(parseTimestamp('1:23')).toBe(83)
    expect(parseTimestamp('1:02:03')).toBe(3723)
    expect(parseTimestamp('')).toBe(null)
    expect(parseTimestamp('abc')).toBeNaN()
    expect(formatSeconds(83)).toBe('1:23')
  })
})

describe('content JSON', () => {
  it('is valid', () => {
    expect(validateContent()).toEqual([])
  })

  it('has the expected amount of starter content', () => {
    expect(SEED_CARDS.length).toBeGreaterThanOrEqual(300)
    expect(CS_ITEMS.length).toBeGreaterThanOrEqual(40)
    expect(DICTATION_SENTENCES.length).toBeGreaterThanOrEqual(60)
    for (const g of CS_GROUPS) {
      expect(CS_ITEMS.filter((i) => i.group === g.id).length).toBeGreaterThanOrEqual(5)
    }
  })

  it('reports broken data', () => {
    const errors = validateContent({
      vocabulary: { cards: [{ id: 'a', word: 'x' }, { id: 'a', word: 'y' }] },
      connectedSpeech: { groups: [], items: [{ id: 'c', group: 'nope' }] },
      dictation: { levels: [{ level: 1 }], sentences: [{ id: 'd', level: 5, text: 'Hi' }] },
    })
    expect(errors.some((e) => e.includes('bị trùng'))).toBe(true)
    expect(errors.some((e) => e.includes('không tồn tại'))).toBe(true)
  })

  it('labels parts of speech in Vietnamese', () => {
    expect(posLabel('verb, noun')).toBe('động từ, danh từ')
    expect(posLabel('phrasal verb')).toBe('phrasal verb')
  })
})
