// accent: 'us' | 'uk' | 'mixed' (xen kẽ → tìm cả hai giọng)
export function youglishUrl(query, accent = 'us') {
  const q = String(query ?? '').trim().replace(/\s+/g, ' ')
  const region = accent === 'uk' ? '/uk' : accent === 'mixed' ? '' : '/us'
  return `https://youglish.com/pronounce/${encodeURIComponent(q)}/english${region}`
}
