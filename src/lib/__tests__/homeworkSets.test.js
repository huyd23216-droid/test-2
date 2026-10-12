import { describe, expect, it } from 'vitest'
import {
  clozeBlankNumbers,
  clozeSpeechLines,
  dueReviewItems,
  gradeBlank,
  gradeItem,
  isValidItem,
  itemUnits,
  parseCloze,
  reviewBank,
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

// ---------- Câu cloze ----------

const CLOZE = {
  id: 'c1',
  type: 'cloze',
  text:
    "Linh: What are you doing these days?\nHuy: I'm studying for IELTS. I want a good {{1}} for my CV.\nLinh: You could apply for a {{ 2 }} to study abroad.\nHuy: Or I could take a {{3}} course at 10:30 on Mondays.",
  bank: ['qualification', 'vocational', 'scholarship', 'degree', 'diploma'],
  blanks: {
    1: { answer: 'qualification', accept: [], explain_vi: 'qualification: bằng cấp, chứng chỉ.' },
    2: { answer: 'scholarship', accept: ['grant'], explain_vi: 'scholarship: học bổng.' },
    3: { answer: 'vocational', accept: [], explain_vi: 'vocational course: khoá học nghề.' },
  },
}

describe('câu cloze: tách {{n}}', () => {
  it('lấy số chỗ trống theo thứ tự, chấp nhận khoảng trắng trong ngoặc', () => {
    expect(clozeBlankNumbers(CLOZE.text)).toEqual(['1', '2', '3'])
  })

  it('mỗi dòng một hàng; tên người nói ở đầu dòng được tách riêng', () => {
    const lines = parseCloze(CLOZE.text)
    expect(lines).toHaveLength(4)
    expect(lines[0]).toEqual({ speaker: 'Linh', parts: [{ type: 'text', text: 'What are you doing these days?' }] })
    expect(lines[1].speaker).toBe('Huy')
    expect(lines[1].parts).toEqual([
      { type: 'text', text: "I'm studying for IELTS. I want a good " },
      { type: 'blank', n: '1' },
      { type: 'text', text: ' for my CV.' },
    ])
    expect(lines[2].parts[1]).toEqual({ type: 'blank', n: '2' })
  })

  it('giờ như 10:30 không bị coi là tên người nói; dòng không có tên vẫn đọc được', () => {
    expect(parseCloze('At 10:30 we {{1}}.')[0]).toEqual({
      speaker: null,
      parts: [
        { type: 'text', text: 'At 10:30 we ' },
        { type: 'blank', n: '1' },
        { type: 'text', text: '.' },
      ],
    })
    expect(parseCloze('{{1}} is here.')[0].parts[0]).toEqual({ type: 'blank', n: '1' })
  })

  it('kiểm tra dữ liệu: đủ đáp án trong ngân hàng từ, không trùng số', () => {
    expect(isValidItem(CLOZE)).toBe(true)
    expect(isValidItem({ ...CLOZE, bank: ['qualification', 'scholarship'] })).toBe(false)
    expect(isValidItem({ ...CLOZE, text: 'A {{1}} and {{1}}' })).toBe(false)
    expect(isValidItem({ ...CLOZE, blanks: { 1: CLOZE.blanks[1] } })).toBe(false)
    expect(isValidItem({ ...CLOZE, text: 'Không có chỗ trống' })).toBe(false)
    // Hai chỗ cùng đáp án thì ngân hàng phải có từ đó hai lần
    const twice = { id: 't', type: 'cloze', text: '{{1}} and {{2}}', bank: ['go', 'go', 'x'], blanks: { 1: { answer: 'go' }, 2: { answer: 'go' } } }
    expect(isValidItem(twice)).toBe(true)
    expect(isValidItem({ ...twice, bank: ['go', 'x'] })).toBe(false)
  })

  it('mỗi chỗ trống là một đơn vị chấm điểm "c1.n"', () => {
    expect(itemUnits(CLOZE).map((u) => u.id)).toEqual(['c1.1', 'c1.2', 'c1.3'])
    expect(itemUnits({ id: 'q1', type: 'mcq' })).toEqual([{ id: 'q1' }])
  })
})

describe('câu cloze: chấm điểm', () => {
  it('chấm từng chỗ như dạng gap', () => {
    expect(gradeBlank(CLOZE.blanks[1], 'Qualification')).toBe(true)
    expect(gradeBlank(CLOZE.blanks[2], 'grant.')).toBe(true)
    expect(gradeBlank(CLOZE.blanks[2], 'degree')).toBe(false)
    expect(gradeBlank(CLOZE.blanks[3], '')).toBe(false)
  })

  it('điểm của bộ: mỗi chỗ trống một điểm, theo lần trả lời đầu tiên', () => {
    const set = { id: 's9', items: [CLOZE, { id: 'q1', type: 'mcq', prompt: 'x', options: ['a', 'b'], answer: 'a' }] }
    const grouped = groupAnswers([
      { set_id: 's9', item_id: 'c1.1', is_correct: true, created_at: '1' },
      { set_id: 's9', item_id: 'c1.2', is_correct: false, created_at: '2' },
      { set_id: 's9', item_id: 'c1.2', is_correct: true, created_at: '5' },
      { set_id: 's9', item_id: 'c1.3', is_correct: true, created_at: '3' },
      { set_id: 's9', item_id: 'q1', is_correct: true, created_at: '4' },
    ])
    expect(setProgress(set, grouped)).toMatchObject({ total: 2, answered: 2, graded: 4, correct: 3, done: true })
    const partial = groupAnswers([{ set_id: 's9', item_id: 'c1.1', is_correct: true, created_at: '1' }])
    expect(setProgress(set, partial)).toMatchObject({ answered: 0, nextIndex: 0, done: false })
  })

  it('đọc cả đoạn: điền đáp án đúng, bỏ tên người nói', () => {
    const lines = clozeSpeechLines(CLOZE)
    expect(lines[1]).toEqual({ speaker: 'Huy', text: "I'm studying for IELTS. I want a good qualification for my CV." })
    expect(lines.every((l) => !l.text.startsWith('Linh') && !l.text.startsWith('Huy'))).toBe(true)
  })
})

describe('câu cloze: ôn từng phần', () => {
  const set = { id: 's9', items: [CLOZE] }

  it('chỉ các chỗ trống đến hạn được đưa vào lượt ôn', () => {
    const grouped = groupAnswers([
      { set_id: 's9', item_id: 'c1.1', is_correct: true, next_due: null, created_at: '1' },
      { set_id: 's9', item_id: 'c1.2', is_correct: false, next_due: TODAY, created_at: '2' },
      { set_id: 's9', item_id: 'c1.3', is_correct: false, next_due: '2026-10-09', created_at: '3' },
    ])
    const due = dueReviewItems([set], grouped, TODAY)
    expect(due).toHaveLength(1)
    expect(due[0]).toMatchObject({ item: { id: 'c1' }, blanks: ['2'], dueOn: TODAY })
    expect(dueReviewItems([set], grouped, '2026-10-09')[0].blanks).toEqual(['2', '3'])
  })

  it('ngân hàng từ khi ôn = đáp án đến hạn + 2 từ nhiễu từ ngân hàng gốc', () => {
    for (let seed = 0; seed < 20; seed++) {
      let x = seed + 1
      const rng = () => ((x = (x * 9301 + 49297) % 233280) / 233280)
      const bank = reviewBank(CLOZE, ['2'], rng)
      expect(bank).toHaveLength(3)
      expect(bank).toContain('scholarship')
      const distractors = bank.filter((w) => w !== 'scholarship')
      expect(new Set(distractors).size).toBe(2)
      expect(distractors.every((w) => CLOZE.bank.includes(w))).toBe(true)
    }
    // Ưu tiên từ nhiễu thật (degree, diploma) trước đáp án của chỗ khác
    expect(reviewBank(CLOZE, ['1', '3']).filter((w) => !['qualification', 'vocational'].includes(w)).sort()).toEqual([
      'degree',
      'diploma',
    ])
  })
})
