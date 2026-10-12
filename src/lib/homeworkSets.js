// Bài tập được giao (bảng homework_sets / homework_answers): chấm câu, tính tiến độ
// từng bộ và lịch "Ôn câu sai" (sai → hôm sau, đúng lại → +3 → +7 → xong).
import { addDays } from './dates.js'

export const SET_ITEM_TYPES = {
  mcq: 'Trắc nghiệm',
  gap: 'Điền vào chỗ trống',
  fix: 'Sửa câu sai',
  write: 'Viết',
  cloze: 'Điền từ vào đoạn văn',
}

// So đáp án: không phân biệt hoa thường, bỏ khoảng trắng thừa và dấu câu cuối
export function normalizeAnswer(text) {
  return String(text ?? '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?,;:…]+$/u, '')
    .trim()
}

// Đúng khi khớp đáp án chính hoặc một đáp án được chấp nhận
function matchesAnswer(answer, expected, accept) {
  const given = normalizeAnswer(answer)
  if (!given) return false
  return [expected, ...(Array.isArray(accept) ? accept : [])].some((ok) => normalizeAnswer(ok) === given)
}

// ---------- Câu "cloze": đoạn văn dài có chỗ trống {{n}}, điền từ trong ngân hàng từ ----------
const BLANK_RE = /\{\{\s*(\d+)\s*\}\}/g
// Tên người nói ở đầu dòng: "Linh: ..." (dấu hai chấm phải có khoảng trắng hoặc hết dòng phía sau,
// để giờ như "10:30" không bị nhầm)
const SPEAKER_RE = /^\s*([^\s:{}][^:{}\n]{0,29}?):(?=\s|$)\s*/

const blankNumber = (raw) => String(Number(raw))

// Các chỗ trống theo thứ tự xuất hiện trong đoạn văn: ['1', '2', …]
export function clozeBlankNumbers(text) {
  const out = []
  for (const m of String(text ?? '').matchAll(BLANK_RE)) {
    const n = blankNumber(m[1])
    if (!out.includes(n)) out.push(n)
  }
  return out
}

// Tách đoạn văn thành từng dòng: [{ speaker, parts: [{ type: 'text', text } | { type: 'blank', n }] }]
export function parseCloze(text) {
  return String(text ?? '')
    .split('\n')
    .map((raw) => {
      let rest = raw
      let speaker = null
      const m = SPEAKER_RE.exec(rest)
      if (m) {
        speaker = m[1].trim()
        rest = rest.slice(m[0].length)
      }
      const parts = []
      let last = 0
      for (const b of rest.matchAll(BLANK_RE)) {
        if (b.index > last) parts.push({ type: 'text', text: rest.slice(last, b.index) })
        parts.push({ type: 'blank', n: blankNumber(b[1]) })
        last = b.index + b[0].length
      }
      if (last < rest.length) parts.push({ type: 'text', text: rest.slice(last) })
      return { speaker, parts }
    })
}

export function gradeBlank(blank, answer) {
  return matchesAnswer(answer, blank?.answer, blank?.accept)
}

function isValidCloze(item) {
  if (typeof item.text !== 'string' || !Array.isArray(item.bank) || !item.blanks || typeof item.blanks !== 'object') {
    return false
  }
  const nums = clozeBlankNumbers(item.text)
  // Mỗi số chỉ xuất hiện một lần, và có đáp án
  if (!nums.length || nums.length !== [...item.text.matchAll(BLANK_RE)].length) return false
  if (!nums.every((n) => typeof item.blanks[n]?.answer === 'string' && item.blanks[n].answer.trim())) return false
  // Ngân hàng từ phải đủ chữ cho mọi đáp án (mỗi chữ dùng một lần)
  const need = new Map()
  for (const n of nums) {
    const key = normalizeAnswer(item.blanks[n].answer)
    need.set(key, (need.get(key) ?? 0) + 1)
  }
  const have = new Map()
  for (const w of item.bank) {
    const key = normalizeAnswer(w)
    have.set(key, (have.get(key) ?? 0) + 1)
  }
  return [...need].every(([key, count]) => (have.get(key) ?? 0) >= count)
}

// Ngân hàng từ cho lượt ôn: đáp án của các chỗ trống đến hạn + 2 từ gây nhiễu ngẫu nhiên
export function reviewBank(item, dueBlanks, rng = Math.random) {
  const shuffle = (list) => {
    const copy = [...list]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }
  const allAnswers = new Set(clozeBlankNumbers(item.text).map((n) => normalizeAnswer(item.blanks[n].answer)))
  const dueWords = dueBlanks.map((n) => {
    const answer = item.blanks[n].answer
    return item.bank.find((w) => normalizeAnswer(w) === normalizeAnswer(answer)) ?? answer
  })
  const dueKeys = new Set(dueWords.map(normalizeAnswer))
  // Ưu tiên từ nhiễu thật (không phải đáp án của chỗ nào), thiếu thì lấy đáp án của chỗ khác
  const pure = shuffle(item.bank.filter((w) => !allAnswers.has(normalizeAnswer(w))))
  const others = shuffle(item.bank.filter((w) => allAnswers.has(normalizeAnswer(w)) && !dueKeys.has(normalizeAnswer(w))))
  const distractors = []
  for (const w of [...pure, ...others]) {
    if (distractors.length === 2) break
    const key = normalizeAnswer(w)
    if (!dueKeys.has(key) && !distractors.some((d) => normalizeAnswer(d) === key)) distractors.push(w)
  }
  return shuffle([...dueWords, ...distractors])
}

// Các dòng để đọc cả đoạn: chỗ trống thay bằng đáp án đúng, bỏ tên người nói
export function clozeSpeechLines(item) {
  return parseCloze(item.text)
    .map((line) => ({
      speaker: line.speaker,
      text: line.parts
        .map((p) => (p.type === 'text' ? p.text : item.blanks[p.n]?.answer ?? ''))
        .join('')
        .replace(/\s+/g, ' ')
        .trim(),
    }))
    .filter((line) => line.text)
}

// ---------- Câu hợp lệ mới hiện ra (dữ liệu do giáo viên nhập tay, có thể thiếu sót) ----------
export function isValidItem(item) {
  if (!item || typeof item !== 'object' || item.id == null) return false
  if (item.type === 'cloze') return isValidCloze(item)
  if (typeof item.prompt !== 'string') return false
  switch (item.type) {
    case 'mcq':
      return Array.isArray(item.options) && item.options.length >= 2 && item.options.includes(item.answer)
    case 'gap':
    case 'fix':
      return typeof item.answer === 'string' && item.answer.trim() !== ''
    case 'write':
      return true
    default:
      return false
  }
}

export function setItems(set) {
  return (Array.isArray(set?.items) ? set.items : []).filter(isValidItem).map((it) => ({ ...it, id: String(it.id) }))
}

// Mỗi đơn vị chấm điểm là một dòng homework_answers: câu thường = 1 đơn vị,
// câu cloze = mỗi chỗ trống một đơn vị với item_id "<id câu>.<số chỗ trống>"
export function itemUnits(item) {
  if (item.type === 'cloze') {
    return clozeBlankNumbers(item.text).map((n) => ({ id: `${item.id}.${n}`, blank: n }))
  }
  return [{ id: item.id }]
}

// true / false; null với câu 'write' (không chấm tự động)
export function gradeItem(item, answer) {
  if (item.type === 'write') return null
  if (item.type === 'mcq') return answer === item.answer
  return matchesAnswer(answer, item.answer, item.accept)
}

// Tách prompt quanh chỗ trống ___ (3 dấu gạch dưới trở lên)
export function splitGap(prompt) {
  const m = /_{3,}/.exec(prompt ?? '')
  if (!m) return null
  return { before: prompt.slice(0, m.index), after: prompt.slice(m.index + m[0].length) }
}

// Ngày ôn lại cho câu vừa trả lời.
// history: các lần trả lời trước của câu này (cũ → mới).
//  - Sai: hôm sau ôn lại.
//  - Đúng ngay lần đầu: không cần ôn.
//  - Đúng sau khi từng sai: lần đúng thứ 1 → +3 ngày, thứ 2 → +7 ngày, thứ 3 → xong.
export const REVIEW_LADDER = [3, 7]

export function nextDueFor(history, isCorrect, today) {
  if (isCorrect === null || isCorrect === undefined) return null
  if (!isCorrect) return addDays(today, 1)
  if (!history.some((a) => a.is_correct === false)) return null
  let streak = 1
  for (let i = history.length - 1; i >= 0 && history[i].is_correct === true; i--) streak++
  const days = REVIEW_LADDER[streak - 1]
  return days ? addDays(today, days) : null
}

const answerKey = (setId, itemId) => `${setId}:${itemId}`

// Map "setId:itemId" → các lần trả lời (cũ → mới)
export function groupAnswers(answers) {
  const map = new Map()
  for (const a of answers) {
    const key = answerKey(a.set_id, a.item_id)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(a)
  }
  for (const list of map.values()) {
    list.sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))
  }
  return map
}

export const answersFor = (grouped, setId, itemId) => grouped.get(answerKey(setId, itemId)) ?? []

// Tiến độ một bộ. answered/total đếm theo câu (màn hình); điểm đếm theo đơn vị chấm
// (mỗi chỗ trống của câu cloze là 1 điểm) và lấy lần trả lời ĐẦU TIÊN.
export function setProgress(set, grouped) {
  const items = setItems(set)
  let answered = 0
  let correct = 0
  let graded = 0
  let waitingFeedback = 0
  let feedback = 0
  let nextIndex = -1
  items.forEach((item, i) => {
    let complete = true
    for (const unit of itemUnits(item)) {
      const list = answersFor(grouped, set.id, unit.id)
      if (!list.length) {
        complete = false
        continue
      }
      if (item.type === 'write') {
        if (list[list.length - 1].feedback_vi) feedback++
        else waitingFeedback++
        continue
      }
      graded++
      if (list[0].is_correct) correct++
    }
    if (complete) answered++
    else if (nextIndex === -1) nextIndex = i
  })
  return {
    total: items.length,
    answered,
    correct,
    graded,
    waitingFeedback,
    feedback,
    nextIndex,
    done: items.length > 0 && answered === items.length,
  }
}

// Bộ chưa xong trước (hạn gần nhất trước, không có hạn để sau), rồi tới bộ đã xong (mới nhất trước)
export function sortSets(sets) {
  const open = sets.filter((s) => !s.completed_at)
  const done = sets.filter((s) => s.completed_at)
  open.sort(
    (a, b) =>
      (a.due_on ?? '9999-12-31').localeCompare(b.due_on ?? '9999-12-31') ||
      String(a.created_at).localeCompare(String(b.created_at)),
  )
  done.sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))
  return { open, done }
}

export const unfinishedCount = (sets) => sets.filter((s) => !s.completed_at).length

// Các câu đến hạn ôn lại hôm nay: [{ set, item, dueOn, blanks? }]
// Với câu cloze, blanks là các chỗ trống đến hạn (các chỗ khác điền sẵn và khóa lại).
export function dueReviewItems(sets, grouped, today) {
  const out = []
  for (const set of sets) {
    for (const item of setItems(set)) {
      const due = []
      for (const unit of itemUnits(item)) {
        const list = answersFor(grouped, set.id, unit.id)
        const last = list[list.length - 1]
        if (last?.next_due && last.next_due <= today) due.push({ unit, dueOn: last.next_due })
      }
      if (!due.length) continue
      const dueOn = due.map((d) => d.dueOn).sort()[0]
      if (item.type === 'cloze') out.push({ set, item, dueOn, blanks: due.map((d) => d.unit.blank) })
      else out.push({ set, item, dueOn })
    }
  }
  return out.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
}
