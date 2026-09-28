// Tạo file lịch (.ics) với lời nhắc học hằng ngày: mở trên Mac/iPhone/Google
// Calendar là thêm được ngay, không cần cấu hình máy chủ.
import { addDays, todayString } from './dates.js'

const escapeText = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')

// Dòng dài hơn 75 byte phải gập lại (theo chuẩn iCalendar), tính theo UTF-8
function fold(line) {
  const enc = new TextEncoder()
  const out = []
  let current = ''
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74
    if (enc.encode(current + ch).length > limit) {
      out.push(current)
      current = ch
    } else {
      current += ch
    }
  }
  out.push(current)
  return out.join('\r\n ')
}

const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

// time: "HH:MM" (giờ địa phương trên thiết bị của bạn)
export function buildReminderIcs({ time = '20:00', url = '', now = new Date() } = {}) {
  const [h, m] = time.split(':').map((x) => x.padStart(2, '0'))
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const startDay = Number(h) * 60 + Number(m) > nowMinutes ? todayString(now) : addDays(todayString(now), 1)
  const dtstart = `${startDay.replace(/-/g, '')}T${h}${m}00`
  const description = `Dành 10 phút cho tiếng Anh: ôn thẻ, nghe nối âm, chép chính tả.${url ? `\n${url}` : ''}`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tieng Anh Moi Ngay//VI',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:tieng-anh-moi-ngay-reminder-${h}${m}@tieng-anh-moi-ngay`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${dtstart}`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${escapeText('Học tiếng Anh 10 phút 🌱')}`,
    `DESCRIPTION:${escapeText(description)}`,
    ...(url ? [`URL:${url}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText('Học tiếng Anh 10 phút 🌱')}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}
