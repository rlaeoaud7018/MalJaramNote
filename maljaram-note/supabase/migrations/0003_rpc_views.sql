-- 0003: 요약 저장·수정 트랜잭션(RPC)과 지표 뷰
-- RPC는 security invoker라 호출한 사용자의 RLS가 그대로 적용된다

-- FNC-P-004: 요약과 숙제를 한 번에 저장. 재처리하면 기존 요약·숙제를 교체한다
create function public.save_summary(p_session_id uuid, p_summary jsonb, p_model text, p_prompt text)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_user uuid;
begin
  select user_id into v_user from sessions where id = p_session_id;
  if v_user is null then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  delete from homework where session_id = p_session_id;
  insert into session_summaries (session_id, activities, child_response, next_goal, edited, model_version, prompt_version)
  values (p_session_id, coalesce(p_summary -> 'activities', '[]'), p_summary ->> 'child_response',
          p_summary ->> 'next_goal', false, p_model, p_prompt)
  on conflict (session_id) do update
    set activities = excluded.activities, child_response = excluded.child_response,
        next_goal = excluded.next_goal, edited = false,
        model_version = excluded.model_version, prompt_version = excluded.prompt_version;

  insert into homework (session_id, user_id, content, frequency, sort_order)
  select p_session_id, v_user, h.value ->> 'content', nullif(h.value ->> 'frequency', ''), (h.ordinality - 1)::smallint
  from jsonb_array_elements(coalesce(p_summary -> 'homework', '[]')) with ordinality as h(value, ordinality);
end $$;

-- FNC-A-013: 요약 섹션 수정 + 숙제 upsert + 빠진 숙제 delete. 실패하면 전부 롤백
create function public.update_summary(p_session_id uuid, p_payload jsonb)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_user uuid;
  v_keep uuid[];
  h record;
begin
  select user_id into v_user from sessions where id = p_session_id;
  if v_user is null then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  update session_summaries
     set activities = coalesce(p_payload -> 'activities', '[]'),
         child_response = p_payload ->> 'childResponse',
         next_goal = p_payload ->> 'nextGoal',
         edited = true
   where session_id = p_session_id;
  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(array_agg((x ->> 'id')::uuid), '{}') into v_keep
    from jsonb_array_elements(coalesce(p_payload -> 'homework', '[]')) x
   where x ? 'id';
  delete from homework where session_id = p_session_id and not (id = any (v_keep));

  for h in select value, ordinality from jsonb_array_elements(coalesce(p_payload -> 'homework', '[]')) with ordinality loop
    if h.value ? 'id' then
      update homework set content = h.value ->> 'content', frequency = nullif(h.value ->> 'frequency', ''),
                          sort_order = (h.ordinality - 1)::smallint
       where id = (h.value ->> 'id')::uuid and session_id = p_session_id;
    else
      insert into homework (session_id, user_id, content, frequency, sort_order)
      values (p_session_id, v_user, h.value ->> 'content', nullif(h.value ->> 'frequency', ''), (h.ordinality - 1)::smallint);
    end if;
  end loop;
end $$;

-- FNC-O-002: 일별 지표 (관리자가 SQL 편집기에서 조회. 테스트 계정은 metrics_excluded_users에 넣어 제외)
create table public.metrics_excluded_users (user_id uuid primary key);
alter table public.metrics_excluded_users enable row level security;

create view public.v_metrics_daily with (security_invoker = true) as
with s as (
  select (created_at at time zone 'Asia/Seoul')::date as day, id, status,
         extract(epoch from processing_done_at - processing_started_at) as proc_sec
    from sessions
   where user_id not in (select user_id from metrics_excluded_users)
)
select s.day,
       count(*)                                                     as sessions,
       count(*) filter (where s.status = 'DONE')                    as done,
       round(avg(ss.edited::int) filter (where ss.id is not null) * 100, 1) as summary_edit_pct,
       round(avg(s.proc_sec) filter (where s.status = 'DONE'), 1)   as avg_processing_sec,
       (select count(*) from event_logs e
         where e.event_name = 'recording_failed'
           and (e.created_at at time zone 'Asia/Seoul')::date = s.day) as recording_failed,
       (select round(avg(h.is_done::int) * 100, 1) from homework h
          join sessions hs on hs.id = h.session_id
         where (hs.created_at at time zone 'Asia/Seoul')::date = s.day) as homework_done_pct
  from s
  left join session_summaries ss on ss.session_id = s.id
 group by s.day
 order by s.day;

create view public.v_metrics_by_prompt with (security_invoker = true) as
select ss.prompt_version,
       count(*)                                   as summaries,
       round(avg(ss.edited::int) * 100, 1)        as summary_edit_pct
  from session_summaries ss
  join sessions s on s.id = ss.session_id
 where s.user_id not in (select user_id from metrics_excluded_users)
 group by ss.prompt_version
 order by ss.prompt_version;
