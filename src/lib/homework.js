// Bài tập về nhà: tạo bài từ chính những gì bạn đã học, chấm đáp án (dễ tính với
// lỗi gõ nhỏ) và xếp lịch làm lại câu sai theo kiểu hộp Leitner:
// sai → mai làm lại; đúng → giãn dần 2, 4, 8, 16, 32 ngày.
import { addDays, daysBetween } from './dates.js'
import { isNewCard } from './srs.js'

export const HOMEWORK_TYPES = {
  meaning: {
    label: 'Nhìn nghĩa, gõ từ',
    desc: 'Nhớ chủ động: thấy nghĩa tiếng Việt, tự gõ ra từ tiếng Anh.',
  },
  cloze: {
    label: 'Điền từ vào câu',
    desc: 'Dùng từ đúng dạng (thì, số nhiều…) trong câu ví dụ.',
  },
  'listen-meaning': {
    label: 'Nghe, chọn nghĩa',
    desc: 'Chỉ nghe, không nhìn chữ, rồi chọn nghĩa đúng.',
  },
  'listen-spell': {
    label: 'Nghe, viết từ',
    desc: 'Nghe và viết đúng chính tả, gồm cả những từ bạn hay chép sai.',
  },
  order: {
    label: 'Sắp xếp câu',
    desc: 'Xếp các từ thành câu đúng để quen trật tự từ và cụm từ.',
  },
  numbers: {
    label: 'Số, giá tiền, ngày, giờ',
    desc: 'Dạng hay gặp nhất ở IELTS Listening Part 1, đọc bằng giọng Anh.',
  },
  spelling: {
    label: 'Nghe đánh vần tên',
    desc: 'Tên người, tên đường được đánh vần từng chữ như trong đề IELTS.',
  },
}

export const HOMEWORK_TYPE_IDS = Object.keys(HOMEWORK_TYPES)

const CARD_TYPES = ['meaning', 'cloze', 'listen-meaning', 'listen-spell', 'order']
const FRESH_TYPES = ['meaning', 'cloze', 'listen-meaning', 'listen-spell']

// Hộp Leitner: số ngày tới lần làm lại sau khi trả lời đúng ở hộp tương ứng
const BOX_DAYS = [1, 2, 4, 8, 16, 32]
const MAX_BOX = BOX_DAYS.length - 1
// Từ hộp này trở lên coi như đã vững, rời khỏi sổ lỗi
export const MASTERED_BOX = 3

export const DAILY_PLAN = { due: 4, fresh: 5, words: 1, order: 1, numbers: 1, spelling: 1 }
const MIN_ITEMS = 8
const TYPE_ROUND = 10

// ---------- Ngẫu nhiên có hạt giống (bài trong ngày giữ nguyên khi tải lại) ----------
export function seededRandom(seed) {
  let h = 1779033703 ^ String(seed).length
  for (const ch of String(seed)) {
    h = Math.imul(h ^ ch.charCodeAt(0), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)]

function shuffled(list, rng) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// ---------- Đọc số thành chữ ----------
const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

export function numberToWords(n) {
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')
  if (n < 1000) {
    const rest = n % 100
    return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` and ${numberToWords(rest)}` : ''}`
  }
  const rest = n % 1000
  const tail = rest ? (rest < 100 ? ` and ${numberToWords(rest)}` : ` ${numberToWords(rest)}`) : ''
  return `${numberToWords(Math.floor(n / 1000))} thousand${tail}`
}

const ORDINAL_SPECIAL = { 1: 'first', 2: 'second', 3: 'third', 5: 'fifth', 8: 'eighth', 9: 'ninth', 12: 'twelfth' }

export function ordinalWords(n) {
  if (n < 20) return ORDINAL_SPECIAL[n] ?? `${ONES[n]}th`
  if (n % 10 === 0) return TENS[n / 10].replace(/y$/, 'ieth')
  return `${TENS[Math.floor(n / 10)]}-${ordinalWords(n % 10)}`
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November',
  'December',
]
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export function timeWords(h, m, digital = false) {
  const hour = numberToWords(h)
  if (digital) {
    if (m === 0) return `${hour} o'clock`
    return `${hour} ${m < 10 ? `oh ${numberToWords(m)}` : numberToWords(m)}`
  }
  const next = numberToWords((h % 12) + 1)
  if (m === 0) return `${hour} o'clock`
  if (m === 15) return `quarter past ${hour}`
  if (m === 30) return `half past ${hour}`
  if (m === 45) return `quarter to ${next}`
  if (m < 30) return `${numberToWords(m)} past ${hour}`
  return `${numberToWords(60 - m)} to ${next}`
}

// Đọc từng chữ số kiểu Anh: 0 là "oh", số lặp lại đọc là "double" / "triple"
export function speakDigits(digits) {
  const words = []
  let i = 0
  while (i < digits.length) {
    const d = digits[i]
    let run = 1
    while (digits[i + run] === d) run++
    i += run
    const word = d === '0' ? 'oh' : ONES[Number(d)]
    while (run > 0) {
      const take = run === 3 || run > 4 ? 3 : run >= 2 ? 2 : 1
      words.push(take === 3 ? `triple ${word}` : take === 2 ? `double ${word}` : word)
      run -= take
    }
  }
  return words.join(' ')
}

// Đánh vần: "R, U, double S, E, double L"
export function spellOut(name) {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '')
  const parts = []
  for (let i = 0; i < letters.length; i++) {
    if (letters[i + 1] === letters[i]) {
      parts.push(`double ${letters[i]}`)
      i++
    } else {
      parts.push(letters[i])
    }
  }
  return parts.join(', ')
}

// ---------- Chấm đáp án ----------
export function normalizeText(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .trim()
    .replace(/[.,!?;:"]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

const isTypo = (expected, actual) => {
  const d = editDistance(expected, actual)
  return d > 0 && ((expected.length >= 4 && d === 1) || (expected.length >= 9 && d === 2))
}

const digitsOnly = (s) => String(s ?? '').replace(/\D/g, '')

function parseMoney(s) {
  let t = String(s ?? '').replace(/[^\d.,]/g, '')
  if (/,\d{2}$/.test(t) && !t.includes('.')) t = t.replace(',', '.')
  t = t.replace(/,/g, '')
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : null
}

export function parseTimeAnswer(s) {
  const t = String(s ?? '').toLowerCase().trim()
  let m = t.match(/(\d{1,2})\s*[:.h]\s*(\d{2})/)
  if (m) return { h: Number(m[1]), m: Number(m[2]) }
  m = t.match(/^(\d{1,2})(\d{2})$/)
  if (m) return { h: Number(m[1]), m: Number(m[2]) }
  m = t.match(/^(\d{1,2})\s*(o'?clock|am|pm|giờ)?$/)
  if (m) return { h: Number(m[1]), m: 0 }
  return null
}

export function parseDateAnswer(s) {
  const t = String(s ?? '').toLowerCase()
  const numbers = (t.match(/\d{1,2}/g) ?? []).map(Number)
  const month = MONTHS.findIndex((name) => new RegExp(`\\b${name.slice(0, 3).toLowerCase()}`).test(t))
  if (month >= 0 && numbers.length) return { day: numbers[0], month }
  if (numbers.length >= 2) return { day: numbers[0], month: numbers[1] - 1 }
  return null
}

const lettersOnly = (s) => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '')

// Kết quả: correct | close (gần đúng, vd gõ sai 1 chữ) | wrong, kèm lời nhắn
export function checkAnswer(item, input) {
  const c = item.check
  switch (c.kind) {
    case 'choice':
      return Number(input) === c.index ? { result: 'correct' } : { result: 'wrong' }
    case 'word':
    case 'form': {
      const expected = normalizeText(item.answer)
      const actual = normalizeText(input)
      if (!actual) return { result: 'wrong' }
      if (actual === expected) return { result: 'correct' }
      if (c.kind === 'form' && c.base && actual === normalizeText(c.base)) {
        return { result: 'close', note: `Đúng từ rồi! Nhưng câu này cần dạng “${item.answer}”.` }
      }
      if (isTypo(expected, actual)) {
        return { result: 'close', note: `Gần đúng rồi, chỉ lệch một chút chính tả: “${item.answer}”.` }
      }
      return { result: 'wrong' }
    }
    case 'sentence':
      return normalizeText(input) === normalizeText(item.answer) ? { result: 'correct' } : { result: 'wrong' }
    case 'digits':
      return digitsOnly(input) && digitsOnly(input) === digitsOnly(item.answer)
        ? { result: 'correct' }
        : { result: 'wrong' }
    case 'money': {
      const n = parseMoney(input)
      return n !== null && Math.abs(n - c.value) < 0.001 ? { result: 'correct' } : { result: 'wrong' }
    }
    case 'time': {
      const t = parseTimeAnswer(input)
      return t && t.h % 12 === c.h % 12 && t.m === c.m ? { result: 'correct' } : { result: 'wrong' }
    }
    case 'date': {
      const d = parseDateAnswer(input)
      return d && d.day === c.day && d.month === c.month ? { result: 'correct' } : { result: 'wrong' }
    }
    case 'letters': {
      const expected = lettersOnly(item.answer)
      const actual = lettersOnly(input)
      if (actual === expected) return { result: 'correct' }
      if (actual && editDistance(expected, actual) === 1) {
        return { result: 'close', note: `Thiếu hoặc nhầm một chữ cái. Viết đúng là: ${item.answer}.` }
      }
      return { result: 'wrong' }
    }
    default:
      return { result: 'wrong' }
  }
}

// ---------- Lịch làm lại (Leitner) ----------
export function nextProgress(prev, result, today, now = new Date()) {
  const box = prev?.box ?? 0
  let nextBox = box
  let due = addDays(today, 1)
  if (result === 'correct') {
    nextBox = Math.min(box + 1, MAX_BOX)
    due = addDays(today, BOX_DAYS[nextBox])
  } else if (result === 'wrong') {
    nextBox = 0
  }
  return {
    box: nextBox,
    due_on: due,
    correct_count: (prev?.correct_count ?? 0) + (result === 'correct' ? 1 : 0),
    wrong_count: (prev?.wrong_count ?? 0) + (result === 'correct' ? 0 : 1),
    last_result: result,
    last_seen_at: now.toISOString(),
  }
}

// Thống kê theo dạng (số, ngày, giờ…): chỉ đếm, không xếp lịch
export function nextStat(prev, result, now = new Date()) {
  return {
    box: 0,
    due_on: null,
    correct_count: (prev?.correct_count ?? 0) + (result === 'correct' ? 1 : 0),
    wrong_count: (prev?.wrong_count ?? 0) + (result === 'correct' ? 0 : 1),
    last_result: result,
    last_seen_at: now.toISOString(),
  }
}

export const isWeak = (row) => Boolean(row?.due_on) && row.wrong_count > 0 && row.box < MASTERED_BOX

// ---------- Từ vựng dùng được cho bài tập ----------
const FUNCTION_POS = /^(article|preposition|pronoun|conjunction|determiner|modal|number)(,|$)/

export function usableCard(card) {
  const word = card.word?.trim() ?? ''
  return word.length >= 3 && /^[a-z][a-z'-]*$/i.test(word) && Boolean(card.meaning_vi) && !FUNCTION_POS.test(card.pos ?? '')
}

// Tìm dạng của từ trong câu ví dụ (decide → decided, city → cities…)
export function findWordForm(word, sentence) {
  const w = word.toLowerCase()
  const stemE = w.replace(/e$/, '')
  const stemY = w.replace(/y$/, 'i')
  const last = w.slice(-1)
  const forms = new Set([
    w, `${w}s`, `${w}es`, `${w}d`, `${w}ed`, `${w}ing`, `${w}er`, `${w}est`, `${w}ly`,
    `${stemE}ing`, `${stemY}es`, `${stemY}ed`, `${stemY}er`, `${stemY}est`, `${stemY}ly`,
    `${w}${last}ed`, `${w}${last}ing`, `${w}${last}er`,
  ])
  for (const m of String(sentence ?? '').matchAll(/[A-Za-z]+(?:'[A-Za-z]+)?/g)) {
    if (forms.has(m[0].toLowerCase())) return { form: m[0], start: m.index, end: m.index + m[0].length }
  }
  return null
}

const orderTokens = (sentence) => String(sentence ?? '').trim().split(/\s+/).filter(Boolean)

function applicableTypes(card) {
  const types = ['meaning', 'listen-spell', 'listen-meaning']
  if (findWordForm(card.word, card.example_en)) types.push('cloze')
  const n = orderTokens(card.example_en).length
  if (n >= 4 && n <= 12) types.push('order')
  return types
}

// ---------- Tạo từng câu bài tập ----------
function cardItem(type, card, ctx) {
  const base = {
    key: `${type}:${card.id}`,
    type,
    cardId: card.id,
    word: card.word,
    ipa: card.ipa,
    meaning: card.meaning_vi,
    pos: card.pos,
    example: card.example_en,
    exampleVi: card.example_vi,
    answer: card.word,
  }
  switch (type) {
    case 'meaning':
      return { ...base, check: { kind: 'word' }, replay: card.word }
    case 'listen-spell':
      return { ...base, audio: { text: card.word }, check: { kind: 'word' } }
    case 'listen-meaning': {
      const pool = shuffled(
        ctx.allCards.filter(
          (c) => c.id !== card.id && c.meaning_vi && c.meaning_vi !== card.meaning_vi && c.word !== card.word,
        ),
        ctx.rng,
      )
      const samePos = pool.filter((c) => c.pos === card.pos)
      const distractors = []
      for (const c of [...samePos, ...pool]) {
        if (distractors.length === 3) break
        if (!distractors.includes(c.meaning_vi)) distractors.push(c.meaning_vi)
      }
      if (distractors.length < 3) return null
      const options = shuffled([card.meaning_vi, ...distractors], ctx.rng)
      return {
        ...base,
        audio: { text: card.word },
        options,
        answer: card.meaning_vi,
        check: { kind: 'choice', index: options.indexOf(card.meaning_vi) },
      }
    }
    case 'cloze': {
      const found = findWordForm(card.word, card.example_en)
      if (!found) return null
      return {
        ...base,
        before: card.example_en.slice(0, found.start),
        after: card.example_en.slice(found.end),
        answer: found.form,
        check: { kind: 'form', base: card.word },
        replay: card.example_en,
      }
    }
    case 'order': {
      const tokens = orderTokens(card.example_en)
      if (tokens.length < 4 || tokens.length > 12) return null
      let mixed = shuffled(tokens, ctx.rng)
      for (let i = 0; i < 5 && mixed.join(' ') === tokens.join(' '); i++) mixed = shuffled(tokens, ctx.rng)
      if (mixed.join(' ') === tokens.join(' ')) return null
      return { ...base, tokens: mixed, answer: card.example_en, check: { kind: 'sentence' }, replay: card.example_en }
    }
    default:
      return null
  }
}

function wordItem(word, sentence) {
  return {
    key: `spellword:${word.toLowerCase()}`,
    type: 'listen-spell',
    word,
    answer: word,
    example: sentence,
    audio: { text: word },
    check: { kind: 'word' },
    fromDictation: true,
  }
}

// ---------- IELTS Part 1: số, giá tiền, ngày, giờ ----------
const NUMBER_SUBTYPES = {
  phone: 'Số điện thoại',
  price: 'Giá tiền',
  time: 'Giờ',
  date: 'Ngày tháng',
  count: 'Số đếm (-teen / -ty)',
  big: 'Số lớn',
}
export const NUMBER_SUBTYPE_LABELS = NUMBER_SUBTYPES

function numberItem(subtype, rng) {
  const id = Math.floor(rng() * 1e9).toString(36)
  const base = { type: 'numbers', subtype, stat: `numbers:${subtype}`, key: `numbers:${subtype}:${id}` }
  switch (subtype) {
    case 'phone': {
      let digits = '07'
      while (digits.length < 11) digits += String(Math.floor(rng() * 10))
      if (rng() < 0.6) {
        const i = 3 + Math.floor(rng() * 6)
        digits = digits.slice(0, i) + digits[i - 1] + digits.slice(i + 1)
      }
      const groups = [digits.slice(0, 5), digits.slice(5, 8), digits.slice(8)]
      const spoken = groups.map(speakDigits).join(', ')
      const text = pick(
        ['My phone number is {x}.', 'You can call me on {x}.', 'The number for the office is {x}.'],
        rng,
      ).replace('{x}', spoken)
      return { ...base, audio: { text, accent: 'uk' }, answer: groups.join(' '), check: { kind: 'digits' }, hint: 'Gõ các chữ số' }
    }
    case 'price': {
      const pounds = 2 + Math.floor(rng() * 98)
      const pence = pick([0, 50, 99, 25, 75, 95, 49, 20], rng)
      const value = pounds + pence / 100
      const label = pence ? `£${pounds}.${String(pence).padStart(2, '0')}` : `£${pounds}`
      const spoken = pence ? `${numberToWords(pounds)} pounds ${numberToWords(pence)}` : `${numberToWords(pounds)} pounds`
      const text = pick(
        ['The ticket costs {x}.', "It's {x} per person.", 'The total comes to {x}.', 'A single room is {x} a night.'],
        rng,
      ).replace('{x}', spoken)
      return { ...base, audio: { text, accent: 'uk' }, answer: label, check: { kind: 'money', value }, hint: 'Gõ số tiền, ví dụ 15.50' }
    }
    case 'time': {
      const h = 1 + Math.floor(rng() * 12)
      const m = pick([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], rng)
      const spoken = timeWords(h, m, rng() < 0.35)
      const text = pick(
        ['The train leaves at {x}.', 'The meeting starts at {x}.', 'Please arrive by {x}.', 'The museum closes at {x}.'],
        rng,
      ).replace('{x}', spoken)
      const label = `${h}:${String(m).padStart(2, '0')}`
      return { ...base, audio: { text, accent: 'uk' }, answer: label, check: { kind: 'time', h, m }, hint: 'Gõ giờ, ví dụ 7:45' }
    }
    case 'date': {
      const month = Math.floor(rng() * 12)
      const day = 1 + Math.floor(rng() * MONTH_DAYS[month])
      const spoken = rng() < 0.5 ? `the ${ordinalWords(day)} of ${MONTHS[month]}` : `${MONTHS[month]} the ${ordinalWords(day)}`
      const text = pick(
        ['The course starts on {x}.', 'My appointment is on {x}.', "We're leaving on {x}.", 'The deadline is {x}.'],
        rng,
      ).replace('{x}', spoken)
      return {
        ...base,
        audio: { text, accent: 'uk' },
        answer: `${day} ${MONTHS[month]}`,
        check: { kind: 'date', day, month },
        hint: 'Gõ ngày và tháng, ví dụ 23 March hoặc 23/3',
      }
    }
    case 'count': {
      const teen = 13 + Math.floor(rng() * 7)
      const n = rng() < 0.5 ? teen : (teen - 10) * 10
      const text = pick(
        ['There are {x} students in the class.', 'The tour takes {x} minutes.', 'Your room number is {x}.', 'We need {x} chairs.'],
        rng,
      ).replace('{x}', numberToWords(n))
      return { ...base, audio: { text, accent: 'uk' }, answer: String(n), check: { kind: 'digits' }, hint: 'Gõ con số' }
    }
    case 'big':
    default: {
      const n = pick([150, 250, 375, 480, 1200, 1250, 1500, 2400, 3750, 4500, 12000, 15500], rng) + Math.floor(rng() * 9) * 10
      const text = pick(
        ['The hall can hold {x} people.', 'About {x} visitors come every week.', 'The car costs {x} pounds.'],
        rng,
      ).replace('{x}', numberToWords(n))
      return { ...base, subtype: 'big', stat: 'numbers:big', audio: { text, accent: 'uk' }, answer: String(n), check: { kind: 'digits' }, hint: 'Gõ con số' }
    }
  }
}

// Dạng nào bạn hay sai thì được chọn nhiều hơn
function weightedSubtype(progress, rng) {
  const ids = Object.keys(NUMBER_SUBTYPES)
  const weights = ids.map((id) => {
    const row = progress.get(`numbers:${id}`)
    return ((row?.wrong_count ?? 0) + 1) / ((row?.correct_count ?? 0) + 1)
  })
  let r = rng() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < ids.length; i++) {
    r -= weights[i]
    if (r <= 0) return ids[i]
  }
  return ids[ids.length - 1]
}

export const SPELLING_NAMES = [
  'Thompson', 'Fitzgerald', 'Hughes', 'Wright', 'Collins', 'Harrison', 'Sinclair', 'Whitfield', 'Bradley', 'Russell',
  'Kennedy', 'Matthews', 'Phillips', 'Bennett', 'Lawrence', 'Gallagher', 'Hutchinson', 'Sullivan', 'Atkinson',
  'Mitchell', 'Reynolds', 'Crawford', 'Marshall', 'Fletcher', 'Holloway', 'Pemberton', 'Ashworth', 'Cartwright',
  'Dawson', 'Jefferson', 'Kingsley', 'Gregory', 'Woodward', 'Chapman', 'Ellison', 'Barnett', 'Lockwood', 'Whitmore',
  'Abbott', 'Connolly',
]

function spellingItem(name, rng) {
  const template = pick(
    [
      'My surname is {n}. That’s {s}.',
      'The name is {n}, spelled {s}.',
      'I live on {n} Road. That’s {s}.',
      'The hotel is called the {n}. That’s {s}.',
    ],
    rng,
  )
  return {
    key: `spelling:${name}`,
    type: 'spelling',
    audio: { text: template.replace('{n}', name).replace('{s}', spellOut(name)), accent: 'uk' },
    answer: name,
    check: { kind: 'letters' },
    hint: 'Gõ tên vừa được đánh vần',
  }
}

// Dựng lại một câu từ khóa đã lưu (dùng cho câu làm lại / sổ lỗi)
export function itemFromKey(key, ctx) {
  const at = key.indexOf(':')
  const type = key.slice(0, at)
  const rest = key.slice(at + 1)
  if (CARD_TYPES.includes(type)) {
    const card = ctx.cardById.get(rest)
    return card ? cardItem(type, card, ctx) : null
  }
  if (type === 'spellword') {
    const m = ctx.mistakes.find((x) => x.key === rest)
    return wordItem(m?.word ?? rest, m?.sentence)
  }
  if (type === 'spelling') return spellingItem(rest, ctx.rng)
  return null
}

// ---------- Ghép bài ----------
function cardPriority(card, progress, today) {
  let score = 0
  if (card.lapses > 0) score += 3
  if (card.introduced_on && daysBetween(card.introduced_on, today) <= 7) score += 2
  if ((card.stability ?? card.interval_days ?? 0) < 3) score += 1
  if (!CARD_TYPES.some((t) => progress.has(`${t}:${card.id}`))) score += 1
  return score
}

// Không để 2 câu cùng dạng đứng cạnh nhau nếu tránh được
function interleave(items, rng) {
  const list = shuffled(items, rng)
  for (let i = 1; i < list.length; i++) {
    if (list[i].type !== list[i - 1].type) continue
    const j = list.findIndex((x, k) => k > i && x.type !== list[i - 1].type)
    if (j > 0) [list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

function makeContext({ cards, progress, mistakes = [], seed }) {
  const rng = seededRandom(seed)
  const allCards = cards.filter((c) => c.meaning_vi)
  return {
    rng,
    progress,
    mistakes,
    allCards,
    cardById: new Map(cards.map((c) => [c.id, c])),
    learned: cards.filter((c) => !isNewCard(c) && usableCard(c)),
  }
}

// Chọn dạng bài cho một thẻ: dạng chưa vững, ít xuất hiện trong bài hôm nay
function chooseType(card, types, used, ctx) {
  const options = types
    .filter((t) => applicableTypes(card).includes(t))
    .map((t) => ({ t, box: ctx.progress.get(`${t}:${card.id}`)?.box ?? 0 }))
    .filter((o) => o.box < MASTERED_BOX)
  if (!options.length) return null
  options.sort((a, b) => (used[a.t] ?? 0) * 2 + a.box - ((used[b.t] ?? 0) * 2 + b.box) || ctx.rng() - 0.5)
  return options[0].t
}

function freshCardItems(ctx, count, { types = FRESH_TYPES, exclude = new Set(), today }) {
  const ranked = shuffled(ctx.learned, ctx.rng)
    .filter((c) => !exclude.has(c.id))
    .map((c) => ({ c, score: cardPriority(c, ctx.progress, today) }))
    .sort((a, b) => b.score - a.score)
  const used = {}
  const out = []
  for (const { c } of ranked) {
    if (out.length >= count) break
    const type = chooseType(c, types, used, ctx)
    if (!type) continue
    const item = cardItem(type, c, ctx)
    if (!item) continue
    used[type] = (used[type] ?? 0) + 1
    exclude.add(c.id)
    out.push(item)
  }
  return out
}

function dueItems(ctx, today, limit) {
  const rows = [...ctx.progress.values()]
    .filter((r) => r.due_on && r.due_on <= today && r.box < MAX_BOX)
    .sort((a, b) => a.due_on.localeCompare(b.due_on) || a.box - b.box)
  const out = []
  for (const r of rows) {
    if (out.length >= limit) break
    const item = itemFromKey(r.item_key, ctx)
    if (item) out.push(item)
  }
  return out
}

function spellingNames(ctx, count) {
  const fresh = shuffled(SPELLING_NAMES, ctx.rng).sort(
    (a, b) => (ctx.progress.get(`spelling:${a}`)?.box ?? 0) - (ctx.progress.get(`spelling:${b}`)?.box ?? 0),
  )
  return fresh.slice(0, count).map((n) => spellingItem(n, ctx.rng))
}

/**
 * Tạo một bài tập.
 * mode: 'daily' (bài hôm nay) | 'mistakes' (sổ lỗi) | 'type' (luyện một dạng)
 * Trả về danh sách câu (JSON thuần, lưu được để làm tiếp sau khi tải lại trang).
 */
export function buildHomework({ cards, progress = new Map(), mistakes = [], today, seed, mode = 'daily', type }) {
  const ctx = makeContext({ cards, progress, mistakes, seed: seed ?? `${today}:${mode}:${type ?? ''}` })

  if (mode === 'mistakes') {
    const weak = [...progress.values()]
      .filter(isWeak)
      .sort((a, b) => (a.last_result === 'wrong' ? -1 : 0) - (b.last_result === 'wrong' ? -1 : 0) || a.box - b.box)
    const items = weak.map((r) => itemFromKey(r.item_key, ctx)).filter(Boolean)
    return interleave(items.slice(0, 15), ctx.rng)
  }

  if (mode === 'type') {
    if (type === 'numbers') {
      return Array.from({ length: TYPE_ROUND }, () => numberItem(weightedSubtype(progress, ctx.rng), ctx.rng))
    }
    if (type === 'spelling') return spellingNames(ctx, 8)
    if (type === 'listen-spell') {
      const words = mistakes
        .filter((m) => !(progress.get(`spellword:${m.key}`)?.box >= MASTERED_BOX))
        .slice(0, 3)
        .map((m) => wordItem(m.word, m.sentence))
      return interleave([...words, ...freshCardItems(ctx, TYPE_ROUND - words.length, { types: [type], today })], ctx.rng)
    }
    return freshCardItems(ctx, TYPE_ROUND, { types: [type], today })
  }

  // Bài hôm nay: câu đến hạn làm lại + từ mới học + lỗi chính tả + IELTS
  const plan = DAILY_PLAN
  const items = dueItems(ctx, today, plan.due)
  const usedCards = new Set(items.map((i) => i.cardId).filter(Boolean))
  const usedKeys = new Set(items.map((i) => i.key))

  // Ít câu đến hạn thì làm nhiều từ mới học hơn, để bài luôn khoảng 12 câu
  const freshCount = plan.fresh + Math.max(0, plan.due - items.length)
  items.push(...freshCardItems(ctx, freshCount, { exclude: usedCards, today }))
  items.push(...freshCardItems(ctx, plan.order, { types: ['order'], exclude: usedCards, today }))

  const words = mistakes
    .filter((m) => !usedKeys.has(`spellword:${m.key}`) && !(progress.get(`spellword:${m.key}`)?.box >= MASTERED_BOX))
    .slice(0, plan.words)
    .map((m) => wordItem(m.word, m.sentence))
  items.push(...words)

  const spelling = spellingNames(ctx, plan.spelling + 1).filter((s) => !usedKeys.has(s.key)).slice(0, plan.spelling)
  items.push(...spelling)
  for (let i = 0; i < plan.numbers; i++) items.push(numberItem(weightedSubtype(progress, ctx.rng), ctx.rng))

  // Mới học ít từ: thêm câu IELTS cho đủ một bài
  while (items.length < MIN_ITEMS) items.push(numberItem(weightedSubtype(progress, ctx.rng), ctx.rng))

  return interleave(items, ctx.rng)
}

// Khóa lưu bài đang làm dở trên thiết bị (để tải lại trang vẫn làm tiếp được)
export const runStorageKey = (userId, today, mode, type, round) =>
  `hw-run:${userId}:${today}:${mode}:${type ?? ''}:${round}`

// Cần nghe gì trước để bấm là phát ngay (giọng Google)
export function audioTexts(items) {
  return items.flatMap((i) => [i.audio?.text, i.replay].filter(Boolean))
}

// Tóm tắt kết quả: { total, correct, close, wrong }
export function summarize(results) {
  const out = { total: results.length, correct: 0, close: 0, wrong: 0 }
  for (const r of results) out[r.result] = (out[r.result] ?? 0) + 1
  return out
}

// Độ chính xác theo dạng bài trong N ngày gần đây (từ lịch sử các lần làm bài)
export function accuracyByType(homeworkSessions, today, days = 30) {
  const from = addDays(today, -days + 1)
  const map = new Map()
  for (const s of homeworkSessions) {
    if (s.study_date < from) continue
    for (const r of s.items ?? []) {
      const entry = map.get(r.type) ?? { type: r.type, total: 0, correct: 0 }
      entry.total += 1
      entry.correct += r.result === 'correct' ? 1 : r.result === 'close' ? 0.5 : 0
      map.set(r.type, entry)
    }
  }
  return HOMEWORK_TYPE_IDS.filter((t) => map.has(t)).map((t) => map.get(t))
}
