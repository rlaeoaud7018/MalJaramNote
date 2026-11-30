-- 0002: 행 수준 보안 (sec-002). 본인 데이터만 보이고, 타인 리소스는 없는 것처럼 404가 된다

alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.sessions enable row level security;
alter table public.session_summaries enable row level security;
alter table public.homework enable row level security;
alter table public.event_logs enable row level security;

create policy profiles_owner on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy children_owner on public.children
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy sessions_owner on public.sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 요약은 user_id가 없어 회기 소유자로 판정
create policy summaries_owner on public.session_summaries
  for all using (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()));

create policy homework_owner on public.homework
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy event_logs_owner on public.event_logs
  for insert with check (user_id = auth.uid());

-- 음성 파일: 본인 폴더만 (audio 버킷 안의 {userId}/{sessionId}.{ext})
create policy audio_owner on storage.objects
  for all using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
