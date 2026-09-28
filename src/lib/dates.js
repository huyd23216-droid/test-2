// Mọi "ngày" trong app là chuỗi YYYY-MM-DD theo giờ địa phương của thiết bị.

const pad = (n) => String(n).padStart(2, '0')

export function toDateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayString(now = new Date()) {
  return toDateString(now)
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(str, days) {
  const d = parseDate(str)
  d.setDate(d.getDate() + days)
  return toDateString(d)
}

// Thứ Hai của tuần chứa ngày str
export function mondayOf(str) {
  const d = parseDate(str)
  const offset = (d.getDay() + 6) % 7 // Thứ Hai = 0 ... Chủ nhật = 6
  d.setDate(d.getDate() - offset)
  return toDateString(d)
}

export function daysBetween(fromStr, toStr) {
  const ms = parseDate(toStr) - parseDate(fromStr)
  return Math.round(ms / 86400000)
}

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

export function formatLongDate(date = new Date()) {
  return `${WEEKDAYS[date.getDay()]}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`
}

export function formatDateTime(iso) {
  const d = new Date(iso)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// "hôm nay", "ngày mai", "3 ngày nữa"...
export function describeInterval(days) {
  if (days <= 0) return 'hôm nay'
  if (days === 1) return '1 ngày'
  if (days < 30) return `${days} ngày`
  if (days < 365) return `${Math.round(days / 30)} tháng`
  return `${Math.round(days / 365)} năm`
}

export function describeDue(dueDate, today) {
  const diff = daysBetween(today, dueDate)
  if (diff <= 0) return 'đến hạn hôm nay'
  if (diff === 1) return 'ôn lại ngày mai'
  return `ôn lại sau ${describeInterval(diff)}`
}

// 83 -> "1:23"
export function formatSeconds(total) {
  const s = Math.max(0, Math.round(total || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

// "1:23", "01:02:03", "83" -> số giây; chuỗi rỗng -> null; sai định dạng -> NaN
export function parseTimestamp(input) {
  const str = String(input ?? '').trim()
  if (!str) return null
  if (!/^\d+(:\d{1,2}){0,2}$/.test(str)) return NaN
  return str.split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0)
}
