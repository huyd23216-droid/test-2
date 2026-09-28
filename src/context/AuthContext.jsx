import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { isNetworkError } from '../lib/syncQueue.js'

const AuthContext = createContext(null)
const LAST_USER_KEY = 'last-user'

// Nhớ người dùng gần nhất để vẫn mở được app khi mất mạng (phiên đăng nhập
// hết hạn mà không làm mới được). Có mạng lại, Supabase tự làm mới phiên.
function rememberUser(user) {
  try {
    if (user) localStorage.setItem(LAST_USER_KEY, JSON.stringify({ id: user.id, email: user.email }))
    else localStorage.removeItem(LAST_USER_KEY)
  } catch {
    // bỏ qua
  }
}

function lastUser() {
  try {
    return JSON.parse(localStorage.getItem(LAST_USER_KEY) || 'null')
  } catch {
    return null
  }
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

// Chờ Supabase kiểm tra phiên tối đa chừng này rồi mới vào app bằng người dùng đã lưu
// (khi mạng chập chờn, supabase-js có thể thử lại tới ~30 giây)
const OFFLINE_FALLBACK_MS = 4000

export function AuthProvider({ children }) {
  // undefined = đang kiểm tra, null = chưa đăng nhập.
  // Đang offline mà đã từng đăng nhập → vào thẳng app, có mạng sẽ kiểm tra lại.
  const [session, setSession] = useState(() =>
    isOffline() && lastUser() ? { user: lastUser(), offline: true } : undefined,
  )

  useEffect(() => {
    let active = true
    let resolved = false

    const fallBackToLastUser = () => {
      if (!active || resolved || !lastUser()) return false
      setSession((current) => current ?? { user: lastUser(), offline: true })
      return true
    }

    const check = () =>
      supabase.auth.getSession().then(({ data, error }) => {
        if (!active) return
        if (data.session) {
          resolved = true
          rememberUser(data.session.user)
          setSession(data.session)
        } else if (error && isNetworkError(error)) {
          if (!fallBackToLastUser()) setSession((current) => current ?? null)
        } else {
          resolved = true
          setSession(null)
        }
      })

    let timer
    if (!isOffline()) {
      timer = setTimeout(fallBackToLastUser, OFFLINE_FALLBACK_MS)
      check()
    }
    const onOnline = () => {
      resolved = false
      check()
    }
    window.addEventListener('online', onOnline)

    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession) {
        resolved = true
        rememberUser(newSession.user)
        setSession(newSession)
      } else if (event === 'SIGNED_OUT') {
        resolved = true
        rememberUser(null)
        setSession(null)
      }
      // INITIAL_SESSION rỗng (vd đang offline) đã được check() ở trên xử lý
    })
    return () => {
      active = false
      clearTimeout(timer)
      window.removeEventListener('online', onOnline)
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      loading: session === undefined,
      session,
      user: session?.user ?? null,
      signOut: async () => {
        rememberUser(null)
        const { error } = await supabase.auth.signOut()
        if (error) {
          // Mất mạng: vẫn đăng xuất trên thiết bị này
          await supabase.auth.signOut({ scope: 'local' })
        }
        setSession(null)
      },
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
