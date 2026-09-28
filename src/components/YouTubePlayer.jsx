import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { formatSeconds } from '../lib/dates.js'

// Tải YouTube IFrame API một lần cho cả app
let apiPromise = null
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      apiPromise = null
      reject(new Error('Không tải được YouTube'))
    }
    document.head.appendChild(script)
  })
  return apiPromise
}

const RATES = [0.75, 1]

// Trình phát YouTube nhúng trong app.
// - start/end: đoạn cần nghe (end = null → không tự dừng)
// - controls="segment": nút phát đoạn, lặp lại, lùi 3 giây, tốc độ
// - apiRef: nhận { getCurrentTime } để form thêm clip lấy mốc thời gian
export default function YouTubePlayer({ videoId, start = 0, end = null, controls = 'segment', apiRef }) {
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const loopRef = useRef(false)
  const [status, setStatus] = useState('loading') // loading | ready | error | blocked
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(false)
  const [rate, setRate] = useState(1)
  const segment = useRef({ start, end })

  useEffect(() => {
    segment.current = { start, end }
  }, [start, end])

  useEffect(() => {
    loopRef.current = loop
  }, [loop])

  // Tạo trình phát
  useEffect(() => {
    let cancelled = false
    let player = null
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return
        const mount = document.createElement('div')
        hostRef.current.replaceChildren(mount)
        player = new YT.Player(mount, {
          videoId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            start: Math.floor(segment.current.start || 0),
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: () => {
              if (cancelled) return
              playerRef.current = player
              setStatus('ready')
            },
            onStateChange: (e) => setPlaying(e.data === YT.PlayerState.PLAYING),
            // 101/150: chủ video không cho nhúng
            onError: (e) => setStatus(e.data === 101 || e.data === 150 ? 'blocked' : 'error'),
          },
        })
      })
      .catch(() => !cancelled && setStatus('error'))
    return () => {
      cancelled = true
      playerRef.current = null
      try {
        player?.destroy()
      } catch {
        // bỏ qua
      }
    }
  }, [videoId])

  // Cho component cha đọc thời điểm đang phát
  useEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      getCurrentTime: () => playerRef.current?.getCurrentTime?.() ?? null,
    }
    return () => {
      apiRef.current = null
    }
  }, [apiRef])

  // Tự dừng (hoặc lặp lại) khi tới mốc kết thúc
  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      const p = playerRef.current
      const { start: s, end: e } = segment.current
      if (!p || e == null) return
      if (p.getCurrentTime() >= e) {
        if (loopRef.current) p.seekTo(s, true)
        else p.pauseVideo()
      }
    }, 150)
    return () => clearInterval(timer)
  }, [playing])

  const playSegment = () => {
    const p = playerRef.current
    if (!p) return
    p.seekTo(segment.current.start || 0, true)
    p.playVideo()
  }

  const back3 = () => {
    const p = playerRef.current
    if (!p) return
    p.seekTo(Math.max(segment.current.start || 0, p.getCurrentTime() - 3), true)
    p.playVideo()
  }

  const changeRate = (r) => {
    setRate(r)
    playerRef.current?.setPlaybackRate(r)
  }

  return (
    <div className="yt">
      <div className="yt-frame">
        <div ref={hostRef} className="yt-host" />
        {status === 'loading' && <p className="yt-overlay">Đang tải video…</p>}
        {status === 'error' && (
          <p className="yt-overlay">Không tải được video (có thể do mất mạng). Bạn dùng nút mở trên YouTube nhé.</p>
        )}
        {status === 'blocked' && (
          <p className="yt-overlay">Video này không cho phát trong app. Bạn dùng nút mở trên YouTube nhé.</p>
        )}
      </div>

      {controls === 'segment' && status === 'ready' && (
        <div className="yt-controls">
          <button type="button" className="btn btn-primary" onClick={playSegment}>
            <Icon name="play" size={18} /> {end != null ? `Phát đoạn ${formatSeconds(start)}–${formatSeconds(end)}` : `Phát từ ${formatSeconds(start)}`}
          </button>
          <div className="button-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={back3}>
              Lùi 3 giây
            </button>
            {end != null && (
              <button
                type="button"
                className={`btn btn-sm ${loop ? 'btn-primary' : 'btn-secondary'}`}
                aria-pressed={loop}
                onClick={() => setLoop((l) => !l)}
              >
                Lặp lại đoạn
              </button>
            )}
            <div className="segmented" role="group" aria-label="Tốc độ video">
              {RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={rate === r ? 'active' : ''}
                  aria-pressed={rate === r}
                  onClick={() => changeRate(r)}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>
          <p className="hint">Trên iPhone, nếu nút chưa phát được thì chạm thẳng vào video một lần.</p>
        </div>
      )}
    </div>
  )
}
