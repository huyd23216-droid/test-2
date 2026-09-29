-- =====================================================================
-- Tiếng Anh Mỗi Ngày — migration 2: các tính năng mở rộng
-- Chạy SAU file 20260928000000_init.sql (SQL Editor → dán → Run,
-- hoặc `supabase db push`).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. FSRS: trạng thái trí nhớ của từng thẻ
--    (thẻ đang học dở theo SM-2 sẽ được app tự chuyển đổi ở lần ôn tới)
-- ---------------------------------------------------------------------
alter table public.cards
  add column stability  real check (stability is null or stability > 0),
  add column difficulty real check (difficulty is null or difficulty between 1 and 10);

-- ---------------------------------------------------------------------
-- 2. Cài đặt mới
-- ---------------------------------------------------------------------
alter table public.user_settings
  -- Tỷ lệ nhớ mong muốn cho FSRS (0.9 = khi đến hạn ôn, bạn còn nhớ ~90%)
  add column desired_retention numeric(3, 2) not null default 0.90
    check (desired_retention between 0.70 and 0.97),
  -- Giọng đọc: Mỹ, Anh hoặc xen kẽ
  add column accent text not null default 'us' check (accent in ('us', 'uk', 'mixed')),
  -- Các bộ từ vựng IELTS đã bật (id trong src/data/ielts-sets.json)
  add column enabled_sets text[] not null default '{}',
  -- Nhắc học (mặc định tắt)
  add column reminder_enabled boolean not null default false,
  add column reminder_time time not null default '20:00',
  add column timezone text not null default 'Asia/Ho_Chi_Minh',
  add column last_reminded_on date;

-- ---------------------------------------------------------------------
-- 3. listening_progress: tiến độ bài điền từ và bài phân biệt âm
-- ---------------------------------------------------------------------
create table public.listening_progress (
  user_id           uuid not null default auth.uid()
                    references auth.users (id) on delete cascade,
  item_id           text not null, -- "gap:<id câu>" hoặc "drill:<id bài>"
  kind              text not null check (kind in ('gapfill', 'drill')),
  attempts          integer not null default 0 check (attempts >= 0),
  correct_count     integer not null default 0 check (correct_count >= 0),
  wrong_count       integer not null default 0 check (wrong_count >= 0),
  last_score        real,
  last_practiced_at timestamptz,
  primary key (user_id, item_id)
);

-- ---------------------------------------------------------------------
-- 4. push_subscriptions: thiết bị nhận thông báo nhắc học
-- ---------------------------------------------------------------------
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
             references auth.users (id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.listening_progress enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "listening_progress: select own" on public.listening_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "listening_progress: insert own" on public.listening_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "listening_progress: update own" on public.listening_progress
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "listening_progress: delete own" on public.listening_progress
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "push_subscriptions: select own" on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "push_subscriptions: insert own" on public.push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "push_subscriptions: update own" on public.push_subscriptions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "push_subscriptions: delete own" on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.listening_progress, public.push_subscriptions from anon;
grant select, insert, update, delete on public.listening_progress, public.push_subscriptions to authenticated;

-- Hàng đợi offline gửi lại bằng upsert (an toàn khi gửi trùng), và khôi phục
-- từ file sao lưu cũng ghi lại lịch sử chính tả theo id → cần quyền update
grant update on public.dictation_history to authenticated;
create policy "dictation_history: update own" on public.dictation_history
  for update to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (clip_id is null or exists (
      select 1 from public.clips c
      where c.id = clip_id and c.user_id = (select auth.uid())
    ))
  );
