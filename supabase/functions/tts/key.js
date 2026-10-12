// Dùng chung cho web (src/lib/cloudTts.js) và Edge Function "tts".
// Tên file âm thanh được tính từ giọng + câu, nên mỗi câu chỉ cần tạo giọng
// một lần, sau đó web phát lại file đã lưu trong Supabase Storage.

export const TTS_BUCKET = 'tts-cache'
export const MAX_TTS_CHARS = 400

// Chỉ nhận giọng Chirp 3 HD tiếng Anh Mỹ / Anh, ví dụ en-US-Chirp3-HD-Aoede
export const CLOUD_VOICE_PATTERN = /^en-(US|GB)-Chirp3-HD-[A-Z][a-z]+$/

export function normalizeSpeechText(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function audioPath(voice, text) {
  const data = new TextEncoder().encode(`${voice}\n${normalizeSpeechText(text)}`)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return `${voice}/${hex.slice(0, 40)}.mp3`
}
