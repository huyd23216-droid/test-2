// Bài "nghe điền từ": đục vài chỗ trống trong câu. Ưu tiên các từ nhỏ hay bị
// đọc lướt (to, of, can, have…) vì đó là chỗ người học hay nghe sót nhất,
// cộng thêm vài từ nội dung.

const WEAK = new Set([
  'to', 'of', 'and', 'a', 'an', 'the', 'can', 'have', 'has', 'for', 'from', 'at', 'you', 'your', 'them', 'him',
  'her', 'some', 'was', 'were', 'are', 'do', 'does', 'would', 'could', 'should', 'will', 'just', 'been', 'that',
  'than', 'as', 'but', 'or', 'there', 'what', 'about', 'it',
])

const core = (word) => word.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '')

export const normalizeGap = (s) =>
  String(s ?? '')
    .replace(/[‘’ʼ`´]/g, "'")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')

export function checkGap(answer, input) {
  return normalizeGap(answer) === normalizeGap(input) && normalizeGap(answer) !== ''
}

function shuffle(list, random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Trả về danh sách phần: { type: 'text', text } | { type: 'gap', answer, n }
export function makeGaps(text, count, random = Math.random) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const candidates = words
    .map((w, i) => ({ i, word: core(w) }))
    .filter((c) => /\p{L}/u.test(c.word) && !/\d/.test(c.word))
  const weak = shuffle(
    candidates.filter((c) => WEAK.has(c.word.toLowerCase())),
    random,
  )
  const content = shuffle(
    candidates.filter((c) => !WEAK.has(c.word.toLowerCase()) && c.word.length >= 4),
    random,
  )
  const picked = new Set()
  for (const c of weak.slice(0, Math.ceil(count / 2))) picked.add(c.i)
  for (const c of content) if (picked.size < count) picked.add(c.i)
  for (const c of shuffle(candidates, random)) if (picked.size < count) picked.add(c.i)

  const parts = []
  let n = 0
  words.forEach((w, i) => {
    if (i > 0) parts.push({ type: 'text', text: ' ' })
    if (!picked.has(i)) return parts.push({ type: 'text', text: w })
    const answer = core(w)
    const start = w.indexOf(answer)
    if (start > 0) parts.push({ type: 'text', text: w.slice(0, start) })
    parts.push({ type: 'gap', answer, n: n++ })
    const rest = w.slice(start + answer.length)
    if (rest) parts.push({ type: 'text', text: rest })
  })
  // Gộp các đoạn chữ liền nhau cho gọn
  return parts.reduce((out, p) => {
    const last = out[out.length - 1]
    if (p.type === 'text' && last?.type === 'text') last.text += p.text
    else out.push({ ...p })
    return out
  }, [])
}

export const GAPS_PER_LEVEL = { 1: 2, 2: 3, 3: 4 }
