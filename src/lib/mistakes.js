// Tìm các từ bạn hay nghe sai / bỏ sót khi chép chính tả, để tạo thẻ ôn tập.
import { gradeAnswer } from './grading.js'

// Từ chức năng rất ngắn: đã có module nối âm lo phần nghe các từ này
const SKIP = new Set([
  'a', 'an', 'the', 'to', 'of', 'and', 'in', 'on', 'at', 'is', 'are', 'am', 'be', 'was', 'were', 'it', 'i', 'you',
  'he', 'she', 'we', 'they', 'do', 'does', 'did', 'not', 'for', 'or', 'but', 'so', 'if', 'as', 'by', 'my', 'me',
  'us', 'his', 'her', 'its', 'our', 'your', 'their', 'will', 'would', 'have', 'has', 'had', 'can',
])

// Các từ trong câu đúng mà bạn gõ sai hoặc bỏ sót
export function missedWords(expected, answer, result = gradeAnswer(expected, answer)) {
  const seen = new Set()
  const out = []
  for (const op of result.ops) {
    if (op.type !== 'wrong' && op.type !== 'missing') continue
    const key = op.expected.key
    if (SKIP.has(key) || key.length < 3 || /\d/.test(key) || seen.has(key)) continue
    // Từ viết tắt (don't → do + not) thì bỏ qua
    if (op.expected.parts > 1) continue
    seen.add(key)
    out.push({ key, word: op.expected.display.toLowerCase() === key ? op.expected.display : key })
  }
  return out
}

// Gộp từ lịch sử chính tả: [{ key, word, count, sentence }] (sai nhiều nhất trước)
export function aggregateMistakes(history, { minCount = 2, limit = 12 } = {}) {
  const map = new Map()
  for (const h of history) {
    if (!h.sentence || h.answer == null) continue
    for (const { key, word } of missedWords(h.sentence, h.answer)) {
      const entry = map.get(key) ?? { key, word, count: 0, sentence: h.sentence }
      entry.count += 1
      map.set(key, entry)
    }
  }
  return [...map.values()]
    .filter((e) => e.count >= minCount)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit)
}
