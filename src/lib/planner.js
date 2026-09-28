// Chọn bài học: ưu tiên bài chưa làm, rồi đến bài làm lâu nhất / điểm thấp nhất.

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Nối âm: progress là Map item_id -> dòng connected_speech_progress
export function orderConnectedSpeech(items, progress) {
  const fresh = shuffle(items.filter((it) => !progress.get(it.id)?.attempts))
  const done = items
    .filter((it) => progress.get(it.id)?.attempts)
    .map((it) => ({ it, p: progress.get(it.id) }))
    .sort((a, b) => {
      const aPerfect = a.p.last_score === 1 ? 1 : 0
      const bPerfect = b.p.last_score === 1 ? 1 : 0
      if (aPerfect !== bPerfect) return aPerfect - bPerfect // câu còn sai ôn trước
      return (a.p.last_practiced_at ?? '').localeCompare(b.p.last_practiced_at ?? '')
    })
    .map(({ it }) => it)
  return [...fresh, ...done]
}

// Chính tả: stats là Map sentence_id -> { attempts, lastScore, lastAt }
export function orderDictation(sentences, stats, { byLevel = true } = {}) {
  const rank = (s) => {
    const st = stats.get(s.id)
    return st ? 1 : 0
  }
  const sorted = [...sentences].sort((a, b) => {
    const r = rank(a) - rank(b)
    if (r !== 0) return r
    const sa = stats.get(a.id)
    const sb = stats.get(b.id)
    if (sa && sb) {
      if (sa.lastScore !== sb.lastScore) return sa.lastScore - sb.lastScore
      return (sa.lastAt ?? '').localeCompare(sb.lastAt ?? '')
    }
    if (byLevel && a.level !== b.level) return a.level - b.level
    return 0
  })
  return sorted
}

export function buildDictationStats(history) {
  const stats = new Map()
  // history sắp xếp mới nhất trước
  for (const h of history) {
    if (!h.sentence_id) continue
    const st = stats.get(h.sentence_id)
    if (!st) stats.set(h.sentence_id, { attempts: 1, lastScore: h.score, lastAt: h.created_at, best: h.score })
    else {
      st.attempts += 1
      st.best = Math.max(st.best, h.score)
    }
  }
  return stats
}

export { shuffle }
