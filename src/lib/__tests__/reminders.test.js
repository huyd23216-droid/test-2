import { describe, expect, it } from 'vitest'
import { dueReminders, localParts, studiedOn, pickMessage, MESSAGES } from '../../../supabase/functions/send-reminders/logic.js'
import { buildReminderIcs } from '../ics.js'

// 13:05 UTC = 20:05 giờ Việt Nam
const NOW = new Date('2026-09-28T13:05:00Z')

describe('push reminders', () => {
  it('reads local time in the user time zone', () => {
    expect(localParts(NOW, 'Asia/Ho_Chi_Minh')).toEqual({ date: '2026-09-28', minutes: 20 * 60 + 5 })
    expect(localParts(NOW, 'Not/AZone')).toEqual({ date: '2026-09-28', minutes: 20 * 60 + 5 })
  })

  it('reminds once per day inside the window', () => {
    const base = { reminder_enabled: true, timezone: 'Asia/Ho_Chi_Minh', last_reminded_on: null }
    const rows = [
      { ...base, user_id: 'a', reminder_time: '20:00:00' },
      { ...base, user_id: 'b', reminder_time: '20:30' },
      { ...base, user_id: 'c', reminder_time: '18:00' },
      { ...base, user_id: 'd', reminder_time: '20:00', last_reminded_on: '2026-09-28' },
      { ...base, user_id: 'e', reminder_time: '20:00', reminder_enabled: false },
    ]
    expect(dueReminders(rows, NOW)).toEqual([{ user_id: 'a', date: '2026-09-28' }])
  })

  it('skips people who already studied today', () => {
    expect(studiedOn([{ study_date: '2026-09-28', activities: { dictation: 1 } }], '2026-09-28')).toBe(true)
    expect(studiedOn([{ study_date: '2026-09-27', activities: { dictation: 1 } }], '2026-09-28')).toBe(false)
    expect(studiedOn([{ study_date: '2026-09-28', activities: {}, duration_seconds: 20 }], '2026-09-28')).toBe(false)
  })

  it('uses gentle messages only', () => {
    expect(MESSAGES).toContain(pickMessage(3))
    for (const m of MESSAGES) expect(m).not.toMatch(/mất chuỗi|bỏ lỡ|lười|thất bại/i)
  })
})

describe('calendar reminder', () => {
  it('builds a daily iCalendar event with an alarm', () => {
    const ics = buildReminderIcs({ time: '07:30', url: 'https://tieng-anh.vercel.app', now: new Date(2026, 8, 28, 9, 0) })
    expect(ics).toContain('DTSTART:20260929T073000')
    expect(ics).toContain('RRULE:FREQ=DAILY')
    expect(ics).toContain('BEGIN:VALARM')
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    const later = buildReminderIcs({ time: '21:00', now: new Date(2026, 8, 28, 9, 0) })
    expect(later).toContain('DTSTART:20260928T210000')
  })
})
