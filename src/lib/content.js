// Nạp nội dung khởi đầu từ các file JSON trong src/data.
import vocabulary from '../data/vocabulary.json'
import connectedSpeech from '../data/connected-speech.json'
import dictation from '../data/dictation.json'
import ieltsSets from '../data/ielts-sets.json'
import listeningDrills from '../data/listening-drills.json'

// Thứ tự trong file JSON = thứ tự học thẻ mới
export const SEED_CARDS = vocabulary.cards.map((card, index) => ({ ...card, position: index + 1 }))

// Bộ từ IELTS theo chủ đề (chỉ thêm vào tài khoản khi bạn bật)
export const IELTS_SETS = ieltsSets.sets
export const IELTS_SET_BY_ID = Object.fromEntries(IELTS_SETS.map((s) => [s.id, s]))
const SET_POSITION_BASE = 100_000

// Các thẻ khởi đầu cần có trong tài khoản: bộ cơ bản + các bộ IELTS đang bật
export function seedCardsFor(enabledSets = []) {
  const extra = enabledSets.flatMap((setId, setIndex) =>
    (IELTS_SET_BY_ID[setId]?.cards ?? []).map((card, index) => ({
      ...card,
      position: SET_POSITION_BASE + setIndex * 1000 + index,
    })),
  )
  return [...SEED_CARDS, ...extra]
}

export const CS_GROUPS = connectedSpeech.groups
export const CS_ITEMS = connectedSpeech.items
export const CS_GROUP_BY_ID = Object.fromEntries(CS_GROUPS.map((g) => [g.id, g]))

export const DRILLS = listeningDrills.drills
export const DRILL_BY_ID = Object.fromEntries(DRILLS.map((d) => [d.id, d]))

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
const CARD_FIELDS = ['word', 'ipa', 'pos', 'meaning_vi', 'example_en', 'example_vi']

export function validateContent(data = { vocabulary, connectedSpeech, dictation, ieltsSets, listeningDrills }) {
  const errors = []
  const v = data.vocabulary?.cards
  const cs = data.connectedSpeech
  const d = data.dictation
  const sets = data.ieltsSets?.sets ?? []
  const drills = data.listeningDrills?.drills ?? []

  if (!Array.isArray(v)) errors.push('vocabulary.json: thiếu mảng "cards"')
  else {
    checkFields(v, 'vocabulary.cards', CARD_FIELDS, errors)
    // id thẻ phải duy nhất trên mọi file từ vựng (vocabulary.json + ielts-sets.json)
    checkUniqueIds([...v, ...sets.flatMap((s) => s.cards ?? [])], 'thẻ từ vựng (mọi file)', errors)
  }

  checkUniqueIds(drills, 'listening-drills.drills', errors)
  checkFields(drills, 'listening-drills.drills', ['name', 'explanation'], errors)
  checkUniqueIds(drills.flatMap((d) => d.items ?? []), 'listening-drills (mọi mục)', errors)
  drills.forEach((d) =>
    (d.items ?? []).forEach((item) => {
      const opts = item.options ?? []
      if (opts.length < 2 || opts.some((o) => !nonEmpty(o))) {
        errors.push(`listening-drills (${item.id}): cần ít nhất 2 câu trong "options"`)
      } else if (new Set(opts).size !== opts.length) {
        errors.push(`listening-drills (${item.id}): các câu trong "options" bị trùng nhau`)
      }
    }),
  )

  checkUniqueIds(sets, 'ielts-sets.sets', errors)
  sets.forEach((set) => {
    if (!nonEmpty(set.name)) errors.push(`ielts-sets (${set.id}): thiếu "name"`)
    if (!Array.isArray(set.cards)) errors.push(`ielts-sets (${set.id}): thiếu mảng "cards"`)
    else checkFields(set.cards, `ielts-sets.${set.id}`, CARD_FIELDS, errors)
  })

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
