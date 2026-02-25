create table if not exists public.cloud_clipboards (
  code text primary key,
  owner_id uuid references auth.users(id) on delete set null,
  content text not null,
  format text not null check (format in ('markdown', 'latex')),
  created_at timestamptz not null default now()
);

alter table public.cloud_clipboards
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create index if not exists cloud_clipboards_owner_created_idx
  on public.cloud_clipboards(owner_id, created_at desc);

alter table public.cloud_clipboards enable row level security;

-- 后端使用 service role key 访问，匿名用户默认无任何读写权限
revoke all on table public.cloud_clipboards from anon;
revoke all on table public.cloud_clipboards from authenticated;
