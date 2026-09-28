export function youglishUrl(query) {
  const q = String(query ?? '').trim().replace(/\s+/g, ' ')
  return `https://youglish.com/pronounce/${encodeURIComponent(q)}/english/us`
}
