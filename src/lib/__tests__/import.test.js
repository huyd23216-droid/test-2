import { describe, expect, it } from 'vitest'
import { parseImportText } from '../importText.js'
import { parseDictionaryEntry } from '../lookup.js'

describe('parseImportText', () => {
  it('reads words, optional columns, tabs and bullets', () => {
    const rows = parseImportText(`
      # danh sách của tôi
      1. sustainable | bền vững | Sustainable energy is the future. | Năng lượng bền vững là tương lai.
      - commute\tđi lại hằng ngày
      pollution
      Pollution
    `)
    expect(rows).toEqual([
      { word: 'sustainable', meaning_vi: 'bền vững', example_en: 'Sustainable energy is the future.', example_vi: 'Năng lượng bền vững là tương lai.' },
      { word: 'commute', meaning_vi: 'đi lại hằng ngày', example_en: '', example_vi: '' },
      { word: 'pollution', meaning_vi: '', example_en: '', example_vi: '' },
    ])
  })
})

describe('parseDictionaryEntry', () => {
  it('prefers the US phonetic and known parts of speech', () => {
    const entry = [
      {
        word: 'tomato',
        phonetic: '/təˈmɑːtəʊ/',
        phonetics: [
          { text: '/təˈmɑːtəʊ/', audio: 'https://x/tomato-uk.mp3' },
          { text: '/təˈmeɪtoʊ/', audio: 'https://x/tomato-us.mp3' },
        ],
        meanings: [
          { partOfSpeech: 'noun', definitions: [{ definition: 'A red fruit.', example: 'she sliced a tomato' }] },
          { partOfSpeech: 'exclamation', definitions: [] },
        ],
      },
    ]
    expect(parseDictionaryEntry(entry)).toEqual({
      ipa: '/təˈmeɪtoʊ/',
      pos: 'noun',
      example_en: 'She sliced a tomato',
      definition_en: 'A red fruit.',
    })
    expect(parseDictionaryEntry({ title: 'No Definitions Found' })).toEqual({})
  })
})
