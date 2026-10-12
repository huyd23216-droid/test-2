// Các thao tác đọc dữ liệu từ Supabase. Việc ghi thay đổi đi qua hàng đợi
// đồng bộ (src/lib/syncQueue.js) để vẫn dùng được khi mất mạng.
import { supabase } from './supabase.js'
import { DEFAULT_SETTINGS } from '../config.js'

const PAGE_SIZE = 1000

function unwrap({ data, error, status }) {
  if (error) {
    const err = new Error(error.message)
    err.status = status
    err.code = error.code
    throw err
  }
  return data
}

// Supabase giới hạn 1000 dòng mỗi lần đọc, nên đọc theo từng trang
async function fetchAll(buildQuery) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = unwrap(await buildQuery().range(from, from + PAGE_SIZE - 1))
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

// ---------- Cài đặt ----------
export async function getOrCreateSettings(userId) {
  const existing = unwrap(
    await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
  )
  if (existing) return existing
  const { data, error } = await supabase
    .from('user_settings')
    .insert({ user_id: userId, ...DEFAULT_SETTINGS })
    .select()
    .single()
  if (!error) return data
  if (error.code === '23505') {
    // Thiết bị khác vừa tạo cùng lúc
    return unwrap(await supabase.from('user_settings').select('*').eq('user_id', userId).single())
  }
  throw error
}

// ---------- Thẻ từ vựng ----------
export function fetchCards(userId) {
  return fetchAll(() =>
    supabase.from('cards').select('*').eq('user_id', userId).order('position').order('id'),
  )
}

export function seedRowFromContent(userId, seed) {
  return {
    user_id: userId,
    seed_id: seed.id,
    position: seed.position,
    word: seed.word,
    ipa: seed.ipa ?? '',
    pos: seed.pos ?? '',
    meaning_vi: seed.meaning_vi ?? '',
    example_en: seed.example_en ?? '',
    example_vi: seed.example_vi ?? '',
    youglish_query: seed.youglish_query || null,
  }
}

export async function insertSeedCards(userId, seeds) {
  const inserted = []
  for (let i = 0; i < seeds.length; i += 500) {
    const rows = seeds.slice(i, i + 500).map((s) => seedRowFromContent(userId, s))
    const data = unwrap(
      await supabase
        .from('cards')
        .upsert(rows, { onConflict: 'user_id,seed_id', ignoreDuplicates: true })
        .select(),
    )
    inserted.push(...data)
  }
  return inserted
}

// ---------- Nối âm ----------
export function fetchConnectedSpeechProgress(userId) {
  return fetchAll(() =>
    supabase.from('connected_speech_progress').select('*').eq('user_id', userId).order('item_id'),
  )
}

export function fetchListeningProgress(userId) {
  return fetchAll(() =>
    supabase.from('listening_progress').select('*').eq('user_id', userId).order('item_id'),
  )
}

// ---------- Chính tả ----------
export const HISTORY_COLUMNS =
  'id, source, sentence_id, clip_id, level, sentence, answer, score, correct_words, total_words, created_at'

export function fetchDictationHistory(userId) {
  return fetchAll(() =>
    supabase
      .from('dictation_history')
      .select(HISTORY_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id'),
  )
}

// ---------- Clip thật ----------
export function fetchClips(userId) {
  return fetchAll(() =>
    supabase.from('clips').select('*').eq('user_id', userId).order('created_at', { ascending: false }).order('id'),
  )
}

// ---------- Buổi học ----------
export function fetchStudySessions(userId) {
  return fetchAll(() =>
    supabase.from('study_sessions').select('*').eq('user_id', userId).order('study_date').order('id'),
  )
}

// ---------- Bài tập ----------
// Chưa chạy migration bài tập thì trả về null (app vẫn chạy, mục Bài tập báo cần cài thêm)
const isMissingTable = (err) => err.status === 404 || err.code === '42P01' || err.code === 'PGRST205'

async function optional(promise) {
  try {
    return await promise
  } catch (err) {
    if (isMissingTable(err)) return null
    throw err
  }
}

export function fetchHomeworkProgress(userId) {
  return optional(
    fetchAll(() => supabase.from('homework_progress').select('*').eq('user_id', userId).order('item_key')),
  )
}

export function fetchHomeworkSessions(userId) {
  return optional(
    fetchAll(() =>
      supabase
        .from('homework_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id'),
    ),
  )
}

// ---------- Bài tập được giao ----------
export function fetchHomeworkSets(userId) {
  return optional(
    fetchAll(() =>
      supabase.from('homework_sets').select('*').eq('user_id', userId).order('created_at').order('id'),
    ),
  )
}

export function fetchHomeworkAnswers(userId) {
  return optional(
    fetchAll(() =>
      supabase.from('homework_answers').select('*').eq('user_id', userId).order('created_at').order('id'),
    ),
  )
}

// ---------- Xuất / khôi phục dữ liệu ----------
export async function exportAllData(user) {
  const all = (table, order) =>
    fetchAll(() => supabase.from(table).select('*').eq('user_id', user.id).order(order).order(order === 'id' ? 'created_at' : 'id'))
  const [settings, cards, connected, listening, dictation, sessions, clips, hwProgress, hwSessions, sets, answers] =
    await Promise.all([
    supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle().then(unwrap),
    all('cards', 'position'),
    fetchAll(() => supabase.from('connected_speech_progress').select('*').eq('user_id', user.id).order('item_id')),
    fetchAll(() => supabase.from('listening_progress').select('*').eq('user_id', user.id).order('item_id')),
    all('dictation_history', 'created_at'),
    all('study_sessions', 'study_date'),
    all('clips', 'created_at'),
    fetchHomeworkProgress(user.id),
    fetchHomeworkSessions(user.id),
    fetchHomeworkSets(user.id),
    fetchHomeworkAnswers(user.id),
  ])
  return {
    app: 'tieng-anh-moi-ngay',
    format_version: 3,
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    user_settings: settings,
    cards,
    connected_speech_progress: connected,
    listening_progress: listening,
    dictation_history: dictation,
    study_sessions: sessions,
    clips,
    homework_progress: hwProgress ?? [],
    homework_sessions: hwSessions ?? [],
    homework_sets: sets ?? [],
    homework_answers: answers ?? [],
  }
}

// Ghi dữ liệu đã chuẩn bị bởi prepareRestore() (src/lib/backup.js)
export async function restoreData(userId, { settings, tables }, onProgress) {
  if (settings && Object.keys(settings).length) {
    unwrap(await supabase.from('user_settings').update(settings).eq('user_id', userId))
  }
  const total = tables.reduce((sum, t) => sum + t.rows.length, 0)
  let done = 0
  for (const { table, rows, onConflict } of tables) {
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      unwrap(await supabase.from(table).upsert(chunk, onConflict ? { onConflict } : undefined))
      done += chunk.length
      onProgress?.(done, total)
    }
  }
}
