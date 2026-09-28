// Chuẩn bị dữ liệu từ file sao lưu (Cài đặt → Xuất dữ liệu) để khôi phục.
// Gán lại user_id cho tài khoản hiện tại và chỉ giữ các cột mà app biết.

const COLUMNS = {
  cards: [
    'id', 'seed_id', 'position', 'word', 'ipa', 'pos', 'meaning_vi', 'example_en', 'example_vi', 'youglish_query',
    'ease', 'interval_days', 'repetitions', 'lapses', 'reviews_count', 'due_date', 'introduced_on',
    'last_reviewed_at', 'stability', 'difficulty', 'created_at',
  ],
  clips: ['id', 'title', 'youtube_url', 'start_seconds', 'end_seconds', 'transcript', 'meaning_vi', 'created_at'],
  connected_speech_progress: [
    'item_id', 'attempts', 'correct_count', 'wrong_count', 'last_score', 'best_score', 'last_mode', 'last_practiced_at',
  ],
  listening_progress: ['item_id', 'kind', 'attempts', 'correct_count', 'wrong_count', 'last_score', 'last_practiced_at'],
  dictation_history: [
    'id', 'source', 'sentence_id', 'clip_id', 'level', 'sentence', 'answer', 'total_words', 'correct_words',
    'wrong_words', 'missing_words', 'extra_words', 'score', 'replays', 'rate', 'duration_seconds', 'created_at',
  ],
  study_sessions: ['id', 'study_date', 'kind', 'started_at', 'ended_at', 'duration_seconds', 'activities', 'created_at'],
}

const SETTINGS_COLUMNS = [
  'tts_rate', 'new_words_per_day', 'removed_seed_ids', 'desired_retention', 'accent', 'enabled_sets',
  'reminder_enabled', 'reminder_time', 'timezone',
]

const pick = (row, cols) => Object.fromEntries(cols.filter((c) => row[c] !== undefined).map((c) => [c, row[c]]))

export function validateBackup(data) {
  if (!data || typeof data !== 'object') return 'File không phải JSON hợp lệ.'
  if (data.app !== 'tieng-anh-moi-ngay') return 'Đây không phải file sao lưu của app này.'
  if (!Array.isArray(data.cards)) return 'File sao lưu thiếu danh sách thẻ.'
  return null
}

// Trả về { settings, tables: [{ table, rows, onConflict }] } theo đúng thứ tự cần ghi
export function prepareRestore(data, userId) {
  const own = (row) => ({ ...row, user_id: userId })
  const rowsOf = (key) => (Array.isArray(data[key]) ? data[key] : [])

  const clips = rowsOf('clips').map((r) => own(pick(r, COLUMNS.clips)))
  const clipIds = new Set(clips.map((c) => c.id))

  // Thẻ khởi đầu: khớp theo seed_id (id có thể khác nếu tài khoản mới đã tự nạp bộ từ)
  const cards = rowsOf('cards').map((r) => own(pick(r, COLUMNS.cards)))
  const seedCards = cards.filter((c) => c.seed_id).map(({ id: _id, ...rest }) => rest)
  const customCards = cards.filter((c) => !c.seed_id)

  const dictation = rowsOf('dictation_history').map((r) => {
    const row = own(pick(r, COLUMNS.dictation_history))
    // Clip không có trong file sao lưu → bỏ liên kết để không lỗi khóa ngoại
    if (row.clip_id && !clipIds.has(row.clip_id)) row.clip_id = null
    return row
  })

  return {
    settings: data.user_settings ? pick(data.user_settings, SETTINGS_COLUMNS) : null,
    tables: [
      { table: 'clips', rows: clips },
      { table: 'cards', rows: seedCards, onConflict: 'user_id,seed_id' },
      { table: 'cards', rows: customCards },
      {
        table: 'connected_speech_progress',
        rows: rowsOf('connected_speech_progress').map((r) => own(pick(r, COLUMNS.connected_speech_progress))),
        onConflict: 'user_id,item_id',
      },
      {
        table: 'listening_progress',
        rows: rowsOf('listening_progress').map((r) => own(pick(r, COLUMNS.listening_progress))),
        onConflict: 'user_id,item_id',
      },
      { table: 'dictation_history', rows: dictation },
      { table: 'study_sessions', rows: rowsOf('study_sessions').map((r) => own(pick(r, COLUMNS.study_sessions))) },
    ].filter((t) => t.rows.length > 0),
  }
}

export function summarizeBackup(data) {
  const n = (key) => (Array.isArray(data[key]) ? data[key].length : 0)
  return `${n('cards')} thẻ, ${n('clips')} clip, ${n('dictation_history')} lần chép chính tả, ${n('study_sessions')} buổi học`
}
