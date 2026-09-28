// Đọc tiếng Anh bằng Web Speech API (speechSynthesis), giọng en-US.

const VOICE_KEY = 'tts-voice-uri'

// Ưu tiên các giọng nghe tự nhiên thường có sẵn trên Mac, iPhone, Chrome, Edge
const PREFERRED_VOICES = [
  'Samantha',
  'Ava',
  'Allison',
  'Google US English',
  'Microsoft Aria',
  'Microsoft Jenny',
  'Microsoft Guy',
  'Alex',
  'Microsoft Zira',
]

// Giữ tham chiếu tới câu đang đọc để Chrome không thu hồi giữa chừng
let current = null

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

function isUsEnglish(voice) {
  return voice.lang?.replace('_', '-').toLowerCase() === 'en-us'
}

export function getEnglishVoices() {
  if (!isSpeechSupported()) return []
  return window.speechSynthesis.getVoices().filter(isUsEnglish)
}

export function getPreferredVoiceURI() {
  try {
    return localStorage.getItem(VOICE_KEY) || ''
  } catch {
    return ''
  }
}

export function setPreferredVoiceURI(uri) {
  try {
    if (uri) localStorage.setItem(VOICE_KEY, uri)
    else localStorage.removeItem(VOICE_KEY)
  } catch {
    // bỏ qua nếu trình duyệt chặn localStorage
  }
}

export function pickVoice() {
  const voices = getEnglishVoices()
  if (voices.length === 0) return null
  const saved = getPreferredVoiceURI()
  const savedVoice = saved && voices.find((v) => v.voiceURI === saved)
  if (savedVoice) return savedVoice
  for (const name of PREFERRED_VOICES) {
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

export function speak(text, { rate = 1, onStart, onEnd } = {}) {
  if (!isSpeechSupported() || !text) {
    onEnd?.()
    return
  }
  const synth = window.speechSynthesis
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = rate
  const voice = pickVoice()
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
