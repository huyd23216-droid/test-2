-- Danh sách email được vào web ngay (không cần link trong email).
-- Edge Function "email-login" đọc bảng này bằng service role; web và người lạ
-- không đọc được (bật RLS, không có policy, thu hồi quyền của anon/authenticated).
-- Thêm email: Supabase → Table Editor → allowed_emails → Insert row (viết thường).

create table public.allowed_emails (
  email text primary key check (email = lower(email)),
  note text,
  created_at timestamptz not null default now()
);

comment on table public.allowed_emails is
  'Email được đăng nhập nhanh qua Edge Function email-login. Chỉ service role đọc được.';

alter table public.allowed_emails enable row level security;

revoke all on public.allowed_emails from anon, authenticated;
grant select on public.allowed_emails to service_role;
