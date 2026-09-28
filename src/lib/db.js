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

// ---------- Xuất dữ liệu ----------
export async function exportAllData(user) {
  const [settings, cards, connected, dictation, sessions, clips] = await Promise.all([
    supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle().then(unwrap),
    fetchAll(() => supabase.from('cards').select('*').eq('user_id', user.id).order('position').order('id')),
    fetchAll(() => supabase.from('connected_speech_progress').select('*').eq('user_id', user.id).order('item_id')),
    fetchAll(() => supabase.from('dictation_history').select('*').eq('user_id', user.id).order('created_at').order('id')),
    fetchAll(() => supabase.from('study_sessions').select('*').eq('user_id', user.id).order('study_date').order('id')),
    fetchAll(() => supabase.from('clips').select('*').eq('user_id', user.id).order('created_at').order('id')),
  ])
  return {
    app: 'tieng-anh-moi-ngay',
    format_version: 1,
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    user_settings: settings,
    cards,
    connected_speech_progress: connected,
    dictation_history: dictation,
    study_sessions: sessions,
    clips,
  }
}
