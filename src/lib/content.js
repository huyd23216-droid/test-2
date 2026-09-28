// Nạp nội dung khởi đầu từ các file JSON trong src/data.
import vocabulary from '../data/vocabulary.json'
import connectedSpeech from '../data/connected-speech.json'
import dictation from '../data/dictation.json'

// Thứ tự trong file JSON = thứ tự học thẻ mới (thẻ tự thêm có position 0, học trước)
export const SEED_CARDS = vocabulary.cards.map((card, index) => ({ ...card, position: index + 1 }))

export const CS_GROUPS = connectedSpeech.groups
export const CS_ITEMS = connectedSpeech.items
export const CS_GROUP_BY_ID = Object.fromEntries(CS_GROUPS.map((g) => [g.id, g]))

export const DICTATION_LEVELS = dictation.levels
export const DICTATION_SENTENCES = dictation.sentences

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0

function checkUniqueIds(list, label, errors) {
  const seen = new Set()
  list.forEach((item, i) => {
    if (!nonEmpty(item.id)) errors.push(`${label}[${i}]: thiếu "id"`)
    else if (seen.has(item.id)) errors.push(`${label}: id "${item.id}" bị trùng`)
    seen.add(item.id)
  })
}

function checkFields(list, label, fields, errors) {
  list.forEach((item, i) => {
    for (const f of fields) {
      if (!nonEmpty(item[f])) errors.push(`${label}[${i}] (${item.id ?? '?'}): thiếu "${f}"`)
    }
  })
}

// Trả về danh sách lỗi (rỗng = dữ liệu hợp lệ). Chạy `npm test` sau khi sửa JSON.
export function validateContent(data = { vocabulary, connectedSpeech, dictation }) {
  const errors = []
  const v = data.vocabulary?.cards
  const cs = data.connectedSpeech
  const d = data.dictation

  if (!Array.isArray(v)) errors.push('vocabulary.json: thiếu mảng "cards"')
  else {
    checkUniqueIds(v, 'vocabulary.cards', errors)
    checkFields(v, 'vocabulary.cards', ['word', 'ipa', 'pos', 'meaning_vi', 'example_en', 'example_vi'], errors)
  }

  if (!Array.isArray(cs?.groups) || !Array.isArray(cs?.items)) {
    errors.push('connected-speech.json: cần có mảng "groups" và "items"')
  } else {
    checkUniqueIds(cs.groups, 'connected-speech.groups', errors)
    checkFields(cs.groups, 'connected-speech.groups', ['name', 'explanation'], errors)
    checkUniqueIds(cs.items, 'connected-speech.items', errors)
    checkFields(cs.items, 'connected-speech.items', ['group', 'full', 'reduced', 'meaning_vi', 'note_vi', 'youglish_query'], errors)
    const groupIds = new Set(cs.groups.map((g) => g.id))
    cs.items.forEach((item) => {
      if (item.group && !groupIds.has(item.group)) {
        errors.push(`connected-speech.items (${item.id}): nhóm "${item.group}" không tồn tại`)
      }
    })
  }

  if (!Array.isArray(d?.levels) || !Array.isArray(d?.sentences)) {
    errors.push('dictation.json: cần có mảng "levels" và "sentences"')
  } else {
    checkUniqueIds(d.sentences, 'dictation.sentences', errors)
    checkFields(d.sentences, 'dictation.sentences', ['text', 'meaning_vi', 'youglish_query'], errors)
    const levels = new Set(d.levels.map((l) => l.level))
    d.sentences.forEach((s) => {
      if (!levels.has(s.level)) errors.push(`dictation.sentences (${s.id}): level "${s.level}" không tồn tại`)
    })
  }

  return errors
}

if (import.meta.env?.DEV) {
  const errors = validateContent()
  if (errors.length) console.warn('Dữ liệu JSON có lỗi:\n' + errors.join('\n'))
}
