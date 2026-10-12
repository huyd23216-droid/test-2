// Đọc tiếng Anh: ưu tiên giọng Google Chirp 3 HD (cloudTts.js), không được thì
// dùng Web Speech API (speechSynthesis) có sẵn trên thiết bị.
// Giọng: Mỹ (en-US), Anh (en-GB) hoặc xen kẽ (mỗi câu cố định một giọng).
import { canUseCloud, ensureCloudAudio, forgetCloudAudio, readyCloudUrl } from './cloudTts.js'

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

// Đọc được bằng giọng Google hoặc giọng của máy
export function canSpeak() {
  return isSpeechSupported() || canUseCloud()
}

// Chuẩn bị trước file giọng Google cho các câu sắp đọc, để bấm là phát ngay
export function prepareSpeech(texts, accent) {
  if (!canUseCloud()) return
  for (const text of [].concat(texts)) {
    if (text) ensureCloudAudio(text, accentFor(text, accent ?? defaultAccent)).catch(() => {})
  }
}

// Một phần tử phát dùng chung: iPhone chỉ cho phát tiếp trên phần tử đã từng
// được phát bằng một lần chạm
let audio = null
function sharedAudio() {
  if (!audio) audio = new Audio()
  return audio
}

export function stopSpeaking() {
  current?.finish()
  audio?.pause()
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}

export function speak(text, { rate = 1, accent, onStart, onEnd } = {}) {
  if (!text || !canSpeak()) {
    onEnd?.()
    return
  }
  const which = accentFor(text, accent ?? defaultAccent)
  // Báo cho nút đang đọc trước đó biết là đã dừng
  current?.finish()
  audio?.pause()
  if (canUseCloud()) speakCloud(text, which, { rate, onStart, onEnd })
  else speakDevice(text, which, { rate, onStart, onEnd })
}

function speakCloud(text, which, options) {
  const el = sharedAudio()
  const entry = { done: false }
  const detach = () => {
    entry.done = true
    el.onended = null
    el.onerror = null
    if (current === entry) current = null
  }
  entry.finish = () => {
    if (entry.done) return
    detach()
    el.pause()
    options.onEnd?.()
  }
  // Giọng Google lỗi (mất mạng, chưa cài khóa…): đọc bằng giọng của máy
  const fallBack = () => {
    if (entry.done || current !== entry) return
    detach()
    if (isSpeechSupported()) speakDevice(text, which, options)
    else options.onEnd?.()
  }
  const play = (url) => {
    if (entry.done || current !== entry) return
    el.onended = entry.finish
    // Không tải được file (vd đã bị xóa trên máy chủ): quên đi để lần sau tạo lại
    el.onerror = () => {
      forgetCloudAudio(text, which)
      fallBack()
    }
    // Đổi src sẽ đặt lại tốc độ về defaultPlaybackRate, nên đặt cả hai
    el.defaultPlaybackRate = options.rate
    el.src = url
    el.playbackRate = options.rate
    el.preservesPitch = true
    el.play().then(() => {
      if (!entry.done) options.onStart?.()
    }, fallBack)
  }
  current = entry
  const ready = readyCloudUrl(text, which)
  if (ready) play(ready)
  else ensureCloudAudio(text, which).then(play, fallBack)
}

function speakDevice(text, which, { rate = 1, onStart, onEnd }) {
  const synth = window.speechSynthesis
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
