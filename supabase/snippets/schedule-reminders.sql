-- Lên lịch gọi Edge Function "send-reminders" mỗi 15 phút (cho thông báo nhắc học).
-- KHÔNG phải migration: thay 2 chỗ <...> rồi chạy trong SQL Editor.
-- Cần bật 2 extension pg_cron và pg_net (Database → Extensions).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-study-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<MÃ-PROJECT>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Muốn dừng: select cron.unschedule('send-study-reminders');
