begin;

create table public.center_teacher_runs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  actor_id uuid not null references public.profiles(id),
  conversation_id uuid not null references public.center_conversations(id),
  request_key text not null,
  message text not null,
  status text not null default 'running' check (status in ('running','completed','failed','stopped')),
  stage text not null default 'loading_context' check (stage in ('loading_context','reading_materials','thinking','saving','completed','failed','stopped')),
  lease_token uuid not null default gen_random_uuid(),
  lease_until timestamptz not null default (now() + interval '90 seconds'),
  error_code text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  attempt integer not null default 1,
  unique (club_id, actor_id, request_key)
);
create index center_teacher_runs_conversation_idx on public.center_teacher_runs(conversation_id, updated_at desc);
create table public.center_teacher_stop_requests (
  club_id uuid not null references public.clubs(id), actor_id uuid not null references public.profiles(id),
  request_key text not null, created_at timestamptz not null default now(), primary key (club_id, actor_id, request_key)
);
alter table public.center_teacher_stop_requests enable row level security;
-- Stop tombstones are accessible only through the scoped SECURITY DEFINER controls.
create policy center_teacher_stop_requests_deny_direct on public.center_teacher_stop_requests
  for all to authenticated using (false) with check (false);
revoke all on public.center_teacher_stop_requests from anon, authenticated;
grant all on public.center_teacher_stop_requests to service_role;
alter table public.center_teacher_runs enable row level security;
revoke all on public.center_teacher_runs from anon, authenticated;
grant all on public.center_teacher_runs to service_role;
grant select on public.center_teacher_runs to authenticated;
create policy center_teacher_runs_read on public.center_teacher_runs for select to authenticated
  using (actor_id = auth.uid() and private.center_can_work(club_id, auth.uid()));

create or replace function public.center_teacher_run_start(
  p_club_id uuid, p_conversation_id uuid, p_request_key text, p_message text
) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare actor uuid := auth.uid(); r public.center_teacher_runs; token uuid := gen_random_uuid();
begin
  if not coalesce(private.center_can_work(p_club_id, actor), false) then raise exception 'Forbidden' using errcode='42501'; end if;
  if length(trim(p_request_key)) not between 8 and 200 or length(trim(p_message)) not between 1 and 10000 then raise exception 'Invalid teacher run'; end if;
  if not exists(select 1 from public.center_conversations c where c.id=p_conversation_id and c.club_id=p_club_id and c.actor_id=actor) then raise exception 'Conversation not accessible' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text || p_club_id::text || p_request_key, 1));
  if exists(select 1 from public.center_teacher_stop_requests where club_id=p_club_id and actor_id=actor and request_key=p_request_key) then
    insert into public.center_teacher_runs(club_id,actor_id,conversation_id,request_key,message,status,stage,error_code,lease_until) values(p_club_id,actor,p_conversation_id,p_request_key,p_message,'stopped','stopped','stopped',now()) on conflict (club_id,actor_id,request_key) do nothing returning * into r;
    if not found then select * into r from public.center_teacher_runs where club_id=p_club_id and actor_id=actor and request_key=p_request_key; end if;
    return jsonb_build_object('run',to_jsonb(r),'leaseToken',r.lease_token,'completed',true);
  end if;
  select * into r from public.center_teacher_runs where club_id=p_club_id and actor_id=actor and request_key=p_request_key for update;
  if found then
    if r.message <> p_message then raise exception 'Request key reused'; end if;
    if r.status='completed' then
      return jsonb_build_object('run',to_jsonb(r),'leaseToken',r.lease_token,'completed',true);
    end if;
    if r.status='running' and r.lease_until > now() then raise exception 'Teacher run already in progress' using errcode='55P03'; end if;
    update public.center_teacher_runs set status='running', stage='loading_context', lease_token=token, lease_until=now()+interval '90 seconds', error_code=null, started_at=now(), updated_at=now(), attempt=attempt+1 where id=r.id returning * into r;
  else
    insert into public.center_teacher_runs(club_id,actor_id,conversation_id,request_key,message,lease_token) values(p_club_id,actor,p_conversation_id,p_request_key,p_message,token) returning * into r;
  end if;
  return jsonb_build_object('run',to_jsonb(r),'leaseToken',r.lease_token,'completed',false);
end $$;

create or replace function public.center_teacher_run_active(p_club_id uuid,p_request_key text,p_lease_token uuid) returns boolean language sql security definer stable set search_path=public,private as $$
 select coalesce(private.center_can_work(p_club_id,auth.uid()),false) and exists(select 1 from public.center_teacher_runs where club_id=p_club_id and actor_id=auth.uid() and request_key=p_request_key and lease_token=p_lease_token and status='running' and lease_until>now())
$$;

create or replace function public.center_teacher_run_stage(p_club_id uuid,p_request_key text,p_lease_token uuid,p_stage text) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare r public.center_teacher_runs;
begin
  if p_stage not in ('loading_context','reading_materials','thinking','saving','completed','failed','stopped') then raise exception 'Invalid teacher run stage'; end if;
  if not coalesce(private.center_can_work(p_club_id,auth.uid()),false) then raise exception 'Forbidden' using errcode='42501'; end if;
  update public.center_teacher_runs set stage=p_stage, updated_at=now() where club_id=p_club_id and actor_id=auth.uid() and request_key=p_request_key and lease_token=p_lease_token and status='running' and lease_until>now() returning * into r;
  if not found then raise exception 'Teacher run is no longer active' using errcode='40001'; end if;
  return to_jsonb(r);
end $$;

create or replace function public.center_teacher_run_finish(p_club_id uuid,p_request_key text,p_lease_token uuid,p_status text,p_error_code text default null) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare r public.center_teacher_runs;
begin
  if p_status not in ('completed','failed','stopped') then raise exception 'Invalid teacher run status'; end if;
  if not coalesce(private.center_can_work(p_club_id,auth.uid()),false) then raise exception 'Forbidden' using errcode='42501'; end if;
  update public.center_teacher_runs set status=p_status, stage=p_status, error_code=p_error_code, updated_at=now(), lease_until=now() where club_id=p_club_id and actor_id=auth.uid() and request_key=p_request_key and lease_token=p_lease_token and status='running' returning * into r;
  if not found then raise exception 'Teacher run is no longer active' using errcode='40001'; end if;
  return to_jsonb(r);
end $$;

create or replace function public.center_teacher_stop(p_club_id uuid,p_request_key text) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare r public.center_teacher_runs;
begin
  if not coalesce(private.center_can_work(p_club_id,auth.uid()),false) then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_request_key is null or length(p_request_key) not between 8 and 200 then raise exception 'Invalid request key'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_club_id::text || p_request_key, 1));
  insert into public.center_teacher_stop_requests(club_id,actor_id,request_key) values(p_club_id,auth.uid(),p_request_key) on conflict do nothing;
  update public.center_teacher_runs set status='stopped', stage='stopped', error_code='stopped', updated_at=now(), lease_until=now() where club_id=p_club_id and actor_id=auth.uid() and request_key=p_request_key and status='running' returning * into r;
  if not found then return jsonb_build_object('stopped',true); end if;
  return to_jsonb(r);
end $$;

create or replace function public.center_teacher_run(p_club_id uuid,p_request_key text) returns jsonb language sql security definer stable set search_path=public,private as $$
 select jsonb_build_object('requestKey',r.request_key,'conversationId',r.conversation_id,'status',case when r.status='running' and r.lease_until<=now() then 'failed' else r.status end,'stage',case when r.status='running' and r.lease_until<=now() then 'failed' else r.stage end,'startedAt',r.started_at,'updatedAt',r.updated_at,'errorCode',case when r.status='running' and r.lease_until<=now() then 'timeout' else r.error_code end) from public.center_teacher_runs r where r.club_id=p_club_id and r.actor_id=auth.uid() and r.request_key=p_request_key and private.center_can_work(p_club_id,auth.uid())
$$;

create or replace function public.center_teacher_conversations(p_club_id uuid) returns jsonb language sql security definer stable set search_path=public,private as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'updatedAt',c.updated_at,'status',case when r.status='running' and r.lease_until<=now() then 'failed' else coalesce(r.status,'idle') end) order by c.updated_at desc),'[]'::jsonb)
 from public.center_conversations c left join lateral (select status, lease_until from public.center_teacher_runs x where x.conversation_id=c.id order by x.started_at desc limit 1) r on true
 where c.club_id=p_club_id and c.actor_id=auth.uid() and private.center_can_work(p_club_id,auth.uid())
$$;

create or replace function public.center_teacher_proposal_failure(p_club_id uuid,p_proposal_id uuid,p_error_code text default 'automatic_failed') returns jsonb language sql security definer set search_path=public,private as $$
 update public.center_proposals set status='failed', receipt=null where id=p_proposal_id and club_id=p_club_id and actor_id=auth.uid() and status='pending' and private.center_can_work(p_club_id,auth.uid()) returning jsonb_build_object('id',id,'status',status,'receipt',receipt)
$$;

create or replace function public.center_teacher_chat_complete(p_club_id uuid,p_conversation_id uuid,p_answer text,p_sources jsonb,p_actions jsonb,p_request_key text,p_lease_token uuid) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare r public.center_teacher_runs; result jsonb;
begin
  select * into r from public.center_teacher_runs where club_id=p_club_id and actor_id=auth.uid() and request_key=p_request_key and lease_token=p_lease_token and status='running' and lease_until>now() for update;
  if not found or not coalesce(private.center_can_work(p_club_id,auth.uid()),false) then raise exception 'Teacher run is no longer active' using errcode='40001'; end if;
  if r.conversation_id <> p_conversation_id then raise exception 'Conversation mismatch' using errcode='42501'; end if;
  result := public.center_chat_complete(p_club_id,p_conversation_id,p_answer,p_sources,p_actions,p_request_key);
  return result;
end $$;

create or replace function public.center_teacher_decide_proposal(p_club_id uuid,p_proposal_id uuid,p_decision text,p_request_key text,p_lease_token uuid) returns jsonb language plpgsql security definer set search_path=public,private as $$
declare r public.center_teacher_runs; result jsonb;
begin
  select * into r from public.center_teacher_runs where club_id=p_club_id and actor_id=auth.uid() and request_key=p_request_key and lease_token=p_lease_token and status='running' and lease_until>now() for update;
  if not found or not coalesce(private.center_can_work(p_club_id,auth.uid()),false) then raise exception 'Teacher run is no longer active' using errcode='40001'; end if;
  if not exists(select 1 from public.center_proposals p join public.center_chat_messages m on m.conversation_id=p.conversation_id and m.role='assistant' where p.id=p_proposal_id and p.conversation_id=r.conversation_id and m.metadata->>'requestKey'=p_request_key and m.metadata->'proposalIds' @> jsonb_build_array(p.id::text)) then raise exception 'Proposal outside request' using errcode='42501'; end if;
  result := public.center_decide_proposal(p_club_id,p_proposal_id,p_decision);
  return result;
end $$;

-- History is read directly by the browser while the server action is running.
create or replace function public.center_chat_history(p_club_id uuid,p_conversation_id uuid) returns jsonb language plpgsql stable security definer set search_path=public,private as $$
declare request text;
begin
 if not coalesce(private.center_can_work(p_club_id,auth.uid()),false) or not exists(select 1 from public.center_conversations c where c.id=p_conversation_id and c.club_id=p_club_id and c.actor_id=auth.uid()) then raise exception 'Forbidden' using errcode='42501'; end if;
 select request_key into request from public.center_teacher_runs where conversation_id=p_conversation_id and actor_id=auth.uid() order by started_at desc limit 1;
 return jsonb_build_object('conversationId',p_conversation_id,'messages',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from(select * from public.center_chat_messages m where m.conversation_id=p_conversation_id order by m.created_at desc limit 100)t),'[]'::jsonb),'proposals',coalesce((select jsonb_agg(to_jsonb(p)) from public.center_proposals p where p.conversation_id=p_conversation_id),'[]'::jsonb),'run',public.center_teacher_run(p_club_id,request));
end $$;

revoke all on function public.center_teacher_run_start(uuid,uuid,text,text),public.center_teacher_run_active(uuid,text,uuid),public.center_teacher_run_stage(uuid,text,uuid,text),public.center_teacher_run_finish(uuid,text,uuid,text,text),public.center_teacher_stop(uuid,text),public.center_teacher_run(uuid,text),public.center_teacher_conversations(uuid),public.center_teacher_proposal_failure(uuid,uuid,text),public.center_teacher_chat_complete(uuid,uuid,text,jsonb,jsonb,text,uuid),public.center_teacher_decide_proposal(uuid,uuid,text,text,uuid) from public,anon;
grant execute on function public.center_teacher_run_start(uuid,uuid,text,text),public.center_teacher_run_active(uuid,text,uuid),public.center_teacher_run_stage(uuid,text,uuid,text),public.center_teacher_run_finish(uuid,text,uuid,text,text),public.center_teacher_stop(uuid,text),public.center_teacher_run(uuid,text),public.center_teacher_conversations(uuid),public.center_teacher_proposal_failure(uuid,uuid,text),public.center_teacher_chat_complete(uuid,uuid,text,jsonb,jsonb,text,uuid),public.center_teacher_decide_proposal(uuid,uuid,text,text,uuid) to authenticated;

-- Trial evaluations alter a shared record; only private notes and drafts execute automatically.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.center_chat_complete(uuid,uuid,text,jsonb,jsonb,text)'::regprocedure) into definition;
 execute replace(definition, '''note.create'',''trial.evaluate'',''draft.create''', '''note.create'',''draft.create''');
 select pg_get_functiondef('public.center_decide_proposal(uuid,uuid,text)'::regprocedure) into definition;
 definition := replace(definition, '''note.create'',''trial.evaluate'',''draft.create''', '''note.create'',''draft.create''');
 definition := replace(definition, 'if proposal.status<>''pending'' then', 'if proposal.status=''cancelled'' and p_decision=''cancel'' then return null; end if; if proposal.status=''failed'' and not proposal.requires_confirmation and p_decision=''confirm'' then update public.center_proposals set status=''pending'',receipt=null where id=proposal.id; proposal.status:=''pending''; end if; if proposal.status<>''pending'' then');
 execute definition;
end $$;
update public.center_proposals set requires_confirmation=true where kind='trial.evaluate' and status='pending';
commit;
