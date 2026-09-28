// Nạp toàn bộ dữ liệu của user một lần, giữ trong bộ nhớ và cập nhật lạc quan
// (hiển thị ngay, lưu lên Supabase ở phía sau). Khi quay lại app sau hơn
// 1 phút, dữ liệu được tải lại để đồng bộ với thiết bị khác.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useToast } from './ToastContext.jsx'
import * as db from '../lib/db.js'
import { SEED_CARDS, CS_ITEMS } from '../lib/content.js'
import { schedule, isDue, isNewCard, compareNewCards } from '../lib/srs.js'
import { todayString } from '../lib/dates.js'
import { computeStreak, studyDatesFromSessions, weekSeconds } from '../lib/streak.js'
import { buildDictationStats } from '../lib/planner.js'
import { MASTERED_INTERVAL_DAYS, DEFAULT_SETTINGS } from '../config.js'

const DataContext = createContext(null)
const RELOAD_AFTER_MS = 60_000
const SAVE_ERROR = 'Chưa lưu được lên máy chủ. Bạn kiểm tra kết nối mạng giúp mình nhé.'

const replaceById = (list, row, key = 'id') => {
  const idx = list.findIndex((r) => r[key] === row[key])
  if (idx === -1) return [...list, row]
  const copy = [...list]
  copy[idx] = row
  return copy
}

// Đọc toàn bộ dữ liệu của user; nạp các thẻ khởi đầu còn thiếu
// (lần đầu đăng nhập, hoặc khi vocabulary.json có thêm từ mới).
async function fetchUserData(userId, onSeeding) {
  const settings = await db.getOrCreateSettings(userId)
  let [cards, csRows, history, sessions, clips] = await Promise.all([
    db.fetchCards(userId),
    db.fetchConnectedSpeechProgress(userId),
    db.fetchDictationHistory(userId),
    db.fetchStudySessions(userId),
    db.fetchClips(userId),
  ])

  const haveSeeds = new Set(cards.map((c) => c.seed_id).filter(Boolean))
  const removed = new Set(settings.removed_seed_ids ?? [])
  const missing = SEED_CARDS.filter((s) => !haveSeeds.has(s.id) && !removed.has(s.id))
  if (missing.length > 0) {
    onSeeding?.()
    await db.insertSeedCards(userId, missing)
    // Đọc lại, phòng khi thiết bị khác cũng vừa nạp cùng lúc
    cards = await db.fetchCards(userId)
  }

  return { settings, cards, csRows, history, sessions, clips }
}

export function DataProvider({ children }) {
  const { user } = useAuth()
  const userId = user.id
  const { showToast } = useToast()

  const [status, setStatus] = useState('loading') // loading | seeding | ready | error
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState(null)
  const [cards, setCards] = useState([])
  const [csRows, setCsRows] = useState([])
  const [history, setHistory] = useState([])
  const [sessions, setSessions] = useState([])
  const [clips, setClips] = useState([])
  const [today, setToday] = useState(todayString)

  const lastLoadedAt = useRef(0)
  const loading = useRef(false)
  const csRowsRef = useRef(csRows)
  const settingsRef = useRef(settings)
  useEffect(() => {
    csRowsRef.current = csRows
    settingsRef.current = settings
  }, [csRows, settings])

  const apply = useCallback((data) => {
    setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
    setCards(data.cards)
    setCsRows(data.csRows)
    setHistory(data.history)
    setSessions(data.sessions)
    setClips(data.clips)
    lastLoadedAt.current = Date.now()
    setStatus('ready')
  }, [])

  const fail = useCallback((err) => {
    console.error(err)
    setError(err)
    setStatus('error')
  }, [])

  // Tải lại: silent = chạy nền (không che màn hình, bỏ qua lỗi mạng)
  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (loading.current) return
      loading.current = true
      if (!silent) {
        setStatus('loading')
        setError(null)
      }
      try {
        apply(await fetchUserData(userId, silent ? undefined : () => setStatus('seeding')))
      } catch (err) {
        if (silent) console.error(err)
        else fail(err)
      } finally {
        loading.current = false
      }
    },
    [userId, apply, fail],
  )

  // Lần tải đầu tiên
  useEffect(() => {
    if (loading.current) return
    loading.current = true
    fetchUserData(userId, () => setStatus('seeding'))
      .then(apply, fail)
      .finally(() => {
        loading.current = false
      })
  }, [userId, apply, fail])

  // Đồng bộ khi quay lại app + cập nhật "hôm nay" khi qua ngày mới
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      setToday(todayString())
      if (lastLoadedAt.current && Date.now() - lastLoadedAt.current > RELOAD_AFTER_MS) {
        load({ silent: true })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const timer = setInterval(() => setToday(todayString()), 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      clearInterval(timer)
    }
  }, [load])

  // ---------- Cài đặt ----------
  const updateSettings = useCallback(
    async (patch) => {
      const before = settingsRef.current
      setSettings((s) => ({ ...s, ...patch }))
      try {
        const saved = await db.updateSettings(userId, patch)
        setSettings((s) => ({ ...s, ...saved }))
        return true
      } catch (err) {
        console.error(err)
        setSettings(before)
        showToast(SAVE_ERROR, { tone: 'warn' })
        return false
      }
    },
    [userId, showToast],
  )

  // ---------- Thẻ từ vựng ----------
  const gradeCard = useCallback(
    async (card, grade) => {
      const patch = schedule(card, grade, todayString())
      const updated = { ...card, ...patch }
      setCards((list) => replaceById(list, updated))
      try {
        const saved = await db.updateCard(card.id, patch)
        setCards((list) => replaceById(list, saved))
      } catch (err) {
        console.error(err)
        setCards((list) => replaceById(list, card))
        showToast(SAVE_ERROR, { tone: 'warn' })
      }
      return updated
    },
    [showToast],
  )

  const addCard = useCallback(
    async (fields) => {
      const saved = await db.insertCard(userId, fields)
      setCards((list) => [...list, saved])
      return saved
    },
    [userId],
  )

  const editCard = useCallback(async (id, fields) => {
    const saved = await db.updateCard(id, fields)
    setCards((list) => replaceById(list, saved))
    return saved
  }, [])

  const removeCard = useCallback(
    async (card) => {
      if (card.seed_id) {
        // Ghi nhớ trước để thẻ khởi đầu đã xóa không bị tự nạp lại
        const removed = new Set(settingsRef.current?.removed_seed_ids ?? [])
        removed.add(card.seed_id)
        const ok = await updateSettings({ removed_seed_ids: [...removed] })
        if (!ok) throw new Error('Không lưu được cài đặt')
      }
      await db.deleteCard(card.id)
      setCards((list) => list.filter((c) => c.id !== card.id))
    },
    [updateSettings],
  )

  // ---------- Nối âm ----------
  const recordConnectedSpeech = useCallback(
    async (itemId, result, mode) => {
      const prev = csRowsRef.current.find((r) => r.item_id === itemId)
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
      setCsRows((list) => replaceById(list, row, 'item_id'))
      try {
        const saved = await db.upsertConnectedSpeechProgress(row)
        setCsRows((list) => replaceById(list, saved, 'item_id'))
      } catch (err) {
        console.error(err)
        showToast(SAVE_ERROR, { tone: 'warn' })
      }
    },
    [userId, showToast],
  )

  // ---------- Chính tả ----------
  const recordDictation = useCallback(
    async (entry) => {
      try {
        const saved = await db.insertDictation({ user_id: userId, ...entry })
        setHistory((list) => [saved, ...list])
      } catch (err) {
        console.error(err)
        showToast(SAVE_ERROR, { tone: 'warn' })
      }
    },
    [userId, showToast],
  )

  // ---------- Clip thật ----------
  const addClip = useCallback(
    async (fields) => {
      const saved = await db.insertClip(userId, fields)
      setClips((list) => [saved, ...list])
      return saved
    },
    [userId],
  )

  const editClip = useCallback(async (id, fields) => {
    const saved = await db.updateClip(id, fields)
    setClips((list) => list.map((c) => (c.id === id ? saved : c)))
    return saved
  }, [])

  const removeClip = useCallback(async (id) => {
    await db.deleteClip(id)
    setClips((list) => list.filter((c) => c.id !== id))
  }, [])

  // ---------- Buổi học ----------
  const saveSession = useCallback(async (row) => {
    setSessions((list) => replaceById(list, row))
    const saved = await db.upsertStudySession(row)
    setSessions((list) => replaceById(list, saved))
    return saved
  }, [])

  // ---------- Số liệu tổng hợp ----------
  const csProgress = useMemo(() => new Map(csRows.map((r) => [r.item_id, r])), [csRows])
  const dictationStats = useMemo(() => buildDictationStats(history), [history])

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
      reload: load,
      today,
      settings,
      updateSettings,
      cards,
      gradeCard,
      addCard,
      editCard,
      removeCard,
      csProgress,
      recordConnectedSpeech,
      history,
      dictationStats,
      recordDictation,
      clips,
      addClip,
      editClip,
      removeClip,
      sessions,
      saveSession,
      stats,
    }),
    [
      status, error, load, today, settings, updateSettings, cards, gradeCard, addCard, editCard,
      removeCard, csProgress, recordConnectedSpeech, history, dictationStats, recordDictation,
      clips, addClip, editClip, removeClip, sessions, saveSession, stats,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
