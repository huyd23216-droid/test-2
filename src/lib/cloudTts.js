// Giọng Google Chirp 3 HD: Edge Function "tts" tạo file MP3 cho từng câu và lưu
// ở Supabase Storage. Web phát file đó; lỗi hay mất mạng thì tts.js tự quay về
// giọng có sẵn của thiết bị.
import { supabase, isSupabaseConfigured } from './supabase.js'
import {
  audioPath,
  CLOUD_VOICE_PATTERN,
  MAX_TTS_CHARS,
  normalizeSpeechText,
  TTS_BUCKET,
} from '../../supabase/functions/tts/key.js'

export const CLOUD_VOICES = [
  { id: 'Aoede', label: 'Aoede (nữ)' },
  { id: 'Kore', label: 'Kore (nữ)' },
  { id: 'Leda', label: 'Leda (nữ)' },
  { id: 'Zephyr', label: 'Zephyr (nữ)' },
  { id: 'Charon', label: 'Charon (nam)' },
  { id: 'Puck', label: 'Puck (nam)' },
  { id: 'Fenrir', label: 'Fenrir (nam)' },
  { id: 'Orus', label: 'Orus (nam)' },
]

// Mỗi giọng Mỹ/Anh một người khác nhau để chế độ xen kẽ nghe rõ sự khác biệt
const DEFAULT_VOICE = { us: 'Aoede', uk: 'Charon' }
const ENGINE_KEY = 'tts-engine'
const voiceKey = (accent) => `tts-cloud-voice:${accent === 'uk' ? 'uk' : 'us'}`

function read(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // bỏ qua nếu trình duyệt chặn localStorage
  }
}

// 'cloud' (giọng Google) hoặc 'device' (giọng của máy). Lưu theo từng thiết bị.
export function getEngine() {
  return read(ENGINE_KEY) === 'device' ? 'device' : 'cloud'
}

export function setEngine(engine) {
  write(ENGINE_KEY, engine === 'device' ? 'device' : 'cloud')
}

export function getCloudVoiceId(accent) {
  const saved = read(voiceKey(accent))
  if (CLOUD_VOICES.some((v) => v.id === saved)) return saved
  return DEFAULT_VOICE[accent === 'uk' ? 'uk' : 'us']
}

export function setCloudVoiceId(accent, id) {
  write(voiceKey(accent), id)
}

export function cloudVoiceName(accent) {
  return `${accent === 'uk' ? 'en-GB' : 'en-US'}-Chirp3-HD-${getCloudVoiceId(accent)}`
}

// Máy chủ báo chưa cài khóa Google: thôi thử cho tới lần mở web sau
let notConfigured = false

export function canUseCloud() {
  return (
    isSupabaseConfigured &&
    getEngine() === 'cloud' &&
    !notConfigured &&
    typeof Audio !== 'undefined' &&
    Boolean(globalThis.crypto?.subtle) &&
    (typeof navigator === 'undefined' || navigator.onLine !== false)
  )
}

// Những file đã có trên máy chủ, nhớ trên thiết bị để lần sau phát thẳng mà
// không phải hỏi lại máy chủ
const KNOWN_KEY = 'tts-known-files'
const KNOWN_LIMIT = 3000
let known = null

function knownFiles() {
  if (!known) {
    try {
      known = new Set(JSON.parse(read(KNOWN_KEY) || '[]'))
    } catch {
      known = new Set()
    }
  }
  return known
}

function saveKnown() {
  const list = [...knownFiles()].slice(-KNOWN_LIMIT)
  write(KNOWN_KEY, JSON.stringify(list))
}

const jobs = new Map() // giọng + câu → Promise<url>
const urls = new Map() // giọng + câu → url đã sẵn sàng

const jobKey = (voice, text) => `${voice}\n${text}`

function publicUrl(path) {
  return supabase.storage.from(TTS_BUCKET).getPublicUrl(path).data.publicUrl
}

// URL file âm thanh nếu đã sẵn sàng (để phát ngay trong lúc bấm, iPhone yêu cầu vậy)
export function readyCloudUrl(text, accent) {
  return urls.get(jobKey(cloudVoiceName(accent), normalizeSpeechText(text))) ?? null
}

// Đảm bảo câu đã có file giọng Google; trả về URL để phát
export function ensureCloudAudio(text, accent) {
  const voice = cloudVoiceName(accent)
  const clean = normalizeSpeechText(text)
  if (!clean || clean.length > MAX_TTS_CHARS || !CLOUD_VOICE_PATTERN.test(voice)) {
    return Promise.reject(new Error('unsupported'))
  }
  const key = jobKey(voice, clean)
  if (!jobs.has(key)) {
    const job = (async () => {
      const path = await audioPath(voice, clean)
      if (!knownFiles().has(path)) {
        // Máy chủ tự kiểm tra: có file rồi thì trả về ngay, chưa có thì tạo bằng Google
        const { data, error } = await supabase.functions.invoke('tts', { body: { text: clean, voice } })
        if (error) {
          if (error.context?.status === 503) notConfigured = true
          throw error
        }
        if (data?.path !== path) throw new Error('path_mismatch')
        knownFiles().add(path)
        saveKnown()
      }
      const url = publicUrl(path)
      urls.set(key, url)
      return url
    })()
    // Lỗi thì lần sau thử lại
    job.catch(() => jobs.delete(key))
    jobs.set(key, job)
  }
  return jobs.get(key)
}

// File phát bị lỗi (vd đã bị xóa trên máy chủ): quên đi để lần sau tạo lại
export function forgetCloudAudio(text, accent) {
  const voice = cloudVoiceName(accent)
  const clean = normalizeSpeechText(text)
  const key = jobKey(voice, clean)
  jobs.delete(key)
  urls.delete(key)
  audioPath(voice, clean)
    .then((path) => {
      if (knownFiles().delete(path)) saveKnown()
    })
    .catch(() => {})
}
