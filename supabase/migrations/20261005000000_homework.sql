-- Bài tập về nhà (mục "Bài tập" trong app):
-- 1. homework_progress: tiến độ từng câu, xếp lịch làm lại câu sai kiểu hộp Leitner
-- 2. homework_sessions: mỗi lần làm xong một bài (để biết bài hôm nay đã xong và
--    tính độ chính xác theo dạng bài)

create table public.homework_progress (
  user_id        uuid not null default auth.uid()
                 references auth.users (id) on delete cascade,
  -- "meaning:<id thẻ>", "cloze:<id thẻ>", "spellword:<từ>", "spelling:<tên>",
  -- "numbers:<dạng>" (dạng số chỉ dùng để thống kê, không xếp lịch)
  item_key       text not null,
  kind           text not null
                 check (kind in ('meaning', 'cloze', 'listen-meaning', 'listen-spell', 'order', 'numbers', 'spelling')),
  box            smallint not null default 0 check (box between 0 and 5),
  correct_count  integer not null default 0 check (correct_count >= 0),
  wrong_count    integer not null default 0 check (wrong_count >= 0),
  last_result    text check (last_result in ('correct', 'close', 'wrong')),
  due_on         date, -- ngày làm lại; null = chỉ thống kê
  last_seen_at   timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (user_id, item_key)
);

create trigger homework_progress_set_updated_at
  before update on public.homework_progress
  for each row execute function public.set_updated_at();

create table public.homework_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,
  study_date       date not null,
  mode             text not null check (mode in ('daily', 'extra', 'mistakes', 'type')),
  type             text, -- dạng bài khi mode = 'type'
  total            integer not null default 0 check (total >= 0),
  correct_count    integer not null default 0 check (correct_count >= 0),
  close_count      integer not null default 0 check (close_count >= 0),
  wrong_count      integer not null default 0 check (wrong_count >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  items            jsonb not null default '[]'::jsonb, -- [{ key, type, result }]
  created_at       timestamptz not null default now()
);

create index homework_sessions_user_date on public.homework_sessions (user_id, study_date);

alter table public.homework_progress enable row level security;
alter table public.homework_sessions enable row level security;

create policy "homework_progress: select own" on public.homework_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "homework_progress: insert own" on public.homework_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "homework_progress: update own" on public.homework_progress
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "homework_progress: delete own" on public.homework_progress
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "homework_sessions: select own" on public.homework_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "homework_sessions: insert own" on public.homework_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "homework_sessions: update own" on public.homework_sessions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "homework_sessions: delete own" on public.homework_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.homework_progress, public.homework_sessions from anon;
grant select, insert, update, delete on public.homework_progress, public.homework_sessions to authenticated;
