-- Bài tập được giao (giáo viên hoặc Claude thêm vào) và nhật ký ôn thẻ.
-- 1. homework_sets: mỗi bộ bài tập, các câu nằm trong cột items (jsonb)
-- 2. homework_answers: mỗi lần trả lời một câu (kể cả khi ôn lại câu sai)
-- 3. review_log: mỗi lần chấm một thẻ từ vựng (thẻ mới hoặc thẻ ôn)
-- Không sửa bảng cũ nào.

-- ---------- 1. homework_sets ----------
-- items = mảng [{ id, type, prompt, options?, answer?, accept?, explain_vi }]
--   type 'mcq'  : chọn một trong options, đúng khi bằng answer
--   type 'gap'  : gõ vào chỗ ___ trong prompt, đúng khi khớp answer hoặc một giá trị trong accept
--   type 'fix'  : prompt là câu sai, gõ lại câu đúng (so như 'gap')
--   type 'write': viết tự do, không chấm tự động (giáo viên nhận xét sau)
create table public.homework_sets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  title           text not null,
  tag             text,              -- vd 'Unit 10' hoặc 'Sổ lỗi'
  instructions_vi text,
  items           jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  due_on          date,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index homework_sets_user_id_idx on public.homework_sets (user_id, completed_at, due_on);

-- ---------- 2. homework_answers ----------
create table public.homework_answers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  set_id      uuid not null references public.homework_sets (id) on delete cascade,
  item_id     text not null,
  answer      text,
  is_correct  boolean,               -- null với câu 'write' (chờ nhận xét)
  feedback_vi text,                  -- nhận xét của giáo viên cho câu 'write'
  next_due    date,                  -- ôn câu sai: hôm sau → +3 → +7 → xong (null)
  created_at  timestamptz not null default now()
);

create index homework_answers_set_idx on public.homework_answers (user_id, set_id, item_id, created_at);
create index homework_answers_set_id_idx on public.homework_answers (set_id); -- cho khóa ngoại (xóa theo bộ bài)
create index homework_answers_due_idx on public.homework_answers (user_id, next_due) where next_due is not null;

-- ---------- 3. review_log ----------
create table public.review_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  card_id     uuid not null references public.cards (id) on delete cascade,
  rating      text not null check (rating in ('again', 'hard', 'good', 'easy')),
  was_due     boolean not null default false,
  reviewed_at timestamptz not null default now()
);

create index review_log_user_time_idx on public.review_log (user_id, reviewed_at);
create index review_log_card_idx on public.review_log (card_id);

-- ---------- Row Level Security ----------
alter table public.homework_sets    enable row level security;
alter table public.homework_answers enable row level security;
alter table public.review_log       enable row level security;

create policy "homework_sets: select own" on public.homework_sets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "homework_sets: insert own" on public.homework_sets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "homework_sets: update own" on public.homework_sets
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "homework_sets: delete own" on public.homework_sets
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Câu trả lời chỉ được gắn vào bộ bài tập của chính mình
create policy "homework_answers: select own" on public.homework_answers
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "homework_answers: insert own" on public.homework_answers
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.homework_sets s
      where s.id = set_id and s.user_id = (select auth.uid())
    )
  );
create policy "homework_answers: update own" on public.homework_answers
  for update to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.homework_sets s
      where s.id = set_id and s.user_id = (select auth.uid())
    )
  );
create policy "homework_answers: delete own" on public.homework_answers
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Nhật ký ôn chỉ được ghi cho thẻ của chính mình
create policy "review_log: select own" on public.review_log
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "review_log: insert own" on public.review_log
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.cards c
      where c.id = card_id and c.user_id = (select auth.uid())
    )
  );
create policy "review_log: update own" on public.review_log
  for update to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.cards c
      where c.id = card_id and c.user_id = (select auth.uid())
    )
  );
create policy "review_log: delete own" on public.review_log
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.homework_sets, public.homework_answers, public.review_log from anon;
grant select, insert, update, delete
  on public.homework_sets, public.homework_answers, public.review_log
  to authenticated;
