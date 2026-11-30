-- 0001: 기본 테이블 (14 DB 설계 · 테이블 명세서)

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  nickname          varchar(30),
  auto_delete_audio boolean     not null default true,
  created_at        timestamptz not null default now()
);

create table public.children (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles (id) on delete cascade,
  nickname     varchar(30) not null,
  birth_month  date,
  therapy_type varchar(20) not null default 'SPEECH'
               check (therapy_type in ('SPEECH', 'PLAY', 'SENSORY', 'ETC')),
  center_name  varchar(50),
  created_at   timestamptz not null default now()
);

create table public.sessions (
  id                    uuid primary key default gen_random_uuid(),
  child_id              uuid        not null references public.children (id) on delete cascade,
  user_id               uuid        not null references public.profiles (id) on delete cascade,
  session_date          date        not null default current_date,
  status                varchar(20) not null default 'UPLOADED'
                        check (status in ('UPLOADED', 'TRANSCRIBING', 'SUMMARIZING', 'DONE', 'FAILED')),
  consent_confirmed     boolean     not null default false,
  audio_path            text,
  duration_sec          integer,
  transcript            text,
  error_message         text,
  processing_started_at timestamptz,
  processing_done_at    timestamptz,
  audio_deleted_at      timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- 동의 없는 회기는 저장 자체가 불가 (rec-001)
  constraint consent_required check (consent_confirmed)
);
create index sessions_timeline_idx on public.sessions (child_id, session_date desc, created_at desc);

create table public.session_summaries (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid        not null unique references public.sessions (id) on delete cascade,
  activities     jsonb       not null default '[]',
  child_response text,
  next_goal      text,
  edited         boolean     not null default false,
  model_version  varchar(50) not null,
  prompt_version varchar(20) not null default 'v1',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.homework (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid         not null references public.sessions (id) on delete cascade,
  user_id    uuid         not null references public.profiles (id) on delete cascade,
  content    varchar(200) not null,
  frequency  varchar(50),
  is_done    boolean      not null default false,
  done_at    timestamptz,
  sort_order smallint     not null default 0,
  created_at timestamptz  not null default now()
);
create index homework_progress_idx on public.homework (user_id, is_done);

create table public.event_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  event_name varchar(50) not null,
  props      jsonb       not null default '{}',
  created_at timestamptz not null default now()
);
create index event_logs_metric_idx on public.event_logs (event_name, created_at);

-- updated_at 자동 갱신
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger sessions_touch before update on public.sessions
  for each row execute function public.touch_updated_at();
create trigger session_summaries_touch before update on public.session_summaries
  for each row execute function public.touch_updated_at();

-- 최초 로그인 시 회원 행 생성 (auth-001). 카카오 닉네임만 저장
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'nickname'), 30))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 음성 원본 버킷 (비공개, 25MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', false, 26214400,
        array['audio/webm', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/mpeg'])
on conflict (id) do nothing;
