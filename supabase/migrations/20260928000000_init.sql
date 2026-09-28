-- =====================================================================
-- Tiếng Anh Mỗi Ngày — migration khởi tạo
-- Chạy 1 lần trong Supabase: SQL Editor → dán toàn bộ file → Run
-- (hoặc dùng Supabase CLI: supabase db push)
--
-- Mọi bảng đều bật Row Level Security: mỗi user chỉ đọc/ghi dữ liệu
-- của chính mình (user_id = auth.uid()).
-- =====================================================================

-- Tự cập nhật cột updated_at mỗi khi sửa dòng
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. user_settings: cài đặt của từng user (đồng bộ giữa các thiết bị)
-- ---------------------------------------------------------------------
create table public.user_settings (
  user_id           uuid primary key default auth.uid()
                    references auth.users (id) on delete cascade,
  tts_rate          numeric(3, 2) not null default 1.00
                    check (tts_rate between 0.5 and 2.0),
  new_words_per_day integer not null default 5
                    check (new_words_per_day between 0 and 50),
  -- seed_id của các thẻ khởi đầu mà user đã xóa, để app không nạp lại
  removed_seed_ids  text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2. cards: thẻ từ vựng + trạng thái ôn tập (SM-2)
-- ---------------------------------------------------------------------
create table public.cards (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,
  seed_id          text,                      -- id trong vocabulary.json (null = thẻ tự thêm)
  position         integer not null default 0, -- thứ tự học thẻ mới
  word             text not null check (length(trim(word)) > 0),
  ipa              text not null default '',
  pos              text not null default '',  -- loại từ
  meaning_vi       text not null default '',
  example_en       text not null default '',
  example_vi       text not null default '',
  youglish_query   text,                      -- null = dùng chính từ đó
  -- trạng thái ôn tập
  ease             real not null default 2.5 check (ease >= 1.3),
  interval_days    integer not null default 0 check (interval_days >= 0),
  repetitions      integer not null default 0 check (repetitions >= 0),
  lapses           integer not null default 0 check (lapses >= 0),
  reviews_count    integer not null default 0 check (reviews_count >= 0),
  due_date         date,                      -- null = thẻ mới, chưa học
  introduced_on    date,                      -- ngày học thẻ lần đầu
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, seed_id)
);

create index cards_user_due_idx on public.cards (user_id, due_date);

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. connected_speech_progress: tiến độ từng câu nối âm
-- ---------------------------------------------------------------------
create table public.connected_speech_progress (
  user_id           uuid not null default auth.uid()
                    references auth.users (id) on delete cascade,
  item_id           text not null,             -- id trong connected-speech.json
  attempts          integer not null default 0 check (attempts >= 0),
  correct_count     integer not null default 0 check (correct_count >= 0),
  wrong_count       integer not null default 0 check (wrong_count >= 0),
  last_score        real,                      -- 0..1
  best_score        real,                      -- 0..1
  last_mode         text check (last_mode in ('read', 'listen')),
  last_practiced_at timestamptz,
  primary key (user_id, item_id)
);

-- ---------------------------------------------------------------------
-- 4. clips: "clip thật" từ YouTube do user tự lưu
-- ---------------------------------------------------------------------
create table public.clips (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  title         text not null default '',
  youtube_url   text not null,
  start_seconds integer not null default 0 check (start_seconds >= 0),
  end_seconds   integer check (end_seconds is null or end_seconds >= start_seconds),
  transcript    text not null check (length(trim(transcript)) > 0),
  meaning_vi    text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index clips_user_idx on public.clips (user_id, created_at desc);

create trigger clips_set_updated_at
  before update on public.clips
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. dictation_history: lịch sử từng lần chép chính tả
-- ---------------------------------------------------------------------
create table public.dictation_history (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,
  source           text not null check (source in ('builtin', 'clip')),
  sentence_id      text,                       -- id trong dictation.json (nếu source = builtin)
  clip_id          uuid references public.clips (id) on delete set null,
  level            integer,
  sentence         text not null,              -- câu đúng
  answer           text not null,              -- câu user gõ
  total_words      integer not null check (total_words >= 0),
  correct_words    integer not null check (correct_words >= 0),
  wrong_words      integer not null check (wrong_words >= 0),
  missing_words    integer not null check (missing_words >= 0),
  extra_words      integer not null check (extra_words >= 0),
  score            real not null check (score between 0 and 1),
  replays          integer not null default 0, -- số lần bấm nghe
  rate             real,                       -- tốc độ đọc đã dùng
  duration_seconds integer,                    -- thời gian làm câu này
  created_at       timestamptz not null default now()
);

create index dictation_history_user_idx on public.dictation_history (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 6. study_sessions: mỗi buổi học
-- ---------------------------------------------------------------------
create table public.study_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid()
                   references auth.users (id) on delete cascade,
  study_date       date not null,              -- ngày theo giờ địa phương của user
  kind             text not null default 'free' check (kind in ('daily', 'free')),
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  -- ví dụ: {"vocab_review": 12, "vocab_new": 5, "connected_speech": 1, "dictation": 2}
  activities       jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index study_sessions_user_date_idx on public.study_sessions (user_id, study_date);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.user_settings             enable row level security;
alter table public.cards                     enable row level security;
alter table public.connected_speech_progress enable row level security;
alter table public.clips                     enable row level security;
alter table public.dictation_history         enable row level security;
alter table public.study_sessions            enable row level security;

-- user_settings
create policy "user_settings: select own" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_settings: insert own" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_settings: update own" on public.user_settings
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "user_settings: delete own" on public.user_settings
  for delete to authenticated using ((select auth.uid()) = user_id);

-- cards
create policy "cards: select own" on public.cards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "cards: insert own" on public.cards
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cards: update own" on public.cards
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "cards: delete own" on public.cards
  for delete to authenticated using ((select auth.uid()) = user_id);

-- connected_speech_progress
create policy "cs_progress: select own" on public.connected_speech_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "cs_progress: insert own" on public.connected_speech_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cs_progress: update own" on public.connected_speech_progress
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "cs_progress: delete own" on public.connected_speech_progress
  for delete to authenticated using ((select auth.uid()) = user_id);

-- clips
create policy "clips: select own" on public.clips
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "clips: insert own" on public.clips
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "clips: update own" on public.clips
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "clips: delete own" on public.clips
  for delete to authenticated using ((select auth.uid()) = user_id);

-- dictation_history
create policy "dictation_history: select own" on public.dictation_history
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "dictation_history: insert own" on public.dictation_history
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    -- chỉ được gắn với clip của chính mình
    and (clip_id is null or exists (
      select 1 from public.clips c
      where c.id = clip_id and c.user_id = (select auth.uid())
    ))
  );
create policy "dictation_history: delete own" on public.dictation_history
  for delete to authenticated using ((select auth.uid()) = user_id);

-- study_sessions
create policy "study_sessions: select own" on public.study_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "study_sessions: insert own" on public.study_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "study_sessions: update own" on public.study_sessions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "study_sessions: delete own" on public.study_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Quyền truy cập qua Data API: chỉ user đã đăng nhập, không cho anon
revoke all on public.user_settings, public.cards, public.connected_speech_progress,
  public.clips, public.dictation_history, public.study_sessions from anon;
grant select, insert, update, delete on public.user_settings, public.cards,
  public.connected_speech_progress, public.clips, public.study_sessions to authenticated;
grant select, insert, delete on public.dictation_history to authenticated;
