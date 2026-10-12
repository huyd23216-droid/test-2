// Từ điển nhỏ kèm câu cloze: item.glossary = { "mental health": "sức khỏe tinh thần", … }
// Khóa là từ / cụm từ như trong text (không phân biệt hoa thường). Trong đoạn văn, các từ này
// được gạch chân chấm; chạm vào để xem nghĩa, nghe và thêm vào thẻ.
import { parseCloze } from './homeworkSets.js'

const WORD_CHAR = /[\p{L}\p{N}]/u
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const cardKey = (word) =>
  String(word ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

// Các mục hợp lệ của glossary, cụm dài nhất trước (để "mental health" được khớp trước "health").
// Mục thiếu nghĩa hoặc trùng khóa (khác hoa thường) bị bỏ qua; glossary sai kiểu coi như không có.
export function glossaryEntries(glossary) {
  if (!glossary || typeof glossary !== 'object' || Array.isArray(glossary)) return []
  const seen = new Set()
  const out = []
  for (const [raw, meaning] of Object.entries(glossary)) {
    const word = raw.replace(/\s+/g, ' ').trim()
    if (!word || typeof meaning !== 'string' || !meaning.trim() || seen.has(cardKey(word))) continue
    seen.add(cardKey(word))
    out.push({ word, meaning: meaning.trim() })
  }
  return out.sort((a, b) => b.word.length - a.word.length)
}

// Khớp cả từ (không khớp "health" trong "healthy"), khoảng trắng giữa các chữ tùy ý,
// dấu ' và ’ như nhau. Ranh giới phía trước được kiểm tra trong markGlossary
// (không dùng lookbehind vì Safari cũ chưa hỗ trợ).
function phraseRe(word) {
  const body = word
    .split(' ')
    .map((w) => escapeRe(w).replace(/['‘’ʼ]/g, "['‘’ʼ]"))
    .join('\\s+')
  return new RegExp(`${body}(?![\\p{L}\\p{N}])`, 'giu')
}

// Tách một đoạn chữ thành [{ text, start } | { text, start, term: { word, meaning } }].
// Cụm dài nhất được khớp trước; chữ đã thuộc một cụm thì không khớp lại vào cụm khác.
export function markGlossary(text, entries) {
  const hits = []
  for (const term of entries) {
    const re = phraseRe(term.word)
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const start = m.index
      const end = start + m[0].length
      re.lastIndex = start + 1
      if (WORD_CHAR.test(text[start - 1] ?? '')) continue
      if (hits.some((h) => start < h.end && end > h.start)) continue
      hits.push({ start, end, term })
      re.lastIndex = end
    }
  }
  hits.sort((a, b) => a.start - b.start)
  const out = []
  let last = 0
  for (const h of hits) {
    if (h.start > last) out.push({ text: text.slice(last, h.start), start: last })
    out.push({ text: text.slice(h.start, h.end), start: h.start, term: h.term })
    last = h.end
  }
  if (last < text.length) out.push({ text: text.slice(last), start: last })
  return out
}

// Hết câu: . ! ? … (có thể kèm ngoặc kép, ngoặc đóng) rồi khoảng trắng hoặc hết dòng.
// "Mr." "Dr." "e.g." … không phải hết câu.
const SENTENCE_END = /[.!?…]+["'”’)\]]*(?=\s|$)/g
const ABBREVIATION = /\b(?:Mr|Mrs|Ms|Dr|Prof|St|e\.g|i\.e|vs)\.$/i

// Câu chứa vị trí pos trong một dòng
export function sentenceAt(text, pos) {
  let start = 0
  for (const m of text.matchAll(SENTENCE_END)) {
    const end = m.index + m[0].length
    if (ABBREVIATION.test(text.slice(0, end))) continue
    if (end > pos) return text.slice(start, end).replace(/\s+/g, ' ').trim()
    start = end
  }
  return text.slice(start).replace(/\s+/g, ' ').trim()
}

// Đoạn văn cloze như parseCloze, mỗi phần chữ có thêm
// segments: [{ text } | { text, term: { word, meaning, sentence } }].
// Chỉ đánh dấu chữ ngoài chỗ trống. sentence là câu chứa từ đó (bỏ tên người nói,
// chỗ trống điền đáp án đúng), dùng làm câu ví dụ khi thêm vào thẻ.
// Không có glossary thì trả về đúng như parseCloze.
export function glossaryLines(item) {
  const lines = parseCloze(item.text)
  const entries = glossaryEntries(item.glossary)
  if (!entries.length) return lines
  return lines.map((line) => {
    let full = ''
    const offsets = line.parts.map((p) => {
      const at = full.length
      full += p.type === 'text' ? p.text : (item.blanks?.[p.n]?.answer ?? '')
      return at
    })
    return {
      ...line,
      parts: line.parts.map((p, j) => {
        if (p.type !== 'text') return p
        const segments = markGlossary(p.text, entries).map((s) =>
          s.term
            ? { text: s.text, term: { ...s.term, sentence: sentenceAt(full, offsets[j] + s.start) } }
            : { text: s.text },
        )
        return { ...p, segments }
      }),
    }
  })
}

// Đã có thẻ cho từ này chưa (không phân biệt hoa thường)
export function hasCard(cards, word) {
  const key = cardKey(word)
  return cards.some((c) => cardKey(c.word) === key)
}

// Nút "+ Thêm vào thẻ": tạo thẻ mới bằng addCard của app (từ, nghĩa, câu ví dụ trong đoạn văn).
// Từ đã có thẻ thì không tạo trùng. Trả về thẻ vừa tạo, hoặc null.
export function addGlossaryCard(term, { cards, addCard }) {
  if (hasCard(cards, term.word)) return null
  return addCard({ word: term.word, meaning_vi: term.meaning, example_en: term.sentence })
}
