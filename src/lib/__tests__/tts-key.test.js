import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  audioPath,
  CLOUD_VOICE_PATTERN,
  normalizeSpeechText,
} from '../../../supabase/functions/tts/key.js'
import { cloudVoiceName, CLOUD_VOICES, getCloudVoiceId, getEngine } from '../cloudTts.js'

describe('tên file giọng Google', () => {
  it('gộp khoảng trắng thừa trước khi tính tên file', () => {
    expect(normalizeSpeechText('  What are   you\n doing? ')).toBe('What are you doing?')
    expect(normalizeSpeechText(null)).toBe('')
  })

  it('cùng giọng + cùng câu luôn ra cùng một file, khớp SHA-256', async () => {
    const voice = 'en-US-Chirp3-HD-Aoede'
    const expected = createHash('sha256').update(`${voice}\nGot it.`).digest('hex').slice(0, 40)
    expect(await audioPath(voice, 'Got it.')).toBe(`${voice}/${expected}.mp3`)
    expect(await audioPath(voice, ' Got   it. ')).toBe(`${voice}/${expected}.mp3`)
  })

  it('đổi giọng hoặc đổi câu thì ra file khác', async () => {
    const a = await audioPath('en-US-Chirp3-HD-Aoede', 'Got it.')
    expect(await audioPath('en-GB-Chirp3-HD-Aoede', 'Got it.')).not.toBe(a)
    expect(await audioPath('en-US-Chirp3-HD-Aoede', 'Got it!')).not.toBe(a)
  })

  it('chỉ nhận giọng Chirp 3 HD tiếng Anh Mỹ / Anh', () => {
    expect(CLOUD_VOICE_PATTERN.test('en-US-Chirp3-HD-Charon')).toBe(true)
    expect(CLOUD_VOICE_PATTERN.test('en-GB-Chirp3-HD-Kore')).toBe(true)
    expect(CLOUD_VOICE_PATTERN.test('en-US-Neural2-A')).toBe(false)
    expect(CLOUD_VOICE_PATTERN.test('vi-VN-Chirp3-HD-Aoede')).toBe(false)
    expect(CLOUD_VOICE_PATTERN.test('en-US-Chirp3-HD-../x')).toBe(false)
  })
})

describe('chọn giọng Google', () => {
  it('mặc định dùng giọng Google, giọng Mỹ và Anh là hai người khác nhau', () => {
    expect(getEngine()).toBe('cloud')
    expect(getCloudVoiceId('us')).not.toBe(getCloudVoiceId('uk'))
    expect(cloudVoiceName('us')).toMatch(/^en-US-Chirp3-HD-/)
    expect(cloudVoiceName('uk')).toMatch(/^en-GB-Chirp3-HD-/)
  })

  it('mọi giọng trong danh sách đều tạo ra tên giọng hợp lệ', () => {
    for (const v of CLOUD_VOICES) {
      expect(CLOUD_VOICE_PATTERN.test(`en-US-Chirp3-HD-${v.id}`)).toBe(true)
      expect(CLOUD_VOICE_PATTERN.test(`en-GB-Chirp3-HD-${v.id}`)).toBe(true)
    }
  })
})
