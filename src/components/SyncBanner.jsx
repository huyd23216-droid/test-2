import { useEffect, useState } from 'react'
import { useData } from '../context/DataContext.jsx'

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

// Báo trạng thái đồng bộ một cách nhẹ nhàng
export default function SyncBanner() {
  const { offline, pending } = useData()
  const online = useOnline()

  if (!online || offline) {
    return (
      <div className="sync-banner" role="status">
        <span className="sync-dot" aria-hidden="true" />
        <span>
          Đang học offline. Kết quả được lưu trên máy và sẽ tự đồng bộ khi có mạng
          {pending > 0 ? ` (${pending} thay đổi đang chờ)` : ''}.
        </span>
      </div>
    )
  }
  if (pending > 0) {
    return (
      <div className="sync-banner sync-banner-quiet" role="status">
        <span className="sync-dot sync-dot-busy" aria-hidden="true" />
        <span>Đang đồng bộ {pending} thay đổi…</span>
      </div>
    )
  }
  return null
}
