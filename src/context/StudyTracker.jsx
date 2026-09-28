// Đo thời gian học thực tế và ghi lại từng buổi học (bảng study_sessions).
// Chỉ tính giờ khi đang ở màn hình luyện tập, tab đang mở và có thao tác
// trong 2 phút gần nhất, nên để máy đó rồi đi chỗ khác sẽ không bị tính.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useData } from './DataContext.jsx'
import { todayString } from '../lib/dates.js'
import { uuid } from '../lib/ids.js'

const TrackerContext = createContext(null)

const IDLE_LIMIT_MS = 2 * 60_000
const NEW_SESSION_GAP_MS = 30 * 60_000
const FLUSH_EVERY_MS = 20_000
const MIN_SECONDS_TO_SAVE = 15

export function StudyTrackerProvider({ children }) {
  const { user } = useAuth()
  const { saveSession } = useData()

  const current = useRef(null)
  const activeScreens = useRef(0)
  const activeKind = useRef('free')
  const lastInteraction = useRef(0)
  const chain = useRef(Promise.resolve())
  const debounce = useRef(null)
  const saveRef = useRef(saveSession)
  useEffect(() => {
    saveRef.current = saveSession
  }, [saveSession])

  const flush = useCallback(() => {
    const cur = current.current
    if (!cur || !cur.dirty) return chain.current
    const hasActivity = Object.keys(cur.activities).length > 0
    if (!hasActivity && cur.duration_seconds < MIN_SECONDS_TO_SAVE) return chain.current
    cur.dirty = false
    const row = {
      id: cur.id,
      user_id: user.id,
      study_date: cur.study_date,
      kind: cur.kind,
      started_at: cur.started_at,
      ended_at: new Date().toISOString(),
      duration_seconds: Math.round(cur.duration_seconds),
      activities: { ...cur.activities },
    }
    // Ghi tuần tự để bản cũ không đè lên bản mới
    chain.current = chain.current
      .then(() => saveRef.current(row))
      .catch((err) => {
        console.error(err)
        cur.dirty = true
      })
    return chain.current
  }, [user.id])

  const startNew = useCallback(
    (kind) => {
      flush()
      current.current = {
        id: uuid(),
        study_date: todayString(),
        kind,
        started_at: new Date().toISOString(),
        duration_seconds: 0,
        activities: {},
        lastActiveAt: Date.now(),
        dirty: false,
      }
      return current.current
    },
    [flush],
  )

  const ensureSession = useCallback(
    (kind) => {
      const cur = current.current
      const now = Date.now()
      if (
        !cur ||
        cur.study_date !== todayString() ||
        cur.kind !== kind ||
        now - cur.lastActiveAt > NEW_SESSION_GAP_MS
      ) {
        return startNew(kind)
      }
      cur.lastActiveAt = now
      return cur
    },
    [startNew],
  )

  useEffect(() => {
    const mark = () => {
      lastInteraction.current = Date.now()
    }
    const events = ['pointerdown', 'keydown', 'touchstart', 'input']
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }))

    const tick = setInterval(() => {
      if (activeScreens.current <= 0) return
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastInteraction.current > IDLE_LIMIT_MS) return
      const cur = ensureSession(activeKind.current)
      cur.duration_seconds += 1
      cur.dirty = true
    }, 1000)
    const flusher = setInterval(flush, FLUSH_EVERY_MS)
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)

    return () => {
      events.forEach((e) => window.removeEventListener(e, mark))
      clearInterval(tick)
      clearInterval(flusher)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [ensureSession, flush])

  const enter = useCallback(
    (kind) => {
      activeScreens.current += 1
      activeKind.current = kind
      lastInteraction.current = Date.now()
      // Mỗi lần bấm "Học tối thiểu 10 phút" là một buổi học mới
      if (kind === 'daily') startNew('daily')
    },
    [startNew],
  )

  const leave = useCallback(() => {
    activeScreens.current = Math.max(0, activeScreens.current - 1)
    flush()
  }, [flush])

  const addActivity = useCallback(
    (key, amount = 1) => {
      const cur = ensureSession(activeKind.current)
      cur.activities[key] = (cur.activities[key] ?? 0) + amount
      cur.dirty = true
      clearTimeout(debounce.current)
      debounce.current = setTimeout(flush, 1500)
    },
    [ensureSession, flush],
  )

  const getCurrent = useCallback(() => {
    const cur = current.current
    return cur
      ? { kind: cur.kind, duration_seconds: cur.duration_seconds, activities: { ...cur.activities } }
      : { kind: null, duration_seconds: 0, activities: {} }
  }, [])

  const value = useMemo(
    () => ({ enter, leave, addActivity, getCurrent, flush }),
    [enter, leave, addActivity, getCurrent, flush],
  )

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>
}

// Gọi ở mỗi màn hình luyện tập để bắt đầu tính giờ học
export function useStudyTimer(kind = 'free') {
  const tracker = useContext(TrackerContext)
  const { enter, leave } = tracker
  useEffect(() => {
    enter(kind)
    return () => leave()
  }, [kind, enter, leave])
  return tracker
}

export function useTracker() {
  return useContext(TrackerContext)
}
