// Bài tập được giao (bảng homework_sets / homework_answers): chấm câu, tính tiến độ
// từng bộ và lịch "Ôn câu sai" (sai → hôm sau, đúng lại → +3 → +7 → xong).
import { addDays } from './dates.js'

export const SET_ITEM_TYPES = {
  mcq: 'Trắc nghiệm',
  gap: 'Điền vào chỗ trống',
  fix: 'Sửa câu sai',
  write: 'Viết',
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

// Câu hợp lệ mới hiện ra (dữ liệu do giáo viên nhập tay, có thể thiếu sót)
export function isValidItem(item) {
  if (!item || typeof item !== 'object' || item.id == null || typeof item.prompt !== 'string') return false
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

// true / false; null với câu 'write' (không chấm tự động)
export function gradeItem(item, answer) {
  if (item.type === 'write') return null
  if (item.type === 'mcq') return answer === item.answer
  const given = normalizeAnswer(answer)
  if (!given) return false
  return [item.answer, ...(Array.isArray(item.accept) ? item.accept : [])].some(
    (ok) => normalizeAnswer(ok) === given,
  )
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

// Tiến độ một bộ: điểm tính theo lần trả lời ĐẦU TIÊN của mỗi câu
export function setProgress(set, grouped) {
  const items = setItems(set)
  let answered = 0
  let correct = 0
  let graded = 0
  let waitingFeedback = 0
  let feedback = 0
  let nextIndex = -1
  items.forEach((item, i) => {
    const list = answersFor(grouped, set.id, item.id)
    if (!list.length) {
      if (nextIndex === -1) nextIndex = i
      return
    }
    answered++
    if (item.type === 'write') {
      const last = list[list.length - 1]
      if (last.feedback_vi) feedback++
      else waitingFeedback++
      return
    }
    graded++
    if (list[0].is_correct) correct++
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

// Các câu đến hạn ôn lại hôm nay: [{ set, item, dueOn }]
export function dueReviewItems(sets, grouped, today) {
  const out = []
  for (const set of sets) {
    for (const item of setItems(set)) {
      const list = answersFor(grouped, set.id, item.id)
      const last = list[list.length - 1]
      if (last?.next_due && last.next_due <= today) out.push({ set, item, dueOn: last.next_due })
    }
  }
  return out.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
}
