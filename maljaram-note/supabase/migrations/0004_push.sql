-- 0004: 숙제 알림 (2차 개선, hw-004 · set-002)

alter table public.profiles
  add column notify_homework boolean not null default false,
  add column notify_time     time    not null default '20:00';

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  endpoint   text        not null unique,
  keys       jsonb       not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
create policy push_owner on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
