// Tra từ tự động bằng 2 dịch vụ miễn phí, không cần khóa API:
// - Free Dictionary API (dictionaryapi.dev): phiên âm, loại từ, câu ví dụ
// - MyMemory (mymemory.translated.net): dịch nghĩa sang tiếng Việt
// Kết quả chỉ là gợi ý (nhất là bản dịch máy) nên bạn xem lại trước khi lưu.
// Dịch vụ lỗi hoặc mất mạng thì trả về phần tra được (có thể rỗng).

const TIMEOUT_MS = 7000
const KNOWN_POS = new Set([
  'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'determiner', 'article', 'number', 'interjection',
])

async function getJson(url, signal) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const onAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

// Rút gọn kết quả của dictionaryapi.dev (tách riêng để dễ kiểm thử)
export function parseDictionaryEntry(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return {}
  const phonetics = entries.flatMap((e) => e.phonetics ?? []).filter((p) => p.text)
  const us = phonetics.find((p) => /-us\.mp3$/.test(p.audio ?? ''))
  const ipaRaw = us?.text ?? entries.find((e) => e.phonetic)?.phonetic ?? phonetics[0]?.text ?? ''
  const ipa = ipaRaw ? `/${ipaRaw.replace(/^[/[]|[/\]]$/g, '')}/` : ''

  const meanings = entries.flatMap((e) => e.meanings ?? [])
  const pos = [...new Set(meanings.map((m) => m.partOfSpeech).filter((p) => KNOWN_POS.has(p)))].slice(0, 2).join(', ')
  const example =
    meanings.flatMap((m) => m.definitions ?? []).find((d) => d.example && d.example.length <= 120)?.example ?? ''
  const definition = meanings[0]?.definitions?.[0]?.definition ?? ''
  return { ipa, pos, example_en: example ? example[0].toUpperCase() + example.slice(1) : '', definition_en: definition }
}

export async function translateToVietnamese(text, signal) {
  if (!text) return ''
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en%7Cvi`
  const data = await getJson(url, signal)
  const out = data?.responseData?.translatedText?.trim() ?? ''
  // MyMemory trả về thông báo lỗi dạng chữ in hoa khi hết lượt dùng trong ngày
  if (!out || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(out)) return ''
  return out.toLowerCase() === text.toLowerCase() ? '' : out
}

export async function lookupWord(word, { signal, translateExample = true } = {}) {
  const w = String(word ?? '').trim()
  if (!w) return {}
  const [dict, meaning] = await Promise.all([
    getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w.toLowerCase())}`, signal).then(
      parseDictionaryEntry,
    ),
    translateToVietnamese(w, signal),
  ])
  const example_vi = translateExample && dict.example_en ? await translateToVietnamese(dict.example_en, signal) : ''
  return { ...dict, meaning_vi: meaning, example_vi }
}
