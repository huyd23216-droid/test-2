// Xử lý link YouTube cho tính năng "clip thật".

const ID_RE = /^[A-Za-z0-9_-]{11}$/

export function parseYouTubeId(input) {
  let url
  try {
    url = new URL(String(input ?? '').trim())
  } catch {
    return null
  }
  if (!/^https?:$/.test(url.protocol)) return null
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
  let id = null
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1]
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)
      if (m) id = m[1]
    }
  }
  return id && ID_RE.test(id) ? id : null
}

// Đọc mốc thời gian có sẵn trong link (?t=83, ?t=1m23s, &start=83)
export function parseYouTubeStart(input) {
  let url
  try {
    url = new URL(String(input ?? '').trim())
  } catch {
    return null
  }
  const t = url.searchParams.get('t') ?? url.searchParams.get('start')
  if (!t) return null
  if (/^\d+s?$/.test(t)) return parseInt(t, 10)
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (!m || !m[0]) return null
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0)
}

// Link mở video tại đúng mốc thời gian. Trả về null nếu link không hợp lệ.
export function youtubeWatchUrl(input, startSeconds = 0) {
  const id = parseYouTubeId(input)
  if (!id) return null
  const start = Math.max(0, Math.floor(startSeconds || 0))
  return `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}`
}
