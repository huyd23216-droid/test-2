import { describe, expect, it, vi } from 'vitest'
import { addGlossaryCard, glossaryEntries, glossaryLines, hasCard, markGlossary, sentenceAt } from '../glossary.js'
import { isValidItem, parseCloze } from '../homeworkSets.js'

const GLOSSARY = {
  health: 'sức khỏe',
  pandemic: 'đại dịch',
  'mental health': 'sức khỏe tinh thần',
  "don't": 'đừng',
}

// Các từ được đánh dấu: [chữ như trong đoạn văn, khóa glossary]
const terms = (text, glossary = GLOSSARY) =>
  markGlossary(text, glossaryEntries(glossary))
    .filter((s) => s.term)
    .map((s) => [s.text, s.term.word])

describe('glossary: các mục', () => {
  it('cụm dài nhất trước, bỏ mục thiếu nghĩa và khóa trùng (khác hoa thường)', () => {
    const entries = glossaryEntries({ ...GLOSSARY, Health: 'trùng', empty: '', bad: 3, '  ': 'x', ' mental   state ': ' trạng thái ' })
    expect(entries.map((e) => e.word)).toEqual(['mental health', 'mental state', 'pandemic', 'health', "don't"])
    expect(entries.find((e) => e.word === 'health').meaning).toBe('sức khỏe')
    expect(entries.find((e) => e.word === 'mental state').meaning).toBe('trạng thái')
  })

  it('glossary sai kiểu coi như không có, câu vẫn hợp lệ', () => {
    expect(glossaryEntries(undefined)).toEqual([])
    expect(glossaryEntries('pandemic')).toEqual([])
    expect(glossaryEntries(['pandemic'])).toEqual([])
    const item = { id: 'c', type: 'cloze', text: 'A {{1}}.', bank: ['b'], blanks: { 1: { answer: 'b' } } }
    expect(isValidItem({ ...item, glossary: 'oops' })).toBe(true)
    expect(isValidItem({ ...item, glossary: GLOSSARY })).toBe(true)
  })
})

describe('glossary: khớp từ và cụm từ', () => {
  it('"mental health" được khớp trước "health"', () => {
    expect(terms('Mental health matters. Health is wealth.')).toEqual([
      ['Mental health', 'mental health'],
      ['Health', 'health'],
    ])
  })

  it('cụm dài nhất thắng cả khi cụm ngắn hơn bắt đầu sớm hơn', () => {
    const glossary = { 'mental health': 'a', 'health care system': 'b' }
    expect(terms('The mental health care system is slow.', glossary)).toEqual([['health care system', 'health care system']])
  })

  it('không phân biệt hoa thường, giữ nguyên chữ như trong đoạn văn', () => {
    expect(terms('The PANDEMIC changed everything.')).toEqual([['PANDEMIC', 'pandemic']])
  })

  it('chỉ khớp cả từ, không khớp một phần của từ khác', () => {
    expect(terms('A healthy, unhealthy or health-related pandemics')).toEqual([['health', 'health']])
    expect(terms('Healthcare')).toEqual([])
  })

  it('khoảng trắng giữa các chữ tùy ý, dấu nháy cong cũng khớp', () => {
    expect(terms('mental\n  health')).toEqual([['mental\n  health', 'mental health']])
    expect(terms('mental health')).toEqual([['mental health', 'mental health']])
    expect(terms('Don’t panic.')).toEqual([['Don’t', "don't"]])
  })

  it('ký tự đặc biệt trong khóa được hiểu theo nghĩa đen', () => {
    expect(terms('Use e.g. this, not eggs.', { 'e.g.': 'ví dụ' })).toEqual([['e.g.', 'e.g.']])
    expect(terms('I like C++ a lot.', { 'C++': 'ngôn ngữ C++' })).toEqual([['C++', 'C++']])
  })

  it('các phần nối lại đúng bằng đoạn chữ ban đầu', () => {
    const text = 'During the pandemic, mental health and health in general got worse.'
    const parts = markGlossary(text, glossaryEntries(GLOSSARY))
    expect(parts.map((s) => s.text).join('')).toBe(text)
    expect(parts.every((s) => text.slice(s.start, s.start + s.text.length) === s.text)).toBe(true)
  })
})

describe('glossary: trong đoạn văn cloze', () => {
  const ITEM = {
    id: 'g1',
    type: 'cloze',
    text:
      'Linh: The pandemic was hard. Many people {{1}} with mental health. Dr. Lee helps.\nHuy: My mental {{2}} is fine, thanks.',
    bank: ['struggled', 'health', 'state'],
    blanks: { 1: { answer: 'struggled' }, 2: { answer: 'health' } },
    glossary: { ...GLOSSARY, struggled: 'vật lộn', Linh: 'tên người' },
  }
  const marked = (lines) =>
    lines.flatMap((line) => line.parts.flatMap((p) => (p.segments ?? []).filter((s) => s.term).map((s) => s.term)))

  it('không có glossary thì giống hệt parseCloze', () => {
    const { glossary: _g, ...plain } = ITEM
    expect(glossaryLines(plain)).toEqual(parseCloze(plain.text))
    expect(glossaryLines({ ...plain, glossary: {} })).toEqual(parseCloze(plain.text))
  })

  it('không đánh dấu chữ trong chỗ trống, tên người nói, hay cụm bị chỗ trống cắt ngang', () => {
    const words = marked(glossaryLines(ITEM)).map((t) => t.word)
    // "struggled" là đáp án của chỗ trống 1, "mental {{2}}" bị chỗ trống cắt ngang
    expect(words).toEqual(['pandemic', 'mental health'])
  })

  it('phần chữ vẫn giữ nguyên, chỗ trống vẫn là chỗ trống', () => {
    const lines = glossaryLines(ITEM)
    const plain = parseCloze(ITEM.text)
    expect(lines.map((l) => l.speaker)).toEqual(plain.map((l) => l.speaker))
    lines.forEach((line, i) => {
      expect(line.parts.map(({ segments: _s, ...p }) => p)).toEqual(plain[i].parts)
      for (const p of line.parts) if (p.segments) expect(p.segments.map((s) => s.text).join('')).toBe(p.text)
    })
  })

  it('câu ví dụ là câu chứa từ đó, chỗ trống điền đáp án đúng, bỏ tên người nói', () => {
    const [pandemic, mental] = marked(glossaryLines(ITEM))
    expect(pandemic).toEqual({ word: 'pandemic', meaning: 'đại dịch', sentence: 'The pandemic was hard.' })
    expect(mental.sentence).toBe('Many people struggled with mental health.')
  })

  it('tách câu: bỏ qua Mr. / Dr. / e.g. và số thập phân', () => {
    const text = 'Dr. Lee earns 3.5 times more, e.g. in big cities. She is happy!'
    expect(sentenceAt(text, text.indexOf('cities'))).toBe('Dr. Lee earns 3.5 times more, e.g. in big cities.')
    expect(sentenceAt(text, text.indexOf('happy'))).toBe('She is happy!')
    expect(sentenceAt('No full stop here', 3)).toBe('No full stop here')
  })
})

describe('glossary: thêm vào thẻ', () => {
  const term = { word: 'mental health', meaning: 'sức khỏe tinh thần', sentence: 'Many people struggled with mental health.' }

  it('tạo thẻ mới bằng addCard với từ, nghĩa và câu ví dụ', () => {
    const addCard = vi.fn((fields) => ({ id: 'new', ...fields }))
    const card = addGlossaryCard(term, { cards: [{ word: 'health' }], addCard })
    expect(addCard).toHaveBeenCalledTimes(1)
    expect(addCard).toHaveBeenCalledWith({
      word: 'mental health',
      meaning_vi: 'sức khỏe tinh thần',
      example_en: 'Many people struggled with mental health.',
    })
    expect(card).toMatchObject({ id: 'new', word: 'mental health' })
  })

  it('từ đã có thẻ (khác hoa thường, khoảng trắng) thì không tạo trùng', () => {
    const addCard = vi.fn()
    const cards = [{ word: ' Mental  Health ' }]
    expect(hasCard(cards, 'mental health')).toBe(true)
    expect(addGlossaryCard(term, { cards, addCard })).toBeNull()
    expect(addCard).not.toHaveBeenCalled()
  })

  it('bấm hai lần chỉ tạo một thẻ (thẻ vừa tạo đã nằm trong danh sách)', () => {
    const cards = []
    const addCard = vi.fn((fields) => {
      const row = { id: String(cards.length), ...fields }
      cards.push(row)
      return row
    })
    addGlossaryCard(term, { cards, addCard })
    addGlossaryCard(term, { cards, addCard })
    expect(addCard).toHaveBeenCalledTimes(1)
  })
})
