begin;

alter table public.center_trials
  add column rebook_of uuid references public.center_trials(id) on delete set null;
create unique index center_trials_one_rebooking
  on public.center_trials(rebook_of) where rebook_of is not null;

create or replace function private.center_rebook_trial(
  p_club_id uuid, p_actor_id uuid, p_input jsonb, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public,private,extensions as $$
declare
  prior public.center_trials;
  student public.student_records;
  command_id uuid:=gen_random_uuid();
  target uuid;
  revision_value integer;
  input_hash text;
  old public.center_commands;
  starts_at_value timestamptz;
  ends_at_value timestamptz;
begin
  if not coalesce(private.center_can_work(p_club_id,p_actor_id),false) then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 200 or p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'Invalid command'; end if;
  input_hash:=encode(digest('trial.rebook'||p_input::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_club_id::text||p_actor_id::text||p_idempotency_key,0));
  select * into old from public.center_commands where club_id=p_club_id and actor_id=p_actor_id and idempotency_key=p_idempotency_key;
  if found then
    if old.input_hash<>input_hash then raise exception 'Idempotency key reused with different input'; end if;
    return old.receipt;
  end if;
  select * into prior from public.center_trials where id=(p_input->>'priorTrialId')::uuid and club_id=p_club_id for update;
  if not found or not coalesce(private.organization_can_manage_class(prior.class_id,p_actor_id),false) then raise exception 'Trial not accessible' using errcode='42501'; end if;
  select * into student from public.student_records where id=prior.student_record_id and club_id=p_club_id for update;
  if not found or not coalesce(private.center_can_read_student(p_club_id,student.id,p_actor_id),false) then raise exception 'Student not accessible' using errcode='42501'; end if;
  if not coalesce(private.organization_can_manage_people(p_club_id,p_actor_id),false) then raise exception 'Admissions manager required' using errcode='42501'; end if;
  if prior.status<>'no_show' then raise exception 'Only no-show trials can be rebooked'; end if;
  if prior.ends_at>=now() then raise exception 'Trial has not ended'; end if;
  if (p_input->>'expectedRevision')::integer is distinct from prior.revision then raise exception 'Revision conflict' using errcode='40001'; end if;
  starts_at_value := (p_input->>'startAt')::timestamptz;
  ends_at_value := (p_input->>'endAt')::timestamptz;
  if starts_at_value is null or ends_at_value is null
    or not isfinite(starts_at_value) or not isfinite(ends_at_value)
    or starts_at_value<=now() or ends_at_value<=starts_at_value
    or ends_at_value-starts_at_value>interval '8 hours'
    or (starts_at_value at time zone prior.timezone)::date<>(ends_at_value at time zone prior.timezone)::date
  then raise exception 'Invalid trial range'; end if;
  if exists(select 1 from public.center_trials where club_id=p_club_id and student_record_id=student.id and status='booked' and starts_at<ends_at_value and ends_at>starts_at_value) then raise exception 'Student has an overlapping booked trial'; end if;
  if exists(select 1 from public.center_trials where rebook_of=prior.id) then raise exception 'Trial already has a replacement'; end if;
  insert into public.center_trials(club_id,student_record_id,class_id,starts_at,ends_at,timezone,rebook_of)
    values(p_club_id,student.id,prior.class_id,starts_at_value,ends_at_value,prior.timezone,prior.id)
    returning id,revision into target,revision_value;
  update public.center_trials set revision=revision+1,updated_at=now() where id=prior.id;
  insert into public.center_commands(id,club_id,actor_id,kind,idempotency_key,input_hash,receipt)
    values(command_id,p_club_id,p_actor_id,'trial.rebook',p_idempotency_key,input_hash,jsonb_build_object('commandId',command_id,'kind','trial.rebook','targetId',target,'revision',revision_value,'status','completed'));
  insert into public.center_events(club_id,command_id,kind,subject_id,payload)
    values(p_club_id,command_id,'trial.booked',target,jsonb_build_object('actorId',p_actor_id,'input',p_input));
  return jsonb_build_object('commandId',command_id,'kind','trial.rebook','targetId',target,'revision',revision_value,'status','completed');
end $$;

do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.center_execute_command(uuid,text,jsonb,text)'::regprocedure) into definition;
  if definition is null then raise exception 'center_execute_command definition missing'; end if;
  definition:=replace(definition,
    'if p_kind<>''schedule.reschedule'' then return public.center_execute_native_command(p_club_id,p_kind,p_input,p_idempotency_key); end if;',
    'if p_kind=''trial.rebook'' then return private.center_rebook_trial(p_club_id,a,p_input,p_idempotency_key); end if; if p_kind<>''schedule.reschedule'' then return public.center_execute_native_command(p_club_id,p_kind,p_input,p_idempotency_key); end if;');
  if definition not like '%private.center_rebook_trial%' then raise exception 'center_execute_command anchor was not replaced'; end if;
  execute definition;
  select pg_get_functiondef('public.center_execute_native_command(uuid,text,jsonb,text)'::regprocedure) into definition;
  if definition is null then raise exception 'center_execute_native_command definition missing'; end if;
  definition:=replace(definition,
    'if (p_input->>''startAt'')::timestamptz <= now() then raise exception ''Trial must start in the future''; end if;',
    'perform 1 from public.student_records where id=student and club_id=p_club_id for update; if not found then raise exception ''Student not accessible'' using errcode=''42501''; end if; if (p_input->>''startAt'')::timestamptz <= now() then raise exception ''Trial must start in the future''; end if; if nullif(p_input->>''startAt'','''') is null or nullif(p_input->>''endAt'','''') is null or not isfinite((p_input->>''startAt'')::timestamptz) or not isfinite((p_input->>''endAt'')::timestamptz) or (p_input->>''endAt'')::timestamptz<=(p_input->>''startAt'')::timestamptz or (p_input->>''endAt'')::timestamptz-(p_input->>''startAt'')::timestamptz>interval ''8 hours'' or ((p_input->>''startAt'')::timestamptz at time zone ''Asia/Ho_Chi_Minh'')::date<>((p_input->>''endAt'')::timestamptz at time zone ''Asia/Ho_Chi_Minh'')::date then raise exception ''Invalid trial range''; end if; if exists(select 1 from public.center_trials where club_id=p_club_id and student_record_id=student and status=''booked'' and starts_at<(p_input->>''endAt'')::timestamptz and ends_at>(p_input->>''startAt'')::timestamptz) then raise exception ''Student has an overlapping booked trial''; end if;');
  if definition not like '%Student has an overlapping booked trial%' then raise exception 'trial.book anchor was not replaced'; end if;
  execute definition;
  select pg_get_functiondef('public.center_chat_complete(uuid,uuid,text,jsonb,jsonb,text)'::regprocedure) into definition;
  if definition is null then raise exception 'center_chat_complete definition missing'; end if;
  definition:=replace(definition,
    $$action->>'kind' not in ('note.create','trial.evaluate','trial.book','admission.stage','offer.create','schedule.reschedule','message.send','draft.create')$$,
    $$action->>'kind' not in ('note.create','trial.evaluate','trial.book','admission.stage','offer.create','schedule.reschedule','message.send','draft.create','trial.rebook')$$);
  if definition not like $$%action->>'kind' not in ('note.create','trial.evaluate','trial.book','admission.stage','offer.create','schedule.reschedule','message.send','draft.create','trial.rebook')%$$ then raise exception 'chat allowlist anchor was not replaced'; end if;
  execute definition;
end
$migration$;

revoke all on function private.center_rebook_trial(uuid,uuid,jsonb,text) from public,anon,authenticated;

commit;
