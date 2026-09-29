// Logic chọn người cần nhắc học (JS thuần: dùng chung cho Edge Function và unit test).

// Nhắc trong khoảng này sau giờ đã hẹn (cron chạy mỗi 15 phút, có thể trễ)
export const WINDOW_MINUTES = 60

export const MESSAGES = [
  'Dành 10 phút cho tiếng Anh hôm nay nhé 🌱',
  'Một buổi học ngắn thôi cũng đủ giữ nhịp rồi.',
  'Tai bạn đang quen dần với tiếng Anh. Nghe thêm một chút nhé 🎧',
  'Vài thẻ từ vựng đang chờ bạn ghé thăm.',
  'Học một chút rồi nghỉ ngơi thật thoải mái nhé.',
]

// Ngày và giờ địa phương theo múi giờ của user
export function localParts(now, timeZone) {
  let parts
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now)
  } catch {
    return localParts(now, 'Asia/Ho_Chi_Minh')
  }
  const get = (type) => parts.find((p) => p.type === type)?.value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

const toMinutes = (time) => {
  const [h, m] = String(time ?? '20:00').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// settings: các dòng user_settings có reminder_enabled = true
// Trả về [{ user_id, date }] cần nhắc lúc này (mỗi người tối đa 1 lần/ngày)
export function dueReminders(settings, now = new Date()) {
  const out = []
  for (const s of settings) {
    if (!s.reminder_enabled) continue
    const { date, minutes } = localParts(now, s.timezone || 'Asia/Ho_Chi_Minh')
    const target = toMinutes(s.reminder_time)
    if (s.last_reminded_on === date) continue
    if (minutes >= target && minutes < target + WINDOW_MINUTES) out.push({ user_id: s.user_id, date })
  }
  return out
}

// Hôm đó đã học rồi thì không nhắc
export function studiedOn(sessions, date) {
  return sessions.some((s) => {
    if (s.study_date !== date) return false
    const count = Object.values(s.activities ?? {}).reduce((a, b) => a + (Number(b) || 0), 0)
    return count > 0 || (s.duration_seconds ?? 0) >= 60
  })
}

export function pickMessage(seed = Date.now()) {
  return MESSAGES[Math.abs(Math.floor(seed)) % MESSAGES.length]
}
