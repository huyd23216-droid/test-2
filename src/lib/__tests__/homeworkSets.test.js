import { describe, expect, it } from 'vitest'
import {
  dueReviewItems,
  gradeItem,
  groupAnswers,
  nextDueFor,
  normalizeAnswer,
  setItems,
  setProgress,
  sortSets,
  splitGap,
  unfinishedCount,
} from '../homeworkSets.js'

const TODAY = '2026-10-06'

const SET = {
  id: 's1',
  title: 'Unit 10',
  items: [
    { id: 'q1', type: 'mcq', prompt: 'She ___ to school.', options: ['go', 'goes', 'going'], answer: 'goes', explain_vi: 'Ngôi thứ ba số ít thêm -es.' },
    { id: 'q2', type: 'gap', prompt: 'I ___ coffee every day.', answer: 'drink', accept: ["don't drink"] },
    { id: 'q3', type: 'fix', prompt: 'He go to work by bus.', answer: 'He goes to work by bus.' },
    { id: 'q4', type: 'write', prompt: 'Viết 2 câu về thói quen buổi sáng.' },
    { id: 'bad', type: 'mcq', prompt: 'thiếu đáp án', options: ['a', 'b'], answer: 'c' },
    { type: 'gap', prompt: 'thiếu id', answer: 'x' },
  ],
}

const ans = (item_id, is_correct, created_at, extra = {}) => ({ set_id: 's1', item_id, is_correct, created_at, ...extra })

describe('chấm câu', () => {
  it('so đáp án không phân biệt hoa thường, khoảng trắng và dấu câu cuối', () => {
    expect(normalizeAnswer('  He  goes to work.  ')).toBe('he goes to work')
    expect(normalizeAnswer('Don’t stop!!')).toBe("don't stop")
  })

  it('mcq đúng khi chọn đúng đáp án', () => {
    const [q1] = setItems(SET)
    expect(gradeItem(q1, 'goes')).toBe(true)
    expect(gradeItem(q1, 'go')).toBe(false)
  })

  it('gap nhận đáp án chính hoặc đáp án chấp nhận', () => {
    const q2 = setItems(SET)[1]
    expect(gradeItem(q2, ' Drink ')).toBe(true)
    expect(gradeItem(q2, "Don't drink.")).toBe(true)
    expect(gradeItem(q2, 'drinks')).toBe(false)
    expect(gradeItem(q2, '')).toBe(false)
  })

  it('fix so cả câu như gap', () => {
    const q3 = setItems(SET)[2]
    expect(gradeItem(q3, 'he goes to work by bus')).toBe(true)
    expect(gradeItem(q3, 'He go to work by bus.')).toBe(false)
  })

  it('write không chấm tự động', () => {
    expect(gradeItem(setItems(SET)[3], 'I get up at 6.')).toBeNull()
  })

  it('bỏ qua câu thiếu dữ liệu', () => {
    expect(setItems(SET).map((i) => i.id)).toEqual(['q1', 'q2', 'q3', 'q4'])
    expect(setItems({ items: null })).toEqual([])
  })

  it('tách chỗ trống trong câu', () => {
    expect(splitGap('I ___ coffee.')).toEqual({ before: 'I ', after: ' coffee.' })
    expect(splitGap('No blank here')).toBeNull()
  })
})

describe('ôn câu sai', () => {
  it('sai → hôm sau; đúng lại → +3 → +7 → xong', () => {
    const h = []
    const d1 = nextDueFor(h, false, TODAY)
    expect(d1).toBe('2026-10-07')
    h.push({ is_correct: false })
    expect(nextDueFor(h, true, '2026-10-07')).toBe('2026-10-10')
    h.push({ is_correct: true })
    expect(nextDueFor(h, true, '2026-10-10')).toBe('2026-10-17')
    h.push({ is_correct: true })
    expect(nextDueFor(h, true, '2026-10-17')).toBeNull()
  })

  it('đúng ngay lần đầu thì không cần ôn; sai giữa chừng thì bắt đầu lại', () => {
    expect(nextDueFor([], true, TODAY)).toBeNull()
    const h = [{ is_correct: false }, { is_correct: true }]
    expect(nextDueFor(h, false, TODAY)).toBe('2026-10-07')
    expect(nextDueFor([...h, { is_correct: false }], true, TODAY)).toBe('2026-10-09')
  })

  it('câu viết không có lịch ôn', () => {
    expect(nextDueFor([], null, TODAY)).toBeNull()
  })

  it('lấy các câu đến hạn ôn theo lần trả lời mới nhất', () => {
    const grouped = groupAnswers([
      ans('q1', false, '2026-10-05T10:00:00Z', { next_due: '2026-10-06' }),
      ans('q2', false, '2026-10-05T10:01:00Z', { next_due: '2026-10-06' }),
      ans('q2', true, '2026-10-06T08:00:00Z', { next_due: '2026-10-09' }),
      ans('q3', false, '2026-10-06T08:01:00Z', { next_due: '2026-10-07' }),
    ])
    expect(dueReviewItems([SET], grouped, TODAY).map((d) => d.item.id)).toEqual(['q1'])
    expect(dueReviewItems([SET], grouped, '2026-10-09').map((d) => d.item.id)).toEqual(['q1', 'q3', 'q2'])
  })
})

describe('tiến độ và danh sách', () => {
  it('điểm theo lần trả lời đầu tiên, câu viết đếm riêng', () => {
    const grouped = groupAnswers([
      ans('q1', false, '2026-10-05T10:00:00Z'),
      ans('q1', true, '2026-10-06T10:00:00Z'),
      ans('q2', true, '2026-10-05T10:01:00Z'),
      ans('q4', null, '2026-10-05T10:02:00Z', { feedback_vi: null }),
    ])
    const p = setProgress(SET, grouped)
    expect(p).toMatchObject({ total: 4, answered: 3, correct: 1, graded: 2, waitingFeedback: 1, nextIndex: 2, done: false })
  })

  it('bộ chưa xong theo hạn gần nhất trước, bộ xong mới nhất trước', () => {
    const sets = [
      { id: 'a', due_on: null, created_at: '1' },
      { id: 'b', due_on: '2026-10-10', created_at: '2' },
      { id: 'c', due_on: '2026-10-07', created_at: '3' },
      { id: 'd', completed_at: '2026-10-01T00:00:00Z' },
      { id: 'e', completed_at: '2026-10-05T00:00:00Z' },
    ]
    const { open, done } = sortSets(sets)
    expect(open.map((s) => s.id)).toEqual(['c', 'b', 'a'])
    expect(done.map((s) => s.id)).toEqual(['e', 'd'])
    expect(unfinishedCount(sets)).toBe(3)
  })
})
