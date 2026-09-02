-- Live LMS operations.  All mutating entry points are idempotent, optimistic
-- concurrency checked, and re-authorize the exact class inside the transaction.
begin;

-- Enable the completed workspace for active organizations without replacing
-- an explicit organization-level decision. Environment flags remain the
-- deployment kill switch and class-level overrides remain authoritative.
insert into public.lms_pilot_flags (
  club_id, class_id, feature_key, enabled, enabled_at, metadata
)
select c.id, null, 'teacher_workspace_v2', true, now(),
  jsonb_build_object('rollout','completed_lms_v2','scope','organization')
from public.clubs c
where c.status = 'active'
on conflict on constraint lms_pilot_flags_club_id_class_id_feature_key_key do nothing;

create or replace function private.seed_teacher_workspace_for_active_organization()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.status = 'active' then
    insert into public.lms_pilot_flags (
      club_id, class_id, feature_key, enabled, enabled_at, metadata
    ) values (
      new.id, null, 'teacher_workspace_v2', true, now(),
      jsonb_build_object('rollout','completed_lms_v2','scope','organization')
    ) on conflict on constraint lms_pilot_flags_club_id_class_id_feature_key_key do nothing;
  end if;
  return new;
end $$;
drop trigger if exists seed_teacher_workspace_for_active_organization on public.clubs;
create trigger seed_teacher_workspace_for_active_organization
after insert or update of status on public.clubs
for each row execute function private.seed_teacher_workspace_for_active_organization();
revoke all on function private.seed_teacher_workspace_for_active_organization() from public, anon, authenticated;

create table if not exists public.lms_operation_receipts (
  idempotency_key text primary key,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  operation text not null,
  input_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.lms_operation_receipts enable row level security;
revoke all on public.lms_operation_receipts from anon, authenticated;

create table if not exists public.lms_operation_audit_events (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  club_id uuid not null references public.clubs(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  entity_id uuid,
  idempotency_key text,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.lms_operation_audit_events enable row level security;
revoke all on public.lms_operation_audit_events from anon, authenticated;
grant select on public.lms_operation_audit_events to authenticated;
create index if not exists lms_operation_audit_scope_idx
  on public.lms_operation_audit_events(class_id, created_at desc);

create or replace function private.prevent_lms_operation_audit_mutation()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  raise exception 'LMS_OPERATION_AUDIT_IMMUTABLE';
end; $$;
drop trigger if exists lms_operation_audit_immutable on public.lms_operation_audit_events;
create trigger lms_operation_audit_immutable before update or delete on public.lms_operation_audit_events
for each row execute function private.prevent_lms_operation_audit_mutation();
create policy "Managers read operation audit for class"
  on public.lms_operation_audit_events for select to authenticated
  using (class_id is not null and private.can_manage_class(class_id, (select auth.uid())));

create or replace function private.lms_operation_claim(
  p_key text, p_actor uuid, p_operation text, p_input jsonb
) returns jsonb language plpgsql security definer
set search_path = public, private as $$
declare
  v_hash text := encode(extensions.digest(coalesce(p_input, '{}'::jsonb)::text, 'sha256'), 'hex');
  v_existing public.lms_operation_receipts%rowtype;
  v_storage_key text := p_actor::text || ':' || p_operation || ':' || p_key;
begin
  if nullif(btrim(p_key), '') is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  select * into v_existing from public.lms_operation_receipts
    where idempotency_key = v_storage_key for update;
  if found then
    if v_existing.actor_id <> p_actor or v_existing.operation <> p_operation
       or v_existing.input_hash <> v_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_existing.result;
  end if;
  insert into public.lms_operation_receipts(idempotency_key, actor_id, operation, input_hash, result)
    values (v_storage_key, p_actor, p_operation, v_hash, '{}'::jsonb);
  return null;
end;
$$;

create or replace function private.lms_operation_store(
  p_actor uuid, p_operation text, p_key text, p_result jsonb
) returns jsonb language sql security definer
set search_path = public, private as $$
  update public.lms_operation_receipts set result = p_result
    where idempotency_key = p_actor::text || ':' || p_operation || ':' || p_key;
  select p_result;
$$;

-- Cursor form for clients that can persist both sort keys. The legacy
-- timestamptz-only overload remains available for older clients.
create or replace function public.load_teacher_review_queue_v2(
  p_class_id uuid, p_cursor_at timestamptz, p_cursor_id uuid, p_limit integer default 50
) returns table (item_type text, item_id uuid, class_id uuid, student_id uuid, title text,
  submitted_at timestamptz, review_status text, score_source text, evidence jsonb,
  feedback jsonb, revision integer)
language sql stable security definer set search_path = public, private as $$
  select 'homework', s.id, s.class_id, s.user_id, a.title, s.submitted_at,
    case when s.grade_status in ('graded','returned') then s.grade_status else 'pending' end,
    case when s.grade_status in ('graded','returned') then 'teacher' else 'ungraded' end,
    coalesce(s.metadata,'{}'::jsonb), coalesce(to_jsonb(s.feedback),'{}'::jsonb), coalesce(s.revision_number,0)
  from public.club_assignment_submissions s join public.club_assignments a on a.id=s.assignment_id
  where s.class_id=p_class_id and private.can_manage_class(p_class_id,auth.uid())
    and (p_cursor_at is null or (s.submitted_at, s.id) < (p_cursor_at, p_cursor_id))
  union all
  select r.review_kind, r.id, r.class_id, coalesce(w.user_id,sp.user_id), 'IELTS review',
    r.created_at, r.status, case when r.status='published' then 'teacher' else 'ai' end,
    jsonb_build_object('responseId',coalesce(w.id,sp.id),'attemptId',r.attempt_id,'hasEssay',w.essay is not null,'hasTranscript',sp.transcript is not null,'hasAudio',sp.audio_storage_path is not null),
    coalesce(r.criterion_feedback,'{}'::jsonb), r.revision
  from public.ielts_teacher_reviews r
  left join public.writing_responses w on w.id=r.writing_response_id
  left join public.speaking_responses sp on sp.id=r.speaking_response_id
  where r.class_id=p_class_id and private.can_manage_class(p_class_id,auth.uid())
    and (p_cursor_at is null or (r.created_at, r.id) < (p_cursor_at, p_cursor_id))
  order by 6 desc, 2 desc limit greatest(1,least(coalesce(p_limit,50),100));
$$;

create or replace function private.lms_operation_audit(
  p_operation text, p_actor uuid, p_class uuid, p_entity uuid,
  p_key text, p_before jsonb, p_after jsonb
) returns void language plpgsql security definer
set search_path = public, private as $$
declare v_club uuid;
begin
  select club_id into v_club from public.classes where id = p_class;
  if v_club is null then raise exception 'CLASS_NOT_FOUND'; end if;
  insert into public.lms_operation_audit_events(operation, actor_id, club_id, class_id, entity_id,
    idempotency_key, before_state, after_state)
  values (p_operation, p_actor, v_club, p_class, p_entity, p_key,
    coalesce(p_before, '{}'::jsonb), coalesce(p_after, '{}'::jsonb));
end;
$$;

create or replace function private.lms_head_teacher_review_override(p_class_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select private.is_admin(p_user_id) or exists (
    select 1 from public.classes c join public.club_memberships cm on cm.club_id=c.club_id
    where c.id=p_class_id and cm.user_id=p_user_id and cm.status='active' and cm.role='head_teacher'
  );
$$;

-- Preserve the lead-teacher rule while allowing the explicit, reasoned
-- emergency path for a head teacher (or platform admin).
create or replace function private.enforce_ielts_review_teacher_authority()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare override_allowed boolean := coalesce(current_setting('app.ielts_admin_review_override', true), 'off')='on';
begin
  if override_allowed and private.lms_head_teacher_review_override(new.class_id, auth.uid()) then return new; end if;
  if auth.uid() is not null and not private.is_assigned_class_teacher(new.class_id, auth.uid()) then raise exception 'IELTS_REVIEW_REQUIRES_ASSIGNED_CLASS_TEACHER'; end if;
  if not private.is_assigned_class_teacher(new.class_id, new.reviewer_id) then raise exception 'IELTS_REVIEW_REQUIRES_ASSIGNED_CLASS_TEACHER'; end if;
  if tg_op='UPDATE' and new.reviewer_id is distinct from old.reviewer_id then raise exception 'IELTS_REVIEW_AUTHOR_IMMUTABLE'; end if;
  return new;
end; $$;

create or replace function public.head_teacher_override_publish_ielts_review(p_review_id uuid, p_reason text, p_idempotency_key text)
returns setof public.ielts_teacher_reviews language plpgsql security definer set search_path = public, private as $$
declare uid uuid:=auth.uid(); r public.ielts_teacher_reviews%rowtype; result public.ielts_teacher_reviews%rowtype; claimed jsonb;
begin
  if uid is null or nullif(btrim(p_reason),'') is null then raise exception 'OVERRIDE_REASON_REQUIRED'; end if;
  claimed := private.lms_operation_claim(p_idempotency_key, uid, 'override_publish_review',
    jsonb_build_object('reviewId', p_review_id, 'reason', btrim(p_reason)));
  if claimed is not null then
    return query select * from public.ielts_teacher_reviews where id=(claimed->>'reviewId')::uuid;
    return;
  end if;
  select * into r from public.ielts_teacher_reviews where id=p_review_id for update;
  if not found or r.status <> 'draft' or not private.lms_head_teacher_review_override(r.class_id,uid) then raise exception 'FORBIDDEN'; end if;
  perform set_config('app.ielts_admin_review_override','on',true);
  update public.ielts_teacher_reviews set status='published',published_at=now(),updated_at=now() where id=r.id returning * into result;
  insert into public.ielts_teacher_review_events(review_id,attempt_id,actor_id,event_type,from_status,to_status,revision,payload)
    values (r.id,r.attempt_id,uid,'published','draft','published',r.revision,jsonb_build_object('reason',btrim(p_reason),'override',true,'sourceClassId',r.class_id,'before',jsonb_build_object('status',r.status),'after',jsonb_build_object('status','published')));
  perform private.recompute_ielts_effective_attempt_scores(r.attempt_id);
  perform private.lms_operation_store(uid,'override_publish_review',p_idempotency_key,jsonb_build_object('reviewId',r.id,'status','published'));
  return next result;
end; $$;

revoke all on function public.head_teacher_override_publish_ielts_review(uuid,text,text) from public, anon;
grant execute on function public.head_teacher_override_publish_ielts_review(uuid,text,text) to authenticated;

create or replace function public.head_teacher_override_return_ielts_review(p_review_id uuid, p_reason text, p_note text, p_idempotency_key text)
returns setof public.ielts_teacher_reviews language plpgsql security definer set search_path = public, private as $$
declare uid uuid:=auth.uid(); r public.ielts_teacher_reviews%rowtype; result public.ielts_teacher_reviews%rowtype; next_revision integer; claimed jsonb;
begin
  if uid is null or nullif(btrim(p_reason),'') is null then raise exception 'OVERRIDE_REASON_REQUIRED'; end if;
  claimed := private.lms_operation_claim(p_idempotency_key, uid, 'override_return_review',
    jsonb_build_object('reviewId', p_review_id, 'reason', btrim(p_reason), 'note', nullif(btrim(p_note),'')));
  if claimed is not null then
    return query select * from public.ielts_teacher_reviews where id=(claimed->>'reviewId')::uuid;
    return;
  end if;
  select * into r from public.ielts_teacher_reviews where id=p_review_id for update;
  if not found or r.status <> 'published' or not private.lms_head_teacher_review_override(r.class_id,uid) then raise exception 'FORBIDDEN'; end if;
  next_revision:=r.revision+1;
  perform set_config('app.ielts_admin_review_override','on',true);
  if r.review_kind='writing' then update public.writing_responses set revision_grant=next_revision where id=r.writing_response_id and revision_grant is null;
  else update public.speaking_responses set revision_grant=next_revision where id=r.speaking_response_id and revision_grant is null; end if;
  if not found then raise exception 'IELTS_REVISION_ALREADY_GRANTED_OR_STALE'; end if;
  update public.ielts_teacher_reviews set status='returned',returned_note=nullif(btrim(p_note),''),returned_at=now(),revision_granted=next_revision,updated_at=now() where id=r.id returning * into result;
  insert into public.ielts_teacher_review_events(review_id,attempt_id,actor_id,event_type,from_status,to_status,revision,payload)
    values(r.id,r.attempt_id,uid,'returned','published','returned',r.revision,jsonb_build_object('reason',btrim(p_reason),'override',true,'sourceClassId',r.class_id,'revisionGranted',next_revision,'before',jsonb_build_object('status',r.status),'after',jsonb_build_object('status','returned')));
  perform private.recompute_ielts_effective_attempt_scores(r.attempt_id);
  perform private.lms_operation_store(uid,'override_return_review',p_idempotency_key,jsonb_build_object('reviewId',r.id,'status','returned'));
  return next result;
end; $$;
revoke all on function public.head_teacher_override_return_ielts_review(uuid,text,text,text) from public, anon;
grant execute on function public.head_teacher_override_return_ielts_review(uuid,text,text,text) to authenticated;

create or replace function public.teacher_workspace_reschedule(
  p_schedule_id uuid, p_start_date date, p_end_date date, p_start_time time,
  p_end_time time, p_timezone text, p_expected_updated_at timestamptz,
  p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); r public.class_schedules%rowtype; result jsonb; claimed jsonb;
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  claimed := private.lms_operation_claim(p_idempotency_key, uid, 'reschedule',
    jsonb_build_object('schedule',p_schedule_id,'start',p_start_date,'end',p_end_date,'st',p_start_time,'et',p_end_time,'tz',p_timezone,'expected',p_expected_updated_at));
  if claimed is not null then return claimed; end if;
  select * into r from public.class_schedules where id=p_schedule_id for update;
  if not found or not private.can_manage_class(r.class_id, uid) then raise exception 'FORBIDDEN'; end if;
  if r.updated_at is distinct from p_expected_updated_at then raise exception 'STALE_UPDATE'; end if;
  if p_end_date is not null and p_end_date < p_start_date or p_end_time <= p_start_time then raise exception 'INVALID_SCHEDULE_RANGE'; end if;
  update public.class_schedules set start_date=p_start_date,end_date=p_end_date,start_time=p_start_time,end_time=p_end_time,
    timezone=coalesce(nullif(btrim(p_timezone),''), timezone), updated_at=now() where id=r.id;
  result := jsonb_build_object('scheduleId',r.id,'updatedAt',(select updated_at from public.class_schedules where id=r.id));
  perform private.lms_operation_audit('reschedule',uid,r.class_id,r.id,p_idempotency_key,to_jsonb(r),result);
  return private.lms_operation_store(uid,'reschedule',p_idempotency_key,result);
end; $$;

create or replace function public.teacher_workspace_set_occurrence_state(
  p_occurrence_id uuid, p_state text, p_expected_updated_at timestamptz, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); r public.lms_lesson_occurrences%rowtype; result jsonb; claimed jsonb;
begin
  if uid is null or p_state not in ('completed','cancelled','scheduled') then raise exception 'INVALID_OCCURRENCE_STATE'; end if;
  claimed := private.lms_operation_claim(p_idempotency_key,uid,'occurrence_state',jsonb_build_object('id',p_occurrence_id,'state',p_state,'expected',p_expected_updated_at));
  if claimed is not null then return claimed; end if;
  select * into r from public.lms_lesson_occurrences where id=p_occurrence_id for update;
  if not found or not private.can_manage_class(r.class_id,uid) then raise exception 'FORBIDDEN'; end if;
  if r.updated_at is distinct from p_expected_updated_at then raise exception 'STALE_UPDATE'; end if;
  update public.lms_lesson_occurrences set status=p_state, updated_by=uid, updated_at=now() where id=r.id;
  result := jsonb_build_object('occurrenceId',r.id,'status',p_state,'updatedAt',(select updated_at from public.lms_lesson_occurrences where id=r.id));
  perform private.lms_operation_audit('occurrence_'||p_state,uid,r.class_id,r.id,p_idempotency_key,to_jsonb(r),result);
  return private.lms_operation_store(uid,'occurrence_state',p_idempotency_key,result);
end; $$;

create or replace function public.teacher_workspace_plan_lesson(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); v_class_id uuid; v_course_id uuid; v_schedule_id uuid;
  v_lesson_id uuid; v_activity_id uuid; v_occurrence_date date; v_starts_at timestamptz; v_ends_at timestamptz;
  v_schedule public.class_schedules%rowtype; occurrence_id uuid; result jsonb; claimed jsonb;
begin
  begin
    v_class_id := nullif(p_input->>'classId','')::uuid;
    v_course_id := nullif(p_input->>'courseId','')::uuid;
    v_schedule_id := nullif(p_input->>'scheduleId','')::uuid;
    v_lesson_id := nullif(p_input->>'lessonId','')::uuid;
    v_activity_id := nullif(p_input->>'activityId','')::uuid;
    v_occurrence_date := nullif(p_input->>'occurrenceDate','')::date;
    v_starts_at := nullif(p_input->>'startsAt','')::timestamptz;
    v_ends_at := nullif(p_input->>'endsAt','')::timestamptz;
  exception when invalid_text_representation then raise exception 'INVALID_PLAN_INPUT'; end;
  if v_class_id is null or v_course_id is null or v_schedule_id is null or v_occurrence_date is null
     or v_starts_at is null or v_ends_at is null then raise exception 'PLAN_FIELDS_REQUIRED'; end if;
  if uid is null or not private.can_manage_class(v_class_id,uid) then raise exception 'FORBIDDEN'; end if;
  claimed := private.lms_operation_claim(p_input->>'idempotencyKey',uid,'plan_lesson',p_input);
  if claimed is not null then return claimed; end if;
  select * into v_schedule from public.class_schedules where id=v_schedule_id for share;
  if not found or v_schedule.class_id is distinct from v_class_id or v_schedule.status <> 'active' then raise exception 'SCHEDULE_NOT_IN_CLASS'; end if;
  if v_schedule.course_id is not null and v_schedule.course_id is distinct from v_course_id then raise exception 'SCHEDULE_COURSE_MISMATCH'; end if;
  if not exists (select 1 from public.class_course_assignments cca where cca.class_id=v_class_id and cca.course_id=v_course_id) then raise exception 'COURSE_NOT_ASSIGNED'; end if;
  if v_lesson_id is null and v_activity_id is null then raise exception 'LESSON_OR_ACTIVITY_REQUIRED'; end if;
  if v_lesson_id is not null and not exists (
    select 1 from public.lessons l join public.course_modules m on m.id=l.module_id
    where l.id=v_lesson_id and m.course_id=v_course_id
  ) then raise exception 'LESSON_NOT_IN_COURSE'; end if;
  if v_activity_id is not null and not exists (
    select 1 from public.activities a join public.course_modules m on m.id=a.module_id
    where a.id=v_activity_id and m.course_id=v_course_id
  ) then raise exception 'ACTIVITY_NOT_IN_COURSE'; end if;
  if v_ends_at <= v_starts_at then raise exception 'INVALID_PLAN_TIME'; end if;
  if v_occurrence_date < v_schedule.start_date or (v_schedule.end_date is not null and v_occurrence_date > v_schedule.end_date) then raise exception 'DATE_OUTSIDE_SCHEDULE'; end if;
  insert into public.lms_lesson_occurrences(club_id,class_id,class_schedule_id,course_id,lesson_id,activity_id,occurrence_date,starts_at,ends_at,timezone,title,notes,status,published_at,created_by,updated_by)
  select c.club_id,v_class_id,v_schedule_id,v_course_id,v_lesson_id,v_activity_id,v_occurrence_date,v_starts_at,v_ends_at,coalesce(p_input->>'timezone','Asia/Ho_Chi_Minh'),btrim(p_input->>'title'),p_input->>'notes','scheduled',null,uid,uid from public.classes c where c.id=v_class_id returning id into occurrence_id;
  result := jsonb_build_object('occurrenceId',occurrence_id,'classId',v_class_id);
  perform private.lms_operation_audit('plan_lesson',uid,v_class_id,occurrence_id,p_input->>'idempotencyKey','{}',result);
  return private.lms_operation_store(uid,'plan_lesson',p_input->>'idempotencyKey',result);
end; $$;

create or replace function public.teacher_workspace_publish_assignment(
  p_assignment_id uuid, p_expected_updated_at timestamptz, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); r public.club_assignments%rowtype; result jsonb; claimed jsonb;
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  claimed := private.lms_operation_claim(p_idempotency_key,uid,'publish_assignment',jsonb_build_object('id',p_assignment_id,'expected',p_expected_updated_at));
  if claimed is not null then return claimed; end if;
  select * into r from public.club_assignments where id=p_assignment_id for update;
  if not found or r.class_id is null or not private.can_manage_class(r.class_id,uid) then raise exception 'FORBIDDEN'; end if;
  if r.updated_at is distinct from p_expected_updated_at then raise exception 'STALE_UPDATE'; end if;
  update public.club_assignments set status='active',updated_at=now() where id=r.id;
  result := jsonb_build_object('assignmentId',r.id,'status','active');
  perform private.lms_operation_audit('publish_assignment',uid,r.class_id,r.id,p_idempotency_key,to_jsonb(r),result);
  perform public.enqueue_notification_event('lms:assignment_published:'||r.id::text,'assignment_published','Assignment published',r.title,
    array(select cm.user_id from public.class_memberships cm where cm.class_id=r.class_id and cm.member_role='student' and cm.status='active'),
    jsonb_build_object('assignmentId',r.id,'classId',r.class_id),'normal','lms',uid,'assignment',r.id::text,true,'operational','assignments');
  return private.lms_operation_store(uid,'publish_assignment',p_idempotency_key,result);
end; $$;

create or replace function public.teacher_workspace_correct_attendance(
  p_session_id uuid, p_user_id uuid, p_status text, p_notes text,
  p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); s public.class_attendance_sessions%rowtype; result jsonb; claimed jsonb;
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  if p_status not in ('present','late','absent') then raise exception 'INVALID_ATTENDANCE_STATUS'; end if;
  claimed := private.lms_operation_claim(p_idempotency_key,uid,'attendance',jsonb_build_object('session',p_session_id,'user',p_user_id,'status',p_status,'notes',p_notes));
  if claimed is not null then return claimed; end if;
  select * into s from public.class_attendance_sessions where id=p_session_id for update;
  if not found or not private.can_manage_class(s.class_id,uid) then raise exception 'FORBIDDEN'; end if;
  insert into public.class_attendance_records(session_id,user_id,status,notes,updated_at) values (s.id,p_user_id,p_status,p_notes,now())
    on conflict (session_id,user_id) do update set status=excluded.status,notes=excluded.notes,updated_at=now();
  result := jsonb_build_object('sessionId',s.id,'userId',p_user_id,'status',p_status);
  perform private.lms_operation_audit('attendance_correction',uid,s.class_id,s.id,p_idempotency_key,'{}',result);
  return private.lms_operation_store(uid,'attendance',p_idempotency_key,result);
end; $$;

create or replace function public.teacher_workspace_grade_homework(
  p_submission_id uuid, p_score numeric, p_score_max numeric, p_feedback text,
  p_rubric_breakdown jsonb, p_expected_updated_at timestamptz, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare uid uuid:=auth.uid(); s public.club_assignment_submissions%rowtype; result jsonb; claimed jsonb;
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  if p_score < 0 or p_score_max <= 0 or p_score > p_score_max then raise exception 'INVALID_GRADE'; end if;
  claimed:=private.lms_operation_claim(p_idempotency_key,uid,'grade_homework',jsonb_build_object('id',p_submission_id,'score',p_score,'max',p_score_max,'feedback',p_feedback,'rubric',p_rubric_breakdown,'expected',p_expected_updated_at));
  if claimed is not null then return claimed; end if;
  select * into s from public.club_assignment_submissions where id=p_submission_id for update;
  if not found or s.class_id is null or not private.can_manage_class(s.class_id,uid) then raise exception 'FORBIDDEN'; end if;
  if s.updated_at is distinct from p_expected_updated_at then raise exception 'STALE_UPDATE'; end if;
  perform set_config('app.homework_grade_transition','on',true);
  update public.club_assignment_submissions set score=p_score,score_max=p_score_max,feedback=nullif(btrim(p_feedback),''),rubric_breakdown=coalesce(p_rubric_breakdown,'{}'),grade_status='graded',status='reviewed',graded_by=uid,graded_at=now(),updated_at=now() where id=s.id;
  result:=jsonb_build_object('submissionId',s.id,'score',p_score,'scoreMax',p_score_max,'gradeStatus','graded','gradedBy',uid);
  perform private.lms_operation_audit('grade_homework',uid,s.class_id,s.id,p_idempotency_key,to_jsonb(s),result);
  perform public.enqueue_notification_event('lms:graded:'||s.id::text,'result_published','Work reviewed','Your teacher reviewed your work',array[s.user_id],jsonb_build_object('submissionId',s.id,'classId',s.class_id),'normal','lms',uid,'submission',s.id::text,true,'operational','grading');
  return private.lms_operation_store(uid,'grade_homework',p_idempotency_key,result);
end; $$;

create or replace function public.teacher_workspace_publish_announcement(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare uid uuid := auth.uid(); v_class_id uuid := (p_input->>'classId')::uuid; announcement_id uuid; result jsonb; claimed jsonb;
begin
  if uid is null or not private.can_manage_class(v_class_id,uid) then raise exception 'FORBIDDEN'; end if;
  claimed := private.lms_operation_claim(p_input->>'idempotencyKey',uid,'announcement',p_input);
  if claimed is not null then return claimed; end if;
  insert into public.lms_announcements(club_id,class_id,title,body,status,publish_at,published_at,created_by,updated_by)
    select c.club_id,v_class_id,btrim(p_input->>'title'),btrim(p_input->>'body'),case when coalesce((p_input->>'publish')::boolean,false) then 'published' else 'draft' end,
      case when coalesce((p_input->>'publish')::boolean,false) then now() else (p_input->>'publishAt')::timestamptz end,
      case when coalesce((p_input->>'publish')::boolean,false) then now() else null end,uid,uid from public.classes c where c.id=v_class_id returning id into announcement_id;
  result := jsonb_build_object('announcementId',announcement_id,'classId',v_class_id);
  perform private.lms_operation_audit('announcement',uid,v_class_id,announcement_id,p_input->>'idempotencyKey','{}',result);
  if coalesce((p_input->>'publish')::boolean,false) then
    perform public.enqueue_notification_event('lms:announcement:'||announcement_id::text,'announcement',btrim(p_input->>'title'),btrim(p_input->>'body'),
      array(select cm.user_id from public.class_memberships cm where cm.class_id=v_class_id and cm.member_role='student' and cm.status='active'),
      jsonb_build_object('announcementId',announcement_id,'classId',v_class_id),'normal','lms',uid,'announcement',announcement_id::text,true,'operational','announcements');
  end if;
  return private.lms_operation_store(uid,'announcement',p_input->>'idempotencyKey',result);
end; $$;

create or replace function public.teacher_workspace_place_material(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare uid uuid:=auth.uid(); result jsonb; claimed jsonb; placement_id uuid; placement_result jsonb;
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  claimed:=private.lms_operation_claim(p_input->>'idempotencyKey',uid,'place_material',p_input);
  if claimed is not null then return claimed; end if;
  placement_result:=public.lms_place_material(p_input);
  placement_id:=(placement_result->>'placementId')::uuid;
  result:=jsonb_build_object('placementId',placement_id);
  return private.lms_operation_store(uid,'place_material',p_input->>'idempotencyKey',result);
end; $$;

create or replace function public.teacher_workspace_publish_material(
  p_material_id uuid, p_placement_id uuid, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = public, private as $$
declare uid uuid:=auth.uid(); result jsonb; claimed jsonb;
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  claimed:=private.lms_operation_claim(p_idempotency_key,uid,'publish_material',jsonb_build_object('material',p_material_id,'placement',p_placement_id));
  if claimed is not null then return claimed; end if;
  perform public.lms_publish_material(p_material_id,p_placement_id);
  result:=jsonb_build_object('materialId',p_material_id,'placementId',p_placement_id,'status','published');
  return private.lms_operation_store(uid,'publish_material',p_idempotency_key,result);
end; $$;

create or replace function public.load_teacher_review_queue(
  p_class_id uuid, p_cursor timestamptz default null, p_limit integer default 50
) returns table (item_type text, item_id uuid, class_id uuid, student_id uuid, title text, submitted_at timestamptz, review_status text, score_source text)
language sql stable security definer set search_path = public, private as $$
  select 'homework', s.id, s.class_id, s.user_id, a.title, s.submitted_at,
    case when s.grade_status in ('graded','returned') then s.grade_status else 'pending' end,
    case when s.grade_status in ('graded','returned') then 'teacher' else 'ungraded' end
  from public.club_assignment_submissions s join public.club_assignments a on a.id=s.assignment_id
  where s.class_id=p_class_id and private.can_manage_class(p_class_id,auth.uid())
    and s.submitted_at < coalesce(p_cursor,'infinity'::timestamptz)
  order by s.submitted_at desc, s.id desc limit greatest(1,least(coalesce(p_limit,50),100));
$$;

create or replace function public.load_teacher_review_queue_v2(
  p_class_id uuid, p_cursor timestamptz default null, p_limit integer default 50
) returns table (item_type text, item_id uuid, class_id uuid, student_id uuid, title text,
  submitted_at timestamptz, review_status text, score_source text, evidence jsonb,
  feedback jsonb, revision integer)
language sql stable security definer set search_path = public, private as $$
  select 'homework', s.id, s.class_id, s.user_id, a.title, s.submitted_at,
    case when s.grade_status in ('graded','returned') then s.grade_status else 'pending' end,
    case when s.grade_status in ('graded','returned') then 'teacher' else 'ungraded' end,
    coalesce(s.metadata,'{}'::jsonb), coalesce(to_jsonb(s.feedback),'{}'::jsonb), coalesce(s.revision_number,0)
  from public.club_assignment_submissions s join public.club_assignments a on a.id=s.assignment_id
  where s.class_id=p_class_id and private.can_manage_class(p_class_id,auth.uid())
    and s.submitted_at < coalesce(p_cursor,'infinity'::timestamptz)
  union all
  select r.review_kind, r.id, r.class_id, coalesce(w.user_id,sp.user_id), 'IELTS review',
    r.created_at, r.status, case when r.status='published' then 'teacher' else 'ai' end,
    jsonb_build_object('responseId',coalesce(w.id,sp.id),'attemptId',r.attempt_id,'hasEssay',w.essay is not null,'hasTranscript',sp.transcript is not null,'hasAudio',sp.audio_storage_path is not null),
    coalesce(r.criterion_feedback,'{}'::jsonb), r.revision
  from public.ielts_teacher_reviews r
  left join public.writing_responses w on w.id=r.writing_response_id
  left join public.speaking_responses sp on sp.id=r.speaking_response_id
  where r.class_id=p_class_id and private.can_manage_class(p_class_id,auth.uid())
    and r.created_at < coalesce(p_cursor,'infinity'::timestamptz)
  order by 6 desc, 2 desc limit greatest(1,least(coalesce(p_limit,50),100));
$$;

-- Subject-neutral learner projection.  It deliberately returns only rows for
-- an active exact-class student membership; removed learners retain access to
-- their own submitted/graded records through the existing submission/result
-- projections, never to future class content.
create or replace function public.load_student_lms_week(
  p_class_id uuid, p_from date, p_to date
) returns jsonb language plpgsql stable security definer
set search_path = public, private as $$
declare uid uuid := auth.uid(); result jsonb; v_active boolean; v_historical boolean;
begin
  if uid is null or p_from is null or p_to is null or p_to < p_from then raise exception 'INVALID_WEEK'; end if;
  select exists (
    select 1 from public.class_memberships cm
    where cm.class_id=p_class_id and cm.user_id=uid and cm.member_role='student' and cm.status='active'
  ) into v_active;
  select exists (
    select 1 from public.class_memberships cm
    where cm.class_id=p_class_id and cm.user_id=uid and cm.member_role='student'
      and cm.status='removed'
      and (
        exists (select 1 from public.club_assignment_submissions s where s.class_id=p_class_id and s.user_id=uid and s.submission_state='submitted')
        or exists (select 1 from public.class_attendance_sessions ats join public.class_attendance_records ar on ar.session_id=ats.id where ats.class_id=p_class_id and ar.user_id=uid)
        or exists (select 1 from public.ielts_attempts ia where ia.class_id=p_class_id and ia.user_id=uid)
      )
  ) into v_historical;
  if not v_active and not v_historical then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select jsonb_build_object(
    'classId', p_class_id,
    'from', p_from,
    'to', p_to,
    'occurrences', coalesce((select jsonb_agg(jsonb_build_object(
      'id',o.id,'classId',o.class_id,'courseId',o.course_id,'lessonId',o.lesson_id,
      'activityId',o.activity_id,'date',o.occurrence_date,'startsAt',o.starts_at,
      'endsAt',o.ends_at,'timezone',o.timezone,'title',o.title,'status',o.status
    ) order by o.occurrence_date,o.starts_at,o.id)
      from public.lms_lesson_occurrences o where v_active and o.class_id=p_class_id and o.published_at is not null and o.status <> 'cancelled' and o.occurrence_date between p_from and p_to), '[]'::jsonb),
    'materials', coalesce((select jsonb_agg(to_jsonb(material_row))
      from public.load_lms_materials_for_user(p_class_id,p_from,p_to) material_row
      where v_active), '[]'::jsonb),
    'assignments', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'dueAt',a.due_at,'status',a.status) order by a.due_at nulls last,a.id)
      from public.club_assignments a where v_active and a.class_id=p_class_id and a.status='active'), '[]'::jsonb),
    'announcements', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'body',a.body,'publishedAt',a.published_at) order by a.published_at desc,a.id)
      from public.lms_announcements a where v_active and a.class_id=p_class_id and a.status='published' and (a.publish_at is null or a.publish_at <= now())), '[]'::jsonb),
    'submissions', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'assignmentId',s.assignment_id,'state',s.submission_state,'gradeStatus',s.grade_status,'submittedAt',s.submitted_at,'feedback',case when s.grade_status in ('graded','returned') then s.feedback else null end) order by s.updated_at desc,s.id)
      from public.club_assignment_submissions s where s.class_id=p_class_id and s.user_id=uid and (v_active or s.submission_state='submitted')), '[]'::jsonb),
    'attendance', coalesce((select jsonb_agg(jsonb_build_object('sessionId',s.id,'sessionDate',s.session_date,'status',r.status,'notes',r.notes) order by s.session_date,s.id)
      from public.class_attendance_sessions s join public.class_attendance_records r on r.session_id=s.id and r.user_id=uid where s.class_id=p_class_id and s.session_date between p_from and p_to), '[]'::jsonb),
    'results', coalesce((select jsonb_agg(jsonb_build_object(
      'attemptId',e.attempt_id,
      'listeningBand',e.listening_band,
      'readingBand',e.reading_band,
      'writingBand',case when (select count(distinct tr.task_number) from public.ielts_teacher_reviews tr where tr.attempt_id=e.attempt_id and tr.review_kind='writing' and tr.status='published')=2 then e.writing_band else null end,
      'speakingBand',case when (select count(distinct tr.part_number) from public.ielts_teacher_reviews tr where tr.attempt_id=e.attempt_id and tr.review_kind='speaking' and tr.status='published')=3 then e.speaking_band else null end,
      'overallBand',case when
        (select count(distinct tr.task_number) from public.ielts_teacher_reviews tr where tr.attempt_id=e.attempt_id and tr.review_kind='writing' and tr.status='published')=2
        and (select count(distinct tr.part_number) from public.ielts_teacher_reviews tr where tr.attempt_id=e.attempt_id and tr.review_kind='speaking' and tr.status='published')=3
        then e.overall_band else null end,
      'provisional',case when
        (select count(distinct tr.task_number) from public.ielts_teacher_reviews tr where tr.attempt_id=e.attempt_id and tr.review_kind='writing' and tr.status='published')=2
        and (select count(distinct tr.part_number) from public.ielts_teacher_reviews tr where tr.attempt_id=e.attempt_id and tr.review_kind='speaking' and tr.status='published')=3
        then e.overall_is_provisional else true end,
      'scoreSource',case when e.score_source in ('teacher','mixed') then e.score_source else 'objective_auto' end
    ) order by e.computed_at desc,e.attempt_id)
      from public.ielts_effective_attempt_scores e where e.class_id=p_class_id and e.user_id=uid), '[]'::jsonb),
    'aiResults', coalesce((select jsonb_agg(jsonb_build_object('attemptId',b.attempt_id,'listeningBand',b.listening_band,'readingBand',b.reading_band,'scoreSource','objective_auto') order by b.created_at desc,b.attempt_id)
      from public.attempt_band_scores b join public.ielts_attempts a on a.id=b.attempt_id where a.class_id=p_class_id and a.user_id=uid and not exists (select 1 from public.ielts_effective_attempt_scores e where e.attempt_id=b.attempt_id)), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'eventType',e.event_type,'title',e.title,'body',e.body,'state',i.state,'readAt',i.read_at,'createdAt',i.created_at) order by i.created_at desc,i.id)
      from public.notification_inbox_items i join public.notification_events e on e.id=i.event_id
      where v_active and i.recipient_id=uid and coalesce(e.payload->>'classId',e.payload->>'class_id')=p_class_id::text), '[]'::jsonb)
  ) into result;
  return result;
end; $$;

create or replace function public.mark_lms_notification_read(p_notification_id uuid)
returns boolean language plpgsql security definer set search_path = public, private as $$
begin
  update public.notification_inbox_items set state='read',read_at=coalesce(read_at,now()) where id=p_notification_id and recipient_id=auth.uid();
  return found;
end; $$;

revoke all on function public.teacher_workspace_reschedule(uuid,date,date,time,time,text,timestamptz,text), public.teacher_workspace_set_occurrence_state(uuid,text,timestamptz,text), public.teacher_workspace_plan_lesson(jsonb), public.teacher_workspace_publish_assignment(uuid,timestamptz,text), public.teacher_workspace_correct_attendance(uuid,uuid,text,text,text), public.teacher_workspace_grade_homework(uuid,numeric,numeric,text,jsonb,timestamptz,text), public.teacher_workspace_publish_announcement(jsonb), public.teacher_workspace_place_material(jsonb), public.teacher_workspace_publish_material(uuid,uuid,text), public.load_teacher_review_queue(uuid,timestamptz,integer), public.load_teacher_review_queue_v2(uuid,timestamptz,uuid,integer) from public, anon;
grant execute on function public.teacher_workspace_reschedule(uuid,date,date,time,time,text,timestamptz,text), public.teacher_workspace_set_occurrence_state(uuid,text,timestamptz,text), public.teacher_workspace_plan_lesson(jsonb), public.teacher_workspace_publish_assignment(uuid,timestamptz,text), public.teacher_workspace_correct_attendance(uuid,uuid,text,text,text), public.teacher_workspace_grade_homework(uuid,numeric,numeric,text,jsonb,timestamptz,text), public.teacher_workspace_publish_announcement(jsonb), public.teacher_workspace_place_material(jsonb), public.teacher_workspace_publish_material(uuid,uuid,text), public.load_teacher_review_queue(uuid,timestamptz,integer), public.load_teacher_review_queue_v2(uuid,timestamptz,uuid,integer), public.load_teacher_review_queue_v2(uuid,timestamptz,integer) to authenticated;
revoke all on function public.load_student_lms_week(uuid,date,date), public.mark_lms_notification_read(uuid) from public, anon;
grant execute on function public.load_student_lms_week(uuid,date,date), public.mark_lms_notification_read(uuid) to authenticated;

-- Academic organization operations are intentionally re-bound here, after the
-- head_teacher capability helpers exist.  Keep the public signatures stable so
-- older clients remain idempotent while the database remains the authority.
create or replace function public.create_organization_class_transaction(
  p_organization_id uuid, p_club_id uuid, p_code text, p_title text, p_description text,
  p_program_type text, p_grade_level text, p_status text, p_start_date date, p_end_date date,
  p_meeting_schedule text, p_room text, p_max_students integer, p_idempotency_key text, p_actor_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); result jsonb; existing jsonb; class_id uuid; code_value text; request_hash text; org_id uuid := coalesce(p_organization_id, p_club_id);
begin
  if uid is null or p_actor_id is distinct from uid or org_id is null or p_club_id is distinct from org_id or not private.organization_can_academic_admin(org_id, uid) then raise exception 'FORBIDDEN'; end if;
  if nullif(btrim(p_title), '') is null or coalesce(p_program_type, 'debate') not in ('debate', 'ielts', 'public_speaking') or coalesce(p_status, 'draft') not in ('draft', 'active', 'archived') then raise exception 'INVALID_CLASS_INPUT'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  request_hash := encode(digest(concat_ws('|', org_id, p_code, p_title, p_description, p_program_type, p_grade_level, p_status, p_start_date, p_end_date, p_meeting_schedule, p_room, p_max_students), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('create_class:' || org_id::text || ':' || uid::text || ':' || p_idempotency_key, 0));
  existing := private.organization_idempotency_lookup(uid, 'create_organization_class', p_idempotency_key, request_hash);
  if existing is not null then return existing; end if;
  if not exists (select 1 from public.clubs where id = org_id) then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  code_value := coalesce(nullif(btrim(p_code), ''), 'class-' || substr(gen_random_uuid()::text, 1, 8));
  insert into public.classes (club_id, code, title, description, program_type, grade_level, status, start_date, end_date, meeting_schedule, room, max_students, created_by)
  values (org_id, code_value, btrim(p_title), p_description, coalesce(p_program_type, 'debate'), p_grade_level, coalesce(p_status, 'draft'), p_start_date, p_end_date, p_meeting_schedule, p_room, p_max_students, uid)
  returning id into class_id;
  result := jsonb_build_object('classId', class_id, 'class_id', class_id, 'organizationId', org_id, 'organization_id', org_id);
  insert into public.organization_operation_idempotency(actor_id, operation, idempotency_key, request_hash, response_payload, completed_at) values (uid, 'create_organization_class', p_idempotency_key, request_hash, result, now());
  perform private.organization_audit(org_id, uid, 'class_created', 'class', class_id, jsonb_build_object('title', btrim(p_title)), p_idempotency_key);
  return result;
end; $$;

create or replace function public.assign_organization_teacher_transaction(
  p_organization_id uuid, p_class_id uuid, p_teacher_id uuid, p_action text,
  p_idempotency_key text, p_actor_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); result jsonb; existing jsonb; org_id uuid; request_hash text;
begin
  if uid is null or p_actor_id is distinct from uid or p_action <> 'add' or not private.organization_can_academic_admin(p_organization_id, uid) then raise exception 'FORBIDDEN'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  request_hash := encode(digest(concat_ws('|', p_organization_id, p_class_id, p_teacher_id, p_action), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('assign_teacher:' || p_class_id::text || ':' || p_teacher_id::text || ':' || p_idempotency_key, 0));
  existing := private.organization_idempotency_lookup(uid, 'assign_organization_teacher', p_idempotency_key, request_hash);
  if existing is not null then return existing; end if;
  select club_id into org_id from public.classes where id = p_class_id for update;
  if org_id is null or org_id is distinct from p_organization_id then raise exception 'CLASS_ORGANIZATION_MISMATCH'; end if;
  if not exists (select 1 from public.club_memberships cm where cm.club_id = org_id and cm.user_id = p_teacher_id and cm.status = 'active' and cm.role in ('teacher', 'coach', 'head_teacher')) then raise exception 'TEACHER_MUST_JOIN_ORGANIZATION'; end if;
  insert into public.class_memberships (class_id, user_id, member_role, status, created_by, updated_at) values (p_class_id, p_teacher_id, 'teacher', 'active', uid, now()) on conflict (class_id, user_id, member_role) do update set status = 'active', removed_at = null, updated_at = now();
  update public.classes set teacher_user_id = p_teacher_id, updated_at = now() where id = p_class_id;
  result := jsonb_build_object('classId', p_class_id, 'class_id', p_class_id, 'resourceId', p_teacher_id, 'resource_id', p_teacher_id, 'organizationId', org_id, 'organization_id', org_id);
  insert into public.organization_operation_idempotency(actor_id, operation, idempotency_key, request_hash, response_payload, completed_at) values (uid, 'assign_organization_teacher', p_idempotency_key, request_hash, result, now());
  perform private.organization_audit(org_id, uid, 'teacher_assigned', 'class', p_class_id, jsonb_build_object('teacher_id', p_teacher_id), p_idempotency_key);
  return result;
end; $$;

create or replace function public.assign_organization_course_transaction(
  p_organization_id uuid, p_class_id uuid, p_course_id uuid, p_action text,
  p_idempotency_key text, p_actor_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); result jsonb; existing jsonb; request_hash text;
begin
  if uid is null or p_actor_id is distinct from uid or p_action <> 'assign' or not private.organization_can_academic_admin(p_organization_id, uid) then raise exception 'FORBIDDEN'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  request_hash := encode(digest(concat_ws('|', p_organization_id, p_class_id, p_course_id, p_action), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('assign_course:' || p_class_id::text || ':' || p_course_id::text || ':' || p_idempotency_key, 0));
  existing := private.organization_idempotency_lookup(uid, 'assign_organization_course', p_idempotency_key, request_hash);
  if existing is not null then return existing; end if;
  if not exists (select 1 from public.classes where id = p_class_id and club_id = p_organization_id) then raise exception 'CLASS_ORGANIZATION_MISMATCH'; end if;
  if not exists (select 1 from public.courses where id = p_course_id and (club_id is null or club_id = p_organization_id) and (club_id is not null or is_published = true)) then raise exception 'COURSE_NOT_FOUND'; end if;
  insert into public.class_course_assignments (class_id, course_id, assigned_by) values (p_class_id, p_course_id, uid) on conflict (class_id, course_id) do update set assigned_by = excluded.assigned_by;
  result := jsonb_build_object('classId', p_class_id, 'class_id', p_class_id, 'resourceId', p_course_id, 'resource_id', p_course_id, 'organizationId', p_organization_id, 'organization_id', p_organization_id);
  insert into public.organization_operation_idempotency(actor_id, operation, idempotency_key, request_hash, response_payload, completed_at) values (uid, 'assign_organization_course', p_idempotency_key, request_hash, result, now());
  perform private.organization_audit(p_organization_id, uid, 'course_assigned', 'class', p_class_id, jsonb_build_object('course_id', p_course_id), p_idempotency_key);
  return result;
end; $$;

create or replace function public.assign_organization_material_transaction(
  p_organization_id uuid, p_class_id uuid, p_material_id uuid, p_idempotency_key text, p_actor_id uuid
)
returns jsonb language plpgsql security definer set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); result jsonb; existing jsonb; version_id uuid; placement_id uuid; request_hash text;
begin
  if uid is null or p_actor_id is distinct from uid or not private.organization_can_academic_admin(p_organization_id, uid) then raise exception 'FORBIDDEN'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  request_hash := encode(digest(concat_ws('|', p_organization_id, p_class_id, p_material_id), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('assign_material:' || p_class_id::text || ':' || p_material_id::text || ':' || p_idempotency_key, 0));
  existing := private.organization_idempotency_lookup(uid, 'assign_organization_material', p_idempotency_key, request_hash);
  if existing is not null then return existing; end if;
  if not exists (select 1 from public.classes where id = p_class_id and club_id = p_organization_id) then raise exception 'CLASS_ORGANIZATION_MISMATCH'; end if;
  if not exists (select 1 from public.lms_materials where id = p_material_id and club_id = p_organization_id) then raise exception 'MATERIAL_NOT_FOUND'; end if;
  select id into version_id from public.lms_material_versions where material_id = p_material_id and processing_status = 'ready' order by version_number desc limit 1;
  if version_id is null then raise exception 'MATERIAL_VERSION_NOT_READY'; end if;
  select id into placement_id from public.lms_material_placements where material_id = p_material_id and target_type = 'class' and class_id = p_class_id limit 1;
  if placement_id is null then
    insert into public.lms_material_placements (material_id, version_id, club_id, target_type, class_id, status, created_by) values (p_material_id, version_id, p_organization_id, 'class', p_class_id, 'draft', uid) returning id into placement_id;
  end if;
  result := jsonb_build_object('classId', p_class_id, 'class_id', p_class_id, 'resourceId', p_material_id, 'resource_id', p_material_id, 'organizationId', p_organization_id, 'organization_id', p_organization_id);
  insert into public.organization_operation_idempotency(actor_id, operation, idempotency_key, request_hash, response_payload, completed_at) values (uid, 'assign_organization_material', p_idempotency_key, request_hash, result, now());
  perform private.organization_audit(p_organization_id, uid, 'material_assigned', 'class', p_class_id, jsonb_build_object('material_id', p_material_id, 'placement_id', placement_id), p_idempotency_key);
  return result;
end; $$;

revoke all on function public.create_organization_class_transaction(uuid, uuid, text, text, text, text, text, text, date, date, text, text, integer, text, uuid), public.assign_organization_teacher_transaction(uuid, uuid, uuid, text, text, uuid), public.assign_organization_course_transaction(uuid, uuid, uuid, text, text, uuid), public.assign_organization_material_transaction(uuid, uuid, uuid, text, uuid) from public, anon;
grant execute on function public.create_organization_class_transaction(uuid, uuid, text, text, text, text, text, text, date, date, text, text, integer, text, uuid), public.assign_organization_teacher_transaction(uuid, uuid, uuid, text, text, uuid), public.assign_organization_course_transaction(uuid, uuid, uuid, text, text, uuid), public.assign_organization_material_transaction(uuid, uuid, uuid, text, uuid) to authenticated;

commit;
