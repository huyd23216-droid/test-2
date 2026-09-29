// Supabase Edge Function: gửi thông báo nhắc học (Web Push).
// Được gọi mỗi 15 phút bởi pg_cron (xem README). Chỉ nhắc 1 lần/ngày vào giờ
// bạn chọn, và KHÔNG nhắc nếu hôm đó bạn đã học.
//
// Secrets cần đặt: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
// Deploy: supabase functions deploy send-reminders --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'
import { dueReminders, pickMessage, studiedOn } from './logic.js'

function serviceKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
    if (keys.default) return keys.default
  } catch {
    // dùng khóa kiểu cũ bên dưới
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
    Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
  )
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey(), {
    auth: { persistSession: false },
  })

  const { data: settings, error } = await supabase
    .from('user_settings')
    .select('user_id, reminder_enabled, reminder_time, timezone, last_reminded_on')
    .eq('reminder_enabled', true)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let sent = 0
  const due = dueReminders(settings ?? [])
  for (const { user_id, date } of due) {
    const { data: sessions } = await supabase
      .from('study_sessions')
      .select('study_date, duration_seconds, activities')
      .eq('user_id', user_id)
      .eq('study_date', date)
    // Đánh dấu đã xử lý hôm nay dù có gửi hay không (tránh nhắc lại)
    await supabase.from('user_settings').update({ last_reminded_on: date }).eq('user_id', user_id)
    if (studiedOn(sessions ?? [], date)) continue

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user_id)
    const payload = JSON.stringify({ title: 'Tiếng Anh Mỗi Ngày', body: pickMessage(), url: '/' })
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
        sent += 1
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        // Thiết bị đã hủy đăng ký → xóa
        if (status === 404 || status === 410) await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        else console.error('Gửi thông báo lỗi', status, err)
      }
    }
  }

  return Response.json({ checked: settings?.length ?? 0, due: due.length, sent })
})
