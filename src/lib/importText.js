// Đọc danh sách từ dán vào ô nhập. Mỗi dòng một từ, các cột cách nhau bằng
// dấu | hoặc phím Tab (dán từ Excel/Google Sheets):
//   word
//   word | nghĩa tiếng Việt
//   word | nghĩa tiếng Việt | câu ví dụ | nghĩa câu ví dụ
export const IMPORT_LIMIT = 200

export function parseImportText(text) {
  const seen = new Set()
  const rows = []
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split(/\s*[|\t]\s*/).map((p) => p.trim())
    const word = parts[0].replace(/^[-•*\d.)\s]+/, '').trim()
    if (!word) continue
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      word,
      meaning_vi: parts[1] ?? '',
      example_en: parts[2] ?? '',
      example_vi: parts[3] ?? '',
    })
    if (rows.length >= IMPORT_LIMIT) break
  }
  return rows
}
