import { describe, expect, it } from 'vitest'
import {
  buildHomework,
  checkAnswer,
  DAILY_PLAN,
  findWordForm,
  isWeak,
  nextProgress,
  numberToWords,
  ordinalWords,
  parseDateAnswer,
  parseTimeAnswer,
  speakDigits,
  spellOut,
  summarize,
  timeWords,
  usableCard,
} from '../homework.js'
import { SEED_CARDS } from '../content.js'

const TODAY = '2026-10-05'

// 60 thẻ đầu (dùng được cho bài tập) coi như đã học vài ngày trước
function learnedCards(n = 60) {
  return SEED_CARDS.filter(usableCard)
    .slice(0, n)
    .map((c, i) => ({
      ...c,
      id: `card-${i}`,
      seed_id: c.id,
      due_date: '2026-10-08',
      introduced_on: '2026-10-03',
      interval_days: 2,
      stability: 2,
      lapses: i % 7 === 0 ? 1 : 0,
    }))
}

describe('đọc số kiểu tiếng Anh', () => {
  it('số đếm', () => {
    expect(numberToWords(15)).toBe('fifteen')
    expect(numberToWords(42)).toBe('forty-two')
    expect(numberToWords(375)).toBe('three hundred and seventy-five')
    expect(numberToWords(1250)).toBe('one thousand two hundred and fifty')
    expect(numberToWords(1005)).toBe('one thousand and five')
    expect(numberToWords(12000)).toBe('twelve thousand')
  })

  it('số thứ tự cho ngày', () => {
    expect(ordinalWords(1)).toBe('first')
    expect(ordinalWords(3)).toBe('third')
    expect(ordinalWords(11)).toBe('eleventh')
    expect(ordinalWords(12)).toBe('twelfth')
    expect(ordinalWords(20)).toBe('twentieth')
    expect(ordinalWords(23)).toBe('twenty-third')
    expect(ordinalWords(31)).toBe('thirty-first')
  })

  it('giờ theo cách nói của người Anh', () => {
    expect(timeWords(7, 45)).toBe('quarter to eight')
    expect(timeWords(12, 45)).toBe('quarter to one')
    expect(timeWords(3, 10)).toBe('ten past three')
    expect(timeWords(9, 35)).toBe('twenty-five to ten')
    expect(timeWords(6, 30)).toBe('half past six')
    expect(timeWords(7, 5, true)).toBe('seven oh five')
    expect(timeWords(8, 0)).toBe("eight o'clock")
  })

  it('đọc từng chữ số: 0 là "oh", số lặp lại là "double" / "triple"', () => {
    expect(speakDigits('07946')).toBe('oh seven nine four six')
    expect(speakDigits('5512')).toBe('double five one two')
    expect(speakDigits('555')).toBe('triple five')
    expect(speakDigits('0000')).toBe('double oh double oh')
  })

  it('đánh vần tên có chữ đôi', () => {
    expect(spellOut('Russell')).toBe('R, U, double S, E, double L')
    expect(spellOut('Hughes')).toBe('H, U, G, H, E, S')
  })
})

describe('chấm đáp án', () => {
  const word = { answer: 'weather', check: { kind: 'word' } }

  it('gõ đúng, hoa thường hay dấu chấm cuối không sao', () => {
    expect(checkAnswer(word, ' Weather. ').result).toBe('correct')
  })

  it('sai một chữ cái là "gần đúng", sai nhiều là chưa đúng', () => {
    expect(checkAnswer(word, 'wether').result).toBe('close')
    expect(checkAnswer(word, 'whether').result).toBe('wrong')
    expect(checkAnswer(word, 'water').result).toBe('wrong')
    expect(checkAnswer(word, '').result).toBe('wrong')
  })

  it('điền từ: đúng từ nhưng sai dạng thì được nhắc dạng đúng', () => {
    const cloze = { answer: 'decided', check: { kind: 'form', base: 'decide' } }
    expect(checkAnswer(cloze, 'decided').result).toBe('correct')
    const res = checkAnswer(cloze, 'decide')
    expect(res.result).toBe('close')
    expect(res.note).toContain('decided')
  })

  it('số điện thoại không cần đúng khoảng trắng', () => {
    const phone = { answer: '07946 512 384', check: { kind: 'digits' } }
    expect(checkAnswer(phone, '07946512384').result).toBe('correct')
    expect(checkAnswer(phone, '0794-651-2384').result).toBe('correct')
    expect(checkAnswer(phone, '07946512385').result).toBe('wrong')
  })

  it('giá tiền nhận nhiều cách viết', () => {
    const price = { answer: '£15.50', check: { kind: 'money', value: 15.5 } }
    for (const s of ['15.50', '15.5', '£15.50', '15,50', '£ 15.50']) expect(checkAnswer(price, s).result).toBe('correct')
    expect(checkAnswer(price, '50.15').result).toBe('wrong')
  })

  it('giờ nhận 7:45, 7.45, 19:45, 745', () => {
    const time = { answer: '7:45', check: { kind: 'time', h: 7, m: 45 } }
    for (const s of ['7:45', '7.45', '19:45', '745', '07:45']) expect(checkAnswer(time, s).result).toBe('correct')
    expect(checkAnswer(time, '8:45').result).toBe('wrong')
    expect(parseTimeAnswer("8 o'clock")).toEqual({ h: 8, m: 0 })
  })

  it('ngày nhận "23 March", "March 23rd", "23/3"', () => {
    const date = { answer: '23 March', check: { kind: 'date', day: 23, month: 2 } }
    for (const s of ['23 March', 'March 23rd', '23rd mar', '23/3', '23-03']) {
      expect(checkAnswer(date, s).result).toBe('correct')
    }
    expect(checkAnswer(date, '23 May').result).toBe('wrong')
    expect(parseDateAnswer('abc')).toBeNull()
  })

  it('đánh vần: thiếu một chữ là gần đúng', () => {
    const name = { answer: 'Russell', check: { kind: 'letters' } }
    expect(checkAnswer(name, 'R-U-S-S-E-L-L').result).toBe('correct')
    expect(checkAnswer(name, 'russel').result).toBe('close')
    expect(checkAnswer(name, 'rasel').result).toBe('wrong')
  })

  it('trắc nghiệm và sắp xếp câu', () => {
    expect(checkAnswer({ check: { kind: 'choice', index: 2 } }, 2).result).toBe('correct')
    expect(checkAnswer({ check: { kind: 'choice', index: 2 } }, 1).result).toBe('wrong')
    const order = { answer: 'Please close the door.', check: { kind: 'sentence' } }
    expect(checkAnswer(order, 'Please close the door.').result).toBe('correct')
    expect(checkAnswer(order, 'Please the close door.').result).toBe('wrong')
  })
})

describe('tìm dạng của từ trong câu ví dụ', () => {
  it('nhận ra quá khứ, số nhiều, -ing, chữ đôi', () => {
    expect(findWordForm('decide', 'She decided to stay.')?.form).toBe('decided')
    expect(findWordForm('city', 'Big cities are noisy.')?.form).toBe('cities')
    expect(findWordForm('stop', 'The bus stopped here.')?.form).toBe('stopped')
    expect(findWordForm('make', 'I am making tea.')?.form).toBe('making')
    expect(findWordForm('win', 'They lost the game.')).toBeNull()
  })
})

describe('lịch làm lại câu sai', () => {
  it('sai → mai làm lại; đúng → giãn dần; gần đúng → giữ hộp', () => {
    const wrong = nextProgress(null, 'wrong', TODAY)
    expect(wrong).toMatchObject({ box: 0, due_on: '2026-10-06', wrong_count: 1 })
    expect(isWeak(wrong)).toBe(true)
    const right = nextProgress(wrong, 'correct', TODAY)
    expect(right).toMatchObject({ box: 1, due_on: '2026-10-07', correct_count: 1 })
    const close = nextProgress({ ...right, box: 2 }, 'close', TODAY)
    expect(close).toMatchObject({ box: 2, due_on: '2026-10-06' })
    const mastered = nextProgress({ ...right, box: 2 }, 'correct', TODAY)
    expect(mastered.box).toBe(3)
    expect(isWeak(mastered)).toBe(false)
  })
})

describe('ghép bài tập', () => {
  it('bài hôm nay: đủ dạng, không trùng thẻ, giữ nguyên khi tạo lại', () => {
    const cards = learnedCards()
    const a = buildHomework({ cards, today: TODAY })
    const b = buildHomework({ cards, today: TODAY })
    expect(a.map((i) => i.key)).toEqual(b.map((i) => i.key))
    expect(a.length).toBeGreaterThanOrEqual(10)
    const cardIds = a.map((i) => i.cardId).filter(Boolean)
    expect(new Set(cardIds).size).toBe(cardIds.length)
    const types = new Set(a.map((i) => i.type))
    for (const t of ['numbers', 'spelling', 'order']) expect(types.has(t)).toBe(true)
    // Chưa có câu đến hạn → phần từ mới học được làm nhiều hơn
    expect(a.filter((i) => ['meaning', 'cloze', 'listen-meaning', 'listen-spell'].includes(i.type)).length).toBe(
      DAILY_PLAN.fresh + DAILY_PLAN.due,
    )
    for (const item of a) {
      expect(item.answer).toBeTruthy()
      expect(item.check?.kind).toBeTruthy()
      expect(JSON.parse(JSON.stringify(item))).toEqual(item)
    }
    // Hai câu liền nhau ít khi cùng dạng
    const sameNeighbours = a.filter((x, i) => i > 0 && x.type === a[i - 1].type).length
    expect(sameNeighbours).toBeLessThanOrEqual(1)
  })

  it('câu đến hạn làm lại được đưa vào bài, câu trắc nghiệm có đủ 4 lựa chọn', () => {
    const cards = learnedCards()
    const progress = new Map([
      ['meaning:card-5', { item_key: 'meaning:card-5', box: 0, due_on: TODAY, wrong_count: 1, correct_count: 0 }],
      ['listen-meaning:card-9', { item_key: 'listen-meaning:card-9', box: 1, due_on: '2026-10-01', wrong_count: 1, correct_count: 1 }],
      ['meaning:card-7', { item_key: 'meaning:card-7', box: 2, due_on: '2026-10-20', wrong_count: 0, correct_count: 2 }],
    ])
    const items = buildHomework({ cards, progress, today: TODAY })
    const keys = items.map((i) => i.key)
    expect(keys).toContain('meaning:card-5')
    expect(keys).toContain('listen-meaning:card-9')
    expect(keys).not.toContain('meaning:card-7')
    const choice = items.find((i) => i.key === 'listen-meaning:card-9')
    expect(choice.options).toHaveLength(4)
    expect(choice.options[choice.check.index]).toBe(choice.answer)
  })

  it('chưa học từ nào vẫn có bài (luyện số và đánh vần)', () => {
    const items = buildHomework({ cards: SEED_CARDS.map((c) => ({ ...c, due_date: null })), today: TODAY })
    expect(items.length).toBeGreaterThanOrEqual(8)
    expect(items.every((i) => ['numbers', 'spelling'].includes(i.type))).toBe(true)
  })

  it('lỗi chính tả hay gặp được đưa vào dạng nghe viết từ', () => {
    const mistakes = [{ key: 'weather', word: 'weather', count: 3, sentence: 'The weather is nice.' }]
    const items = buildHomework({ cards: learnedCards(), mistakes, today: TODAY })
    const w = items.find((i) => i.key === 'spellword:weather')
    expect(w).toMatchObject({ type: 'listen-spell', answer: 'weather', audio: { text: 'weather' } })
  })

  it('sổ lỗi chỉ gồm câu còn yếu; luyện theo dạng chỉ ra đúng dạng đó', () => {
    const cards = learnedCards()
    const progress = new Map([
      ['cloze:card-3', { item_key: 'cloze:card-3', box: 0, due_on: '2026-10-09', wrong_count: 2, correct_count: 0 }],
      ['meaning:card-4', { item_key: 'meaning:card-4', box: 3, due_on: '2026-10-20', wrong_count: 1, correct_count: 3 }],
      ['spelling:Russell', { item_key: 'spelling:Russell', box: 0, due_on: '2026-10-06', wrong_count: 1, correct_count: 0 }],
    ])
    const weak = buildHomework({ cards, progress, today: TODAY, mode: 'mistakes' })
    expect(weak.map((i) => i.key).sort()).toEqual(['spelling:Russell'].concat(
      findWordForm(cards[3].word, cards[3].example_en) ? ['cloze:card-3'] : [],
    ).sort())

    for (const type of ['meaning', 'order', 'numbers', 'spelling']) {
      const items = buildHomework({ cards, today: TODAY, mode: 'type', type })
      expect(items.length).toBeGreaterThan(0)
      expect(items.every((i) => i.type === type)).toBe(true)
    }
  })

  it('đếm kết quả', () => {
    expect(summarize([{ result: 'correct' }, { result: 'close' }, { result: 'wrong' }, { result: 'correct' }])).toEqual({
      total: 4,
      correct: 2,
      close: 1,
      wrong: 1,
    })
  })
})
