// Supabase Edge Function: tạo giọng đọc Google Chirp 3 HD cho một câu và lưu
// file MP3 vào Supabase Storage (bucket "tts-cache"). Câu nào đã có file thì
// trả về luôn, không gọi Google nữa, nên gần như không tốn phí.
//
// Chỉ người đã đăng nhập mới gọi được (kiểm tra token trong hàm).
// Secret cần đặt: GOOGLE_TTS_API_KEY (API key Google Cloud, bật Text-to-Speech API)
// Deploy: supabase functions deploy tts --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2'
import { audioPath, CLOUD_VOICE_PATTERN, MAX_TTS_CHARS, normalizeSpeechText, TTS_BUCKET } from './key.js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: cors })

function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default ?? ''
  } catch {
    return ''
  }
}

const KEY_NAME = 'GOOGLE_TTS_API_KEY'

// Chấp nhận cả khi tên secret bị gõ lệch (thừa khoảng trắng, chữ thường)
function googleKey(): string {
  const direct = Deno.env.get(KEY_NAME)?.trim()
  if (direct) return direct
  for (const [name, value] of Object.entries(Deno.env.toObject())) {
    if (name.trim().toUpperCase() === KEY_NAME && value.trim()) return value.trim()
  }
  return ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' })

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } }
  if (!auth.user) return reply(401, { error: 'unauthorized' })

  const apiKey = googleKey()
  if (!apiKey) {
    // Chỉ báo TÊN các secret có vẻ liên quan (không bao giờ trả về giá trị) để dễ sửa
    const similar = Object.keys(Deno.env.toObject()).filter((n) => /google|tts|api_?key/i.test(n))
    return reply(503, { error: 'not_configured', expected: KEY_NAME, similar })
  }

  let text = ''
  let voice = ''
  try {
    const body = await req.json()
    text = normalizeSpeechText(body?.text)
    voice = String(body?.voice ?? '')
  } catch {
    // body không phải JSON
  }
  if (!text || text.length > MAX_TTS_CHARS) return reply(400, { error: 'bad_text' })
  if (!CLOUD_VOICE_PATTERN.test(voice)) return reply(400, { error: 'bad_voice' })

  const path = await audioPath(voice, text)
  const storage = admin.storage.from(TTS_BUCKET)
  const cached = await fetch(storage.getPublicUrl(path).data.publicUrl, { method: 'HEAD' })
  if (cached.ok) return reply(200, { path, cached: true })

  const google = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: voice.slice(0, 5), name: voice },
      audioConfig: { audioEncoding: 'MP3' },
    }),
  })
  if (!google.ok) {
    console.error('Google TTS error', google.status, (await google.text()).slice(0, 500))
    return reply(502, { error: 'tts_failed', status: google.status })
  }

  const { audioContent } = await google.json()
  const bytes = Uint8Array.from(atob(audioContent), (c) => c.charCodeAt(0))
  const { error } = await storage.upload(path, bytes, {
    contentType: 'audio/mpeg',
    cacheControl: '31536000',
    upsert: true,
  })
  if (error) {
    console.error('Storage upload error', error.message)
    return reply(500, { error: 'store_failed' })
  }
  return reply(200, { path, cached: false })
})
