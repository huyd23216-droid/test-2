// Dữ liệu của user theo kiểu "offline-first":
// - Mọi thay đổi hiển thị ngay, lưu vào hàng đợi trên máy rồi mới gửi lên
//   Supabase. Mất mạng vẫn học được, có mạng lại thì tự đồng bộ.
// - Một bản sao dữ liệu được lưu trên máy để mở app khi không có mạng.
// - Khi quay lại app sau hơn 1 phút, dữ liệu được tải lại để đồng bộ với
//   thiết bị khác.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useToast } from './ToastContext.jsx'
import * as db from '../lib/db.js'
import { CS_ITEMS, IELTS_SET_BY_ID, seedCardsFor } from '../lib/content.js'
import { schedule, isDue, isNewCard, compareNewCards } from '../lib/srs.js'
import { todayString } from '../lib/dates.js'
import { computeStreak, studyDatesFromSessions, weekSeconds } from '../lib/streak.js'
import { buildDictationStats } from '../lib/planner.js'
import { createSyncQueue, isNetworkError } from '../lib/syncQueue.js'
import { idbGet, idbSet } from '../lib/idb.js'
import { uuid } from '../lib/ids.js'
import { nextProgress, nextStat } from '../lib/homework.js'
import { groupAnswers, nextDueFor, setProgress } from '../lib/homeworkSets.js'
import { MASTERED_INTERVAL_DAYS, DEFAULT_SETTINGS } from '../config.js'

const DataContext = createContext(null)
const RELOAD_AFTER_MS = 60_000
const FETCH_TIMEOUT_MS = 8000

const offlineError = () => Object.assign(new Error('offline'), { status: 0 })

function withTimeout(promise, ms) {
  if (!ms) return promise
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(offlineError()), ms))])
}

const replaceBy = (list, row, key = 'id') => {
  const idx = list.findIndex((r) => r[key] === row[key])
  if (idx === -1) return [...list, row]
  const copy = [...list]
  copy[idx] = { ...copy[idx], ...row }
  return copy
}

// Đọc toàn bộ dữ liệu của user; nạp các thẻ khởi đầu còn thiếu
// (lần đầu đăng nhập, hoặc khi file JSON có thêm từ mới).
export class MigrationMissingError extends Error {}

async function fetchUserData(userId, onSeeding) {
  const rawSettings = await db.getOrCreateSettings(userId)
  if (!('desired_retention' in rawSettings)) {
    throw new MigrationMissingError('Chưa chạy migration 20260929000000_extensions.sql')
  }
  const settings = { ...DEFAULT_SETTINGS, ...rawSettings }
  let [cards, csRows, listening, history, sessions, clips, homework, homeworkSessions, hwSets, hwAnswers] =
    await Promise.all([
    db.fetchCards(userId),
    db.fetchConnectedSpeechProgress(userId),
    db.fetchListeningProgress(userId),
    db.fetchDictationHistory(userId),
    db.fetchStudySessions(userId),
    db.fetchClips(userId),
    db.fetchHomeworkProgress(userId),
    db.fetchHomeworkSessions(userId),
    db.fetchHomeworkSets(userId),
    db.fetchHomeworkAnswers(userId),
  ])

  const haveSeeds = new Set(cards.map((c) => c.seed_id).filter(Boolean))
  const haveWords = new Set(cards.map((c) => c.word.trim().toLowerCase()))
  const removed = new Set(settings.removed_seed_ids ?? [])
  const missing = seedCardsFor(settings.enabled_sets).filter(
    (s) => !haveSeeds.has(s.id) && !removed.has(s.id) && !haveWords.has(s.word.trim().toLowerCase()),
  )
  if (missing.length > 0) {
    onSeeding?.()
    await db.insertSeedCards(userId, missing)
    // Đọc lại, phòng khi thiết bị khác cũng vừa nạp cùng lúc
    cards = await db.fetchCards(userId)
  }

  return {
    settings,
    cards,
    csRows,
    listening,
    history,
    sessions,
    clips,
    // null = chưa chạy migration bài tập
    homeworkReady: homework !== null && homeworkSessions !== null,
    homework: homework ?? [],
    homeworkSessions: homeworkSessions ?? [],
    // null = chưa chạy migration bài tập được giao + nhật ký ôn thẻ
    setsReady: hwSets !== null && hwAnswers !== null,
    hwSets: hwSets ?? [],
    hwAnswers: hwAnswers ?? [],
  }
}

export function DataProvider({ children }) {
  const { user } = useAuth()
  const userId = user.id
  const { showToast } = useToast()

  const [status, setStatus] = useState('loading') // loading | seeding | ready | error
  const [error, setError] = useState(null)
  const [offline, setOffline] = useState(false) // đang dùng bản sao trên máy
  const [pending, setPending] = useState(0) // số thay đổi chờ đồng bộ
  const [settings, setSettings] = useState(null)
  const [cards, setCards] = useState([])
  const [csRows, setCsRows] = useState([])
  const [listening, setListening] = useState([])
  const [history, setHistory] = useState([])
  const [sessions, setSessions] = useState([])
  const [clips, setClips] = useState([])
  const [homework, setHomework] = useState([])
  const [homeworkSessions, setHomeworkSessions] = useState([])
  const [homeworkReady, setHomeworkReady] = useState(true)
  const [hwSets, setHwSets] = useState([])
  const [hwAnswers, setHwAnswers] = useState([])
  const [setsReady, setSetsReady] = useState(true)
  const [today, setToday] = useState(todayString)

  const lastLoadedAt = useRef(0)
  const loading = useRef(false)
  const latest = useRef({})
  useEffect(() => {
    latest.current = { settings, cards, csRows, listening, homework, hwSets, hwAnswers, setsReady }
  }, [settings, cards, csRows, listening, homework, hwSets, hwAnswers, setsReady])

  const [queue] = useState(() =>
    createSyncQueue(userId, {
      onChange: setPending,
      onDrop: () => showToast('Có một thay đổi không lưu được lên máy chủ và đã bị bỏ qua.', { tone: 'warn' }),
    }),
  )
  useEffect(() => () => queue.dispose(), [queue])

  const snapshotKey = `snapshot:${userId}`

  const apply = useCallback((data, { fromCache = false } = {}) => {
    setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
    setCards(data.cards ?? [])
    setCsRows(data.csRows ?? [])
    setListening(data.listening ?? [])
    setHistory(data.history ?? [])
    setSessions(data.sessions ?? [])
    setClips(data.clips ?? [])
    setHomework(data.homework ?? [])
    setHomeworkSessions(data.homeworkSessions ?? [])
    setHomeworkReady(data.homeworkReady ?? true)
    setHwSets(data.hwSets ?? [])
    setHwAnswers(data.hwAnswers ?? [])
    setSetsReady(data.setsReady ?? true)
    setOffline(fromCache)
    if (!fromCache) lastLoadedAt.current = Date.now()
    setStatus('ready')
  }, [])

  // Gửi hết thay đổi đang chờ rồi tải dữ liệu mới nhất từ máy chủ.
  // Không được thì dùng bản sao trên máy.
  const syncAndFetch = useCallback(
    async ({ onSeeding, useCacheOnError, keepLocalIfPending = false }) => {
      try {
        if (navigator.onLine === false) throw offlineError()
        const flushed = await queue.flush()
        if (!flushed) throw offlineError()
        // Đã có bản sao trên máy thì không bắt chờ lâu khi mạng chập chờn
        const hasCache = useCacheOnError && Boolean(await idbGet(snapshotKey))
        const data = await withTimeout(fetchUserData(userId, onSeeding), hasCache ? FETCH_TIMEOUT_MS : 0)
        // Có thay đổi mới phát sinh trong lúc tải → giữ dữ liệu trên máy (mới hơn)
        if (keepLocalIfPending && queue.size() > 0) {
          setOffline(false)
          return true
        }
        apply(data)
        return true
      } catch (err) {
        if (!useCacheOnError || err instanceof MigrationMissingError) throw err
        const cached = await idbGet(snapshotKey)
        if (!cached) throw err
        console.warn('Dùng dữ liệu đã lưu trên máy:', err.message)
        apply(cached, { fromCache: true })
        return false
      }
    },
    [queue, userId, apply, snapshotKey],
  )

  const fail = useCallback((err) => {
    console.error(err)
    setError(err)
    setStatus('error')
  }, [])

  // Lần tải đầu tiên
  useEffect(() => {
    if (loading.current) return
    loading.current = true
    syncAndFetch({ onSeeding: () => setStatus('seeding'), useCacheOnError: true })
      .catch(fail)
      .finally(() => {
        loading.current = false
      })
  }, [syncAndFetch, fail])

  // Tải lại: silent = chạy nền (không che màn hình)
  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (loading.current) return
      loading.current = true
      if (!silent) {
        setStatus('loading')
        setError(null)
      }
      try {
        await syncAndFetch({
          onSeeding: silent ? undefined : () => setStatus('seeding'),
          useCacheOnError: !silent,
          keepLocalIfPending: silent,
        })
      } catch (err) {
        if (silent) console.warn(err)
        else fail(err)
      } finally {
        loading.current = false
      }
    },
    [syncAndFetch, fail],
  )

  // Lưu bản sao dữ liệu trên máy để dùng khi offline
  useEffect(() => {
    if (status !== 'ready') return
    const t = setTimeout(() => {
      idbSet(snapshotKey, {
        settings,
        cards,
        csRows,
        listening,
        history,
        sessions,
        clips,
        homework,
        homeworkSessions,
        homeworkReady,
        hwSets,
        hwAnswers,
        setsReady,
        saved_at: Date.now(),
      })
    }, 800)
    return () => clearTimeout(t)
  }, [
    status, snapshotKey, settings, cards, csRows, listening, history, sessions, clips, homework, homeworkSessions,
    homeworkReady, hwSets, hwAnswers, setsReady,
  ])

  // Đồng bộ khi quay lại app / có mạng lại + cập nhật "hôm nay" khi qua ngày mới
  useEffect(() => {
    const refresh = () => {
      setToday(todayString())
      if (document.visibilityState !== 'visible') return
      const stale = Date.now() - lastLoadedAt.current > RELOAD_AFTER_MS
      if (offline || stale) load({ silent: true })
      else queue.flush()
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    const timer = setInterval(() => setToday(todayString()), 60_000)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      clearInterval(timer)
    }
  }, [load, offline, queue])

  // ---------- Cài đặt ----------
  const updateSettings = useCallback(
    (patch) => {
      setSettings((s) => ({ ...s, ...patch }))
      queue.enqueue({ table: 'user_settings', action: 'update', values: patch, match: { user_id: userId }, key: 'settings' })
      return true
    },
    [queue, userId],
  )

  // ---------- Thẻ từ vựng ----------
  const gradeCard = useCallback(
    (card, grade) => {
      const today = todayString()
      const now = new Date()
      const retention = Number(latest.current.settings?.desired_retention) || DEFAULT_SETTINGS.desired_retention
      const wasDue = isDue(card, today)
      const patch = schedule(card, grade, today, now, retention)
      const updated = { ...card, ...patch }
      setCards((list) => replaceBy(list, updated))
      queue.enqueue({ table: 'cards', action: 'update', values: patch, match: { id: card.id }, key: `card:${card.id}` })
      // Nhật ký ôn: mỗi lần chấm một dòng (bảng có từ migration 20261006000000)
      if (latest.current.setsReady !== false) {
        queue.enqueue({
          table: 'review_log',
          action: 'upsert',
          values: {
            id: uuid(),
            user_id: userId,
            card_id: card.id,
            rating: grade,
            was_due: wasDue,
            reviewed_at: now.toISOString(),
          },
          ignoreDuplicates: true,
        })
      }
      return updated
    },
    [queue, userId],
  )

  // Thẻ mới bạn tự thêm được xếp lên đầu hàng từ mới
  const frontPosition = useCallback(() => {
    const positions = latest.current.cards.filter(isNewCard).map((c) => c.position)
    return Math.min(0, ...positions) - 1
  }, [])

  const addCard = useCallback(
    (fields) => {
      const row = {
        id: uuid(),
        user_id: userId,
        seed_id: null,
        position: frontPosition(),
        ipa: '',
        pos: '',
        meaning_vi: '',
        example_en: '',
        example_vi: '',
        youglish_query: null,
        ...fields,
        ease: 2.5,
        interval_days: 0,
        repetitions: 0,
        lapses: 0,
        reviews_count: 0,
        due_date: null,
        created_at: new Date().toISOString(),
      }
      setCards((list) => [...list, row])
      const { created_at: _created, ...values } = row
      queue.enqueue({ table: 'cards', action: 'upsert', values, key: `card-new:${row.id}` })
      return row
    },
    [queue, userId, frontPosition],
  )

  // Thêm nhiều thẻ một lúc (nhập danh sách, bật bộ từ IELTS)
  const addCards = useCallback(
    (list) => {
      const base = frontPosition() - list.length
      const rows = list.map((fields, i) => ({
        id: uuid(),
        user_id: userId,
        seed_id: null,
        ipa: '',
        pos: '',
        meaning_vi: '',
        example_en: '',
        example_vi: '',
        youglish_query: null,
        ...fields,
        position: base + i,
        ease: 2.5,
        interval_days: 0,
        repetitions: 0,
        lapses: 0,
        reviews_count: 0,
        due_date: null,
      }))
      setCards((current) => [...current, ...rows.map((r) => ({ ...r, created_at: new Date().toISOString() }))])
      for (let i = 0; i < rows.length; i += 200) {
        queue.enqueue({
          table: 'cards',
          action: 'upsert',
          values: rows.slice(i, i + 200),
          onConflict: 'user_id,seed_id',
          ignoreDuplicates: true,
        })
      }
      return rows
    },
    [queue, userId, frontPosition],
  )

  const editCard = useCallback(
    (id, fields) => {
      setCards((list) => list.map((c) => (c.id === id ? { ...c, ...fields } : c)))
      queue.enqueue({ table: 'cards', action: 'update', values: fields, match: { id }, key: `card:${id}` })
    },
    [queue],
  )

  const removeCard = useCallback(
    (card) => {
      if (card.seed_id) {
        // Ghi nhớ để thẻ khởi đầu đã xóa không bị tự nạp lại
        const removed = new Set(latest.current.settings?.removed_seed_ids ?? [])
        removed.add(card.seed_id)
        updateSettings({ removed_seed_ids: [...removed] })
      }
      setCards((list) => list.filter((c) => c.id !== card.id))
      queue.enqueue({ table: 'cards', action: 'delete', match: { id: card.id } })
    },
    [queue, updateSettings],
  )

  // ---------- Bộ từ IELTS ----------
  // Bật bộ từ: thêm các từ chưa có vào đầu hàng từ mới. Trả về số thẻ đã thêm.
  const enableSet = useCallback(
    (setId) => {
      const set = IELTS_SET_BY_ID[setId]
      if (!set) return 0
      const current = latest.current.settings
      if (!current.enabled_sets.includes(setId)) {
        updateSettings({ enabled_sets: [...current.enabled_sets, setId] })
      }
      const haveSeeds = new Set(latest.current.cards.map((c) => c.seed_id).filter(Boolean))
      const haveWords = new Set(latest.current.cards.map((c) => c.word.trim().toLowerCase()))
      const removed = new Set(current.removed_seed_ids ?? [])
      const rows = set.cards
        .filter((c) => !haveSeeds.has(c.id) && !removed.has(c.id) && !haveWords.has(c.word.trim().toLowerCase()))
        .map((c) => ({
          seed_id: c.id,
          word: c.word,
          ipa: c.ipa ?? '',
          pos: c.pos ?? '',
          meaning_vi: c.meaning_vi ?? '',
          example_en: c.example_en ?? '',
          example_vi: c.example_vi ?? '',
          youglish_query: c.youglish_query || null,
        }))
      if (rows.length) addCards(rows)
      return rows.length
    },
    [updateSettings, addCards],
  )

  // Gỡ bộ từ: xóa các thẻ CHƯA HỌC của bộ, giữ lại thẻ đã học
  const disableSet = useCallback(
    (setId) => {
      const set = IELTS_SET_BY_ID[setId]
      const current = latest.current.settings
      updateSettings({ enabled_sets: current.enabled_sets.filter((id) => id !== setId) })
      if (!set) return 0
      const ids = new Set(set.cards.map((c) => c.id))
      const doomed = latest.current.cards.filter((c) => ids.has(c.seed_id) && isNewCard(c)).map((c) => c.id)
      if (doomed.length) {
        const gone = new Set(doomed)
        setCards((list) => list.filter((c) => !gone.has(c.id)))
        queue.enqueue({ table: 'cards', action: 'delete', inFilter: { column: 'id', values: doomed } })
      }
      return doomed.length
    },
    [queue, updateSettings],
  )

  // ---------- Nối âm ----------
  const recordConnectedSpeech = useCallback(
    (itemId, result, mode) => {
      const prev = latest.current.csRows.find((r) => r.item_id === itemId)
      const row = {
        user_id: userId,
        item_id: itemId,
        attempts: (prev?.attempts ?? 0) + 1,
        correct_count: (prev?.correct_count ?? 0) + (result.perfect ? 1 : 0),
        wrong_count: (prev?.wrong_count ?? 0) + (result.perfect ? 0 : 1),
        last_score: result.score,
        best_score: Math.max(prev?.best_score ?? 0, result.score),
        last_mode: mode,
        last_practiced_at: new Date().toISOString(),
      }
      setCsRows((list) => replaceBy(list, row, 'item_id'))
      latest.current.csRows = replaceBy(latest.current.csRows, row, 'item_id')
      queue.enqueue({
        table: 'connected_speech_progress',
        action: 'upsert',
        values: row,
        onConflict: 'user_id,item_id',
        key: `cs:${itemId}`,
      })
    },
    [queue, userId],
  )

  // ---------- Luyện nghe (điền từ, phân biệt âm) ----------
  const recordListening = useCallback(
    (itemId, kind, score) => {
      const prev = latest.current.listening.find((r) => r.item_id === itemId)
      const perfect = score >= 1
      const row = {
        user_id: userId,
        item_id: itemId,
        kind,
        attempts: (prev?.attempts ?? 0) + 1,
        correct_count: (prev?.correct_count ?? 0) + (perfect ? 1 : 0),
        wrong_count: (prev?.wrong_count ?? 0) + (perfect ? 0 : 1),
        last_score: score,
        last_practiced_at: new Date().toISOString(),
      }
      setListening((list) => replaceBy(list, row, 'item_id'))
      latest.current.listening = replaceBy(latest.current.listening, row, 'item_id')
      queue.enqueue({
        table: 'listening_progress',
        action: 'upsert',
        values: row,
        onConflict: 'user_id,item_id',
        key: `listen:${itemId}`,
      })
    },
    [queue, userId],
  )

  // ---------- Chính tả ----------
  const recordDictation = useCallback(
    (entry) => {
      const row = { id: uuid(), user_id: userId, created_at: new Date().toISOString(), ...entry }
      setHistory((list) => [row, ...list])
      queue.enqueue({ table: 'dictation_history', action: 'upsert', values: row })
      return row
    },
    [queue, userId],
  )

  // ---------- Clip thật ----------
  const addClip = useCallback(
    (fields) => {
      const now = new Date().toISOString()
      const row = { id: uuid(), user_id: userId, ...fields }
      setClips((list) => [{ ...row, created_at: now }, ...list])
      queue.enqueue({ table: 'clips', action: 'upsert', values: row, key: `clip-new:${row.id}` })
      return row
    },
    [queue, userId],
  )

  const editClip = useCallback(
    (id, fields) => {
      setClips((list) => list.map((c) => (c.id === id ? { ...c, ...fields } : c)))
      queue.enqueue({ table: 'clips', action: 'update', values: fields, match: { id }, key: `clip:${id}` })
      return { id, ...fields }
    },
    [queue],
  )

  const removeClip = useCallback(
    (id) => {
      setClips((list) => list.filter((c) => c.id !== id))
      queue.enqueue({ table: 'clips', action: 'delete', match: { id } })
    },
    [queue],
  )

  // ---------- Bài tập ----------
  // Ghi kết quả một câu: câu gắn với thẻ/từ/tên thì xếp lịch làm lại,
  // câu số-ngày-giờ (ngẫu nhiên) thì chỉ cộng thống kê theo dạng
  const recordHomework = useCallback(
    (item, result) => {
      const key = item.stat ?? item.key
      const prev = latest.current.homework.find((r) => r.item_key === key)
      const next = item.stat ? nextStat(prev, result) : nextProgress(prev, result, todayString())
      const row = { user_id: userId, item_key: key, kind: item.type, ...next }
      setHomework((list) => replaceBy(list, row, 'item_key'))
      latest.current.homework = replaceBy(latest.current.homework, row, 'item_key')
      queue.enqueue({
        table: 'homework_progress',
        action: 'upsert',
        values: row,
        onConflict: 'user_id,item_key',
        key: `hw:${key}`,
      })
      return row
    },
    [queue, userId],
  )

  const saveHomeworkSession = useCallback(
    (fields) => {
      const row = { id: uuid(), user_id: userId, created_at: new Date().toISOString(), ...fields }
      setHomeworkSessions((list) => [row, ...list])
      queue.enqueue({ table: 'homework_sessions', action: 'upsert', values: row, key: `hw-session:${row.id}` })
      return row
    },
    [queue, userId],
  )

  // ---------- Bài tập được giao ----------
  // Lưu ngay một câu trả lời; đủ hết câu thì đánh dấu bộ bài đã xong
  const recordSetAnswer = useCallback(
    (set, item, answer, isCorrect) => {
      const today = todayString()
      const history = latest.current.hwAnswers
        .filter((a) => a.set_id === set.id && a.item_id === item.id)
        .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))
      const row = {
        id: uuid(),
        user_id: userId,
        set_id: set.id,
        item_id: item.id,
        answer,
        is_correct: isCorrect,
        next_due: nextDueFor(history, isCorrect, today),
        created_at: new Date().toISOString(),
      }
      const answers = [...latest.current.hwAnswers, row]
      latest.current.hwAnswers = answers
      setHwAnswers(answers)
      queue.enqueue({
        table: 'homework_answers',
        action: 'upsert',
        values: row,
        ignoreDuplicates: true,
        key: `hw-answer:${row.id}`,
      })

      const current = latest.current.hwSets.find((s) => s.id === set.id)
      if (current && !current.completed_at && setProgress(current, groupAnswers(answers)).done) {
        const completed_at = new Date().toISOString()
        const sets = replaceBy(latest.current.hwSets, { id: set.id, completed_at })
        latest.current.hwSets = sets
        setHwSets(sets)
        queue.enqueue({
          table: 'homework_sets',
          action: 'update',
          values: { completed_at },
          match: { id: set.id },
          key: `hw-set:${set.id}`,
        })
      }
      return row
    },
    [queue, userId],
  )

  // ---------- Buổi học ----------
  const saveSession = useCallback(
    (row) => {
      setSessions((list) => replaceBy(list, row))
      return queue.enqueue({ table: 'study_sessions', action: 'upsert', values: row, key: `session:${row.id}` })
    },
    [queue],
  )

  // ---------- Thông báo nhắc học ----------
  const savePushSubscription = useCallback(
    (sub) =>
      queue.enqueue({
        table: 'push_subscriptions',
        action: 'upsert',
        values: { user_id: userId, ...sub, user_agent: navigator.userAgent.slice(0, 200) },
        onConflict: 'user_id,endpoint',
      }),
    [queue, userId],
  )

  const removePushSubscription = useCallback(
    (endpoint) => queue.enqueue({ table: 'push_subscriptions', action: 'delete', match: { user_id: userId, endpoint } }),
    [queue, userId],
  )

  // ---------- Số liệu tổng hợp ----------
  const csProgress = useMemo(() => new Map(csRows.map((r) => [r.item_id, r])), [csRows])
  const listeningProgress = useMemo(() => new Map(listening.map((r) => [r.item_id, r])), [listening])
  const dictationStats = useMemo(() => buildDictationStats(history), [history])
  const homeworkProgress = useMemo(() => new Map(homework.map((r) => [r.item_key, r])), [homework])
  const hwAnswersGrouped = useMemo(() => groupAnswers(hwAnswers), [hwAnswers])

  const stats = useMemo(() => {
    const dueCards = cards
      .filter((c) => isDue(c, today))
      .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.position - b.position)
    const newCards = cards.filter(isNewCard).sort(compareNewCards)
    const introducedToday = cards.filter((c) => c.introduced_on === today).length
    const newPerDay = settings?.new_words_per_day ?? DEFAULT_SETTINGS.new_words_per_day
    const mastered = cards.filter((c) => !isNewCard(c) && c.interval_days >= MASTERED_INTERVAL_DAYS).length
    const started = cards.filter((c) => !isNewCard(c)).length
    const todaySeconds = sessions
      .filter((s) => s.study_date === today)
      .reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0)

    return {
      dueCards,
      newCards,
      newQuotaLeft: Math.max(0, Math.min(newCards.length, newPerDay - introducedToday)),
      introducedToday,
      mastered,
      learning: started - mastered,
      totalCards: cards.length,
      streak: computeStreak(studyDatesFromSessions(sessions), today),
      weekMinutes: Math.round(weekSeconds(sessions, today) / 60),
      todayMinutes: Math.round(todaySeconds / 60),
      csDone: CS_ITEMS.filter((it) => csProgress.get(it.id)?.attempts > 0).length,
      csTotal: CS_ITEMS.length,
    }
  }, [cards, sessions, settings, today, csProgress])

  const value = useMemo(
    () => ({
      status,
      error,
      offline,
      pending,
      reload: load,
      today,
      settings,
      updateSettings,
      cards,
      gradeCard,
      addCard,
      addCards,
      editCard,
      removeCard,
      enableSet,
      disableSet,
      csProgress,
      recordConnectedSpeech,
      listeningProgress,
      recordListening,
      history,
      dictationStats,
      recordDictation,
      clips,
      addClip,
      editClip,
      removeClip,
      sessions,
      saveSession,
      homeworkReady,
      homeworkProgress,
      homeworkSessions,
      recordHomework,
      saveHomeworkSession,
      setsReady,
      hwSets,
      hwAnswersGrouped,
      recordSetAnswer,
      savePushSubscription,
      removePushSubscription,
      stats,
    }),
    [
      status, error, offline, pending, load, today, settings, updateSettings, cards, gradeCard, addCard, addCards,
      editCard, removeCard, enableSet, disableSet, csProgress, recordConnectedSpeech, listeningProgress, recordListening, history,
      dictationStats, recordDictation, clips, addClip, editClip, removeClip, sessions, saveSession, homeworkReady,
      homeworkProgress, homeworkSessions, recordHomework, saveHomeworkSession, setsReady, hwSets, hwAnswersGrouped,
      recordSetAnswer, savePushSubscription, removePushSubscription, stats,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}

export { isNetworkError }
