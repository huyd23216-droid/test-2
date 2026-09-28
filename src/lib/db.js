// Mọi thao tác đọc/ghi Supabase nằm ở đây, để dễ thay đổi hoặc mở rộng sau này.
import { supabase } from './supabase.js'
import { DEFAULT_SETTINGS } from '../config.js'

const PAGE_SIZE = 1000

function unwrap({ data, error }) {
  if (error) throw error
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

export async function updateSettings(userId, patch) {
  return unwrap(
    await supabase.from('user_settings').update(patch).eq('user_id', userId).select().single(),
  )
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

export async function insertCard(userId, fields) {
  return unwrap(
    await supabase.from('cards').insert({ user_id: userId, position: 0, ...fields }).select().single(),
  )
}

export async function updateCard(id, patch) {
  return unwrap(await supabase.from('cards').update(patch).eq('id', id).select().single())
}

export async function deleteCard(id) {
  unwrap(await supabase.from('cards').delete().eq('id', id))
}

// ---------- Nối âm ----------
export function fetchConnectedSpeechProgress(userId) {
  return fetchAll(() =>
    supabase.from('connected_speech_progress').select('*').eq('user_id', userId).order('item_id'),
  )
}

export async function upsertConnectedSpeechProgress(row) {
  return unwrap(
    await supabase
      .from('connected_speech_progress')
      .upsert(row, { onConflict: 'user_id,item_id' })
      .select()
      .single(),
  )
}

// ---------- Chính tả ----------
const HISTORY_COLUMNS =
  'id, source, sentence_id, clip_id, level, sentence, score, correct_words, total_words, created_at'

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

export async function insertDictation(row) {
  return unwrap(await supabase.from('dictation_history').insert(row).select(HISTORY_COLUMNS).single())
}

// ---------- Clip thật ----------
export function fetchClips(userId) {
  return fetchAll(() =>
    supabase.from('clips').select('*').eq('user_id', userId).order('created_at', { ascending: false }).order('id'),
  )
}

export async function insertClip(userId, fields) {
  return unwrap(await supabase.from('clips').insert({ user_id: userId, ...fields }).select().single())
}

export async function updateClip(id, patch) {
  return unwrap(await supabase.from('clips').update(patch).eq('id', id).select().single())
}

export async function deleteClip(id) {
  unwrap(await supabase.from('clips').delete().eq('id', id))
}

// ---------- Buổi học ----------
export function fetchStudySessions(userId) {
  return fetchAll(() =>
    supabase.from('study_sessions').select('*').eq('user_id', userId).order('study_date').order('id'),
  )
}

export async function upsertStudySession(row) {
  return unwrap(await supabase.from('study_sessions').upsert(row).select().single())
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
