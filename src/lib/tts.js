// Đọc tiếng Anh bằng Web Speech API (speechSynthesis).
// Giọng: Mỹ (en-US), Anh (en-GB) hoặc xen kẽ (mỗi câu cố định một giọng).

export const ACCENTS = {
  us: { lang: 'en-US', label: 'Giọng Mỹ' },
  uk: { lang: 'en-GB', label: 'Giọng Anh' },
}

// Ưu tiên các giọng nghe tự nhiên thường có sẵn trên Mac, iPhone, Chrome, Edge
const PREFERRED_VOICES = {
  us: ['Samantha', 'Ava', 'Allison', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Guy', 'Alex', 'Microsoft Zira'],
  uk: ['Daniel', 'Kate', 'Serena', 'Arthur', 'Google UK English Female', 'Google UK English Male', 'Microsoft Sonia', 'Microsoft Libby', 'Microsoft Ryan', 'Microsoft Hazel', 'Microsoft George'],
}

let defaultAccent = 'us' // 'us' | 'uk' | 'mixed', đặt theo cài đặt của bạn
let current = null // câu đang đọc (giữ tham chiếu để Chrome không thu hồi giữa chừng)

export function setDefaultAccent(accent) {
  defaultAccent = accent === 'uk' || accent === 'mixed' ? accent : 'us'
}

export function getDefaultAccent() {
  return defaultAccent
}

// Giọng dùng cho một câu. Chế độ xen kẽ: chọn theo nội dung câu nên nghe lại
// bao nhiêu lần vẫn cùng một giọng.
export function accentFor(text, accent = defaultAccent) {
  if (accent !== 'mixed') return accent === 'uk' ? 'uk' : 'us'
  let hash = 0
  for (const ch of String(text)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return hash % 2 === 0 ? 'us' : 'uk'
}

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

const normLang = (voice) => voice.lang?.replace('_', '-').toLowerCase()

export function getVoices(accent = 'us') {
  if (!isSpeechSupported()) return []
  const lang = ACCENTS[accent].lang.toLowerCase()
  return window.speechSynthesis.getVoices().filter((v) => normLang(v) === lang)
}

// Giữ tương thích tên hàm cũ
export const getEnglishVoices = () => getVoices('us')

const voiceKey = (accent) => (accent === 'uk' ? 'tts-voice-uri:uk' : 'tts-voice-uri')

export function getPreferredVoiceURI(accent = 'us') {
  try {
    return localStorage.getItem(voiceKey(accent)) || ''
  } catch {
    return ''
  }
}

export function setPreferredVoiceURI(uri, accent = 'us') {
  try {
    if (uri) localStorage.setItem(voiceKey(accent), uri)
    else localStorage.removeItem(voiceKey(accent))
  } catch {
    // bỏ qua nếu trình duyệt chặn localStorage
  }
}

export function pickVoice(accent = 'us') {
  const voices = getVoices(accent)
  if (voices.length === 0) return null
  const saved = getPreferredVoiceURI(accent)
  const savedVoice = saved && voices.find((v) => v.voiceURI === saved)
  if (savedVoice) return savedVoice
  for (const name of PREFERRED_VOICES[accent]) {
    const v = voices.find((voice) => voice.name.startsWith(name))
    if (v) return v
  }
  return voices.find((v) => v.localService) ?? voices[0]
}

export function stopSpeaking() {
  if (!isSpeechSupported()) return
  current?.finish()
  window.speechSynthesis.cancel()
}

export function speak(text, { rate = 1, accent, onStart, onEnd } = {}) {
  if (!isSpeechSupported() || !text) {
    onEnd?.()
    return
  }
  const synth = window.speechSynthesis
  const which = accentFor(text, accent ?? defaultAccent)
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = ACCENTS[which].lang
  utterance.rate = rate
  const voice = pickVoice(which) ?? (which === 'uk' ? null : pickVoice('us'))
  if (voice) utterance.voice = voice

  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    if (current?.utterance === utterance) current = null
    onEnd?.()
  }
  utterance.onstart = () => onStart?.()
  utterance.onend = finish
  utterance.onerror = finish

  const wasBusy = synth.speaking || synth.pending
  // Báo cho nút đang đọc trước đó biết là đã dừng (Safari không luôn gửi sự kiện)
  current?.finish()
  current = { utterance, finish }

  if (wasBusy) {
    synth.cancel()
    // Safari đôi khi bỏ qua lệnh speak() gọi ngay sau cancel()
    setTimeout(() => synth.speak(utterance), 80)
  } else {
    synth.speak(utterance)
  }
}
