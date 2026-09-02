-- Organization curriculum ownership and subject scoping.
-- Global courses (club_id IS NULL) are published templates and are immutable
-- through organization sessions. Organization-owned courses are managed by
-- the organization's academic administrators.

begin;

alter table public.courses add column if not exists club_id uuid references public.clubs(id) on delete cascade;

do $$
declare c record;
begin
  for c in select conname from pg_constraint
    where conrelid = 'public.courses'::regclass
      and (conname = 'courses_subject_check' or pg_get_constraintdef(oid) like '%subject%')
  loop execute format('alter table public.courses drop constraint if exists %I', c.conname); end loop;
  alter table public.courses add constraint courses_subject_check
    check (subject in ('debate', 'ielts', 'public_speaking'));
exception when duplicate_object then null;
end $$;

alter table public.courses drop constraint if exists courses_slug_key;
create unique index if not exists courses_global_slug_key
  on public.courses (slug) where club_id is null;
create unique index if not exists courses_organization_slug_key
  on public.courses (club_id, slug) where club_id is not null;
create index if not exists courses_club_subject_published_idx
  on public.courses (club_id, subject, is_published, is_archived);

-- Published curriculum is readable through RLS. Mutations remain RPC-only so
-- optimistic concurrency, idempotency, and audit cannot be bypassed.
grant select on public.courses, public.course_modules, public.lessons, public.activities to authenticated;
revoke insert, update, delete on public.courses, public.course_modules, public.lessons, public.activities from authenticated;

create or replace function private.can_read_curriculum_course(p_course_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path = public, private, extensions as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course_id and not c.is_archived and (
      (c.club_id is null and c.is_published)
      or (
        c.club_id is not null
        and (
          private.organization_can_academic_admin(c.club_id, p_user_id)
          or (c.is_published and exists (
          select 1 from public.class_course_assignments cca
          join public.class_memberships cm on cm.class_id = cca.class_id
            and cm.user_id = p_user_id and cm.status = 'active'
          where cca.course_id = c.id and exists (
            select 1 from public.classes cl where cl.id = cca.class_id and cl.club_id = c.club_id
          )
          ))
        )
      )
    )
  );
$$;

create or replace function private.can_manage_curriculum_course(p_course_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path = public, private, extensions as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course_id and c.club_id is not null
      and private.organization_can_academic_admin(c.club_id, p_user_id)
  );
$$;

revoke all on function private.can_read_curriculum_course(uuid, uuid), private.can_manage_curriculum_course(uuid, uuid) from public, anon;
grant execute on function private.can_read_curriculum_course(uuid, uuid), private.can_manage_curriculum_course(uuid, uuid) to authenticated;

drop policy if exists "Anyone can view published courses" on public.courses;
drop policy if exists "Admins can manage courses" on public.courses;
drop policy if exists "Curriculum readers can view courses" on public.courses;
drop policy if exists "Organization academic admins manage courses" on public.courses;
create policy "Curriculum readers can view courses" on public.courses for select
  using (private.can_read_curriculum_course(id, (select auth.uid())));
create policy "Organization academic admins manage courses" on public.courses for all
  using (private.can_manage_curriculum_course(id, (select auth.uid())))
  with check (club_id is not null and private.organization_can_academic_admin(club_id, (select auth.uid())));

-- Content children inherit the course boundary. Global content is readable
-- only when its published global course is readable; writes are organization
-- academic-admin-only and cannot reparent into a global course.
create or replace function private.can_read_curriculum_module(p_module_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path = public, private, extensions as $$
  select exists (select 1 from public.course_modules m where m.id = p_module_id
    and private.can_read_curriculum_course(m.course_id, p_user_id));
$$;
create or replace function private.can_manage_curriculum_module(p_module_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path = public, private, extensions as $$
  select exists (select 1 from public.course_modules m where m.id = p_module_id
    and private.can_manage_curriculum_course(m.course_id, p_user_id));
$$;
create or replace function private.can_read_curriculum_lesson(p_lesson_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path = public, private, extensions as $$
  select exists (select 1 from public.lessons l join public.course_modules m on m.id=l.module_id
    where l.id=p_lesson_id and l.is_published and private.can_read_curriculum_course(m.course_id,p_user_id));
$$;
create or replace function private.can_manage_curriculum_lesson(p_lesson_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path = public, private, extensions as $$
  select exists (select 1 from public.lessons l join public.course_modules m on m.id=l.module_id
    where l.id=p_lesson_id and private.can_manage_curriculum_course(m.course_id,p_user_id));
$$;
revoke all on function private.can_read_curriculum_module(uuid,uuid), private.can_manage_curriculum_module(uuid,uuid), private.can_read_curriculum_lesson(uuid,uuid), private.can_manage_curriculum_lesson(uuid,uuid) from public,anon;
grant execute on function private.can_read_curriculum_module(uuid,uuid), private.can_manage_curriculum_module(uuid,uuid), private.can_read_curriculum_lesson(uuid,uuid), private.can_manage_curriculum_lesson(uuid,uuid) to authenticated;

drop policy if exists "Anyone can view course modules" on public.course_modules;
drop policy if exists "Admins can manage course modules" on public.course_modules;
drop policy if exists "Curriculum readers can view modules" on public.course_modules;
drop policy if exists "Academic admins manage modules" on public.course_modules;
create policy "Curriculum readers can view modules" on public.course_modules for select using (private.can_read_curriculum_module(id,(select auth.uid())));
create policy "Academic admins manage modules" on public.course_modules for all using (private.can_manage_curriculum_course(course_id,(select auth.uid()))) with check (private.can_manage_curriculum_course(course_id,(select auth.uid())));

drop policy if exists "Anyone can view published lessons" on public.lessons;
drop policy if exists "Admins can manage lessons" on public.lessons;
drop policy if exists "Curriculum readers can view lessons" on public.lessons;
drop policy if exists "Academic admins manage lessons" on public.lessons;
create policy "Curriculum readers can view lessons" on public.lessons for select using (private.can_read_curriculum_lesson(id,(select auth.uid())));
create policy "Academic admins manage lessons" on public.lessons for all using (private.can_manage_curriculum_lesson(id,(select auth.uid()))) with check (private.can_manage_curriculum_module(module_id,(select auth.uid())));

-- Activities and quiz questions follow their parent lesson/module boundary.
drop policy if exists "Authenticated users can view active activities" on public.activities;
drop policy if exists "Admins can manage activities" on public.activities;
create policy "Curriculum readers can view active activities" on public.activities for select using (
  not is_archived and exists (select 1 from public.course_modules m where m.id=activities.module_id and private.can_read_curriculum_course(m.course_id,(select auth.uid())))
);
create policy "Academic admins manage activities" on public.activities for all using (
  exists (select 1 from public.course_modules m where m.id=activities.module_id and private.can_manage_curriculum_course(m.course_id,(select auth.uid())))
) with check (exists (select 1 from public.course_modules m where m.id=activities.module_id and private.can_manage_curriculum_course(m.course_id,(select auth.uid()))));

drop policy if exists "Anyone can view quiz questions" on public.quiz_questions;
drop policy if exists "Curriculum readers can view quiz questions" on public.quiz_questions;
drop policy if exists "Academic admins manage quiz questions" on public.quiz_questions;
-- The legacy table stores correct_answer beside the prompt. It is therefore
-- never directly selectable by learners; use the safe projection function
-- below for student quiz rendering.
create policy "Curriculum managers can view quiz questions" on public.quiz_questions for select using (
  exists (select 1 from public.lessons l join public.course_modules m on m.id=l.module_id where l.id=quiz_questions.lesson_id and private.can_manage_curriculum_course(m.course_id,(select auth.uid())))
);
create policy "Academic admins manage quiz questions" on public.quiz_questions for all using (
  exists (select 1 from public.lessons l join public.course_modules m on m.id=l.module_id where l.id=quiz_questions.lesson_id and private.can_manage_curriculum_course(m.course_id,(select auth.uid())))
) with check (exists (select 1 from public.lessons l join public.course_modules m on m.id=l.module_id where l.id=quiz_questions.lesson_id and private.can_manage_curriculum_course(m.course_id,(select auth.uid()))));

-- Do not expose the answer-key table through PostgREST at all. Both learners
-- and managers use the safe projection/grading boundaries below.
revoke select on public.quiz_questions from authenticated;

create or replace function public.load_curriculum_quiz_questions(p_lesson_id uuid)
returns table (
  id uuid, lesson_id uuid, question_text text, question_type text,
  options jsonb, order_index integer
)
language sql stable security definer
set search_path = public, private, extensions as $$
  select q.id, q.lesson_id, q.question_text, q.question_type, q.options, q.sort_order as order_index
  from public.quiz_questions q
  where q.lesson_id = p_lesson_id
    and private.can_read_curriculum_lesson(q.lesson_id, (select auth.uid()))
  order by q.sort_order, q.id;
$$;
revoke all on function public.load_curriculum_quiz_questions(uuid) from public, anon;
grant execute on function public.load_curriculum_quiz_questions(uuid) to authenticated;

create or replace function public.grade_curriculum_quiz_submission(p_lesson_id uuid, p_answers jsonb)
returns table (question_id uuid, is_correct boolean, points integer, max_points integer)
language sql stable security definer
set search_path = public, private, extensions as $$
  select q.id,
    coalesce(q.correct_answer = (coalesce(p_answers, '{}'::jsonb) ->> q.id::text), false) as is_correct,
    case when q.correct_answer = (coalesce(p_answers, '{}'::jsonb) ->> q.id::text) then 1 else 0 end as points,
    1 as max_points
  from public.quiz_questions q
  where q.lesson_id = p_lesson_id
    and private.can_read_curriculum_lesson(q.lesson_id, (select auth.uid()))
  order by q.sort_order, q.id;
$$;
revoke all on function public.grade_curriculum_quiz_submission(uuid,jsonb) from public, anon;
grant execute on function public.grade_curriculum_quiz_submission(uuid,jsonb) to authenticated;

create or replace function public.save_organization_course_transaction(p_input jsonb)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions as $$
declare
  uid uuid := auth.uid(); v_id uuid := nullif(p_input->>'courseId','')::uuid;
  org_id uuid := nullif(coalesce(p_input->>'organizationId',p_input->>'clubId'),'')::uuid;
  v_expected timestamptz := nullif(p_input->>'expectedUpdatedAt','')::timestamptz;
  v_key text := nullif(p_input->>'idempotencyKey',''); v_hash text;
  v_result jsonb; v_course public.courses%rowtype;
begin
  if uid is null or org_id is null or not private.organization_can_academic_admin(org_id,uid) then raise exception 'FORBIDDEN'; end if;
  if v_key is null or char_length(v_key) not between 8 and 128 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  v_hash := encode(digest(p_input::text,'sha256'),'hex');
  v_result := private.organization_idempotency_lookup(uid,'save_organization_course',v_key,v_hash);
  if v_result is not null then return v_result; end if;
  perform pg_advisory_xact_lock(hashtextextended('curriculum:'||uid::text||':'||v_key,0));
  if v_id is null then
    insert into public.courses (club_id,title,slug,subject,description,is_published,visibility,created_by)
    values (org_id, btrim(p_input->>'title'), btrim(p_input->>'slug'), coalesce(p_input->>'subject','debate'), p_input->>'description', coalesce((p_input->>'isPublished')::boolean,false),'class_restricted',uid)
    returning * into v_course;
    perform private.organization_audit(org_id,uid,'created','course',v_course.id,p_input,v_key);
  else
    select * into v_course from public.courses where id=v_id for update;
    if not found or v_course.club_id is distinct from org_id or (v_expected is not null and v_course.updated_at is distinct from v_expected) then raise exception 'COURSE_CONFLICT'; end if;
    update public.courses set title=coalesce(nullif(btrim(p_input->>'title'),''),title), slug=coalesce(nullif(btrim(p_input->>'slug'),''),slug), subject=coalesce(p_input->>'subject',subject), description=coalesce(p_input->>'description',description), is_published=coalesce((p_input->>'isPublished')::boolean,is_published), updated_at=now() where id=v_id returning * into v_course;
    perform private.organization_audit(org_id,uid,'updated','course',v_course.id,p_input,v_key);
  end if;
  v_result := jsonb_build_object('courseId',v_course.id,'organizationId',v_course.club_id,'updatedAt',v_course.updated_at,'isPublished',v_course.is_published);
  insert into public.organization_operation_idempotency(actor_id,operation,idempotency_key,request_hash,response_payload,completed_at) values (uid,'save_organization_course',v_key,v_hash,v_result,now());
  return v_result;
end; $$;

create or replace function public.clone_global_course_transaction(p_source_course_id uuid, p_organization_id uuid, p_slug text, p_idempotency_key text)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions as $$
declare uid uuid:=auth.uid(); source public.courses%rowtype; copy public.courses%rowtype; result jsonb; hash text;
begin
  if uid is null or not private.organization_can_academic_admin(p_organization_id,uid) then raise exception 'FORBIDDEN'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 128 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  hash:=encode(digest(concat_ws('|',p_source_course_id,p_organization_id,p_slug),'sha256'),'hex');
  result:=private.organization_idempotency_lookup(uid,'clone_global_course',p_idempotency_key,hash); if result is not null then return result; end if;
  select * into source from public.courses where id=p_source_course_id and club_id is null and is_published;
  if not found then raise exception 'GLOBAL_COURSE_NOT_FOUND'; end if;
  insert into public.courses (club_id,title,slug,subject,description,short_description,category,difficulty,estimated_hours,is_published,visibility,is_free,metadata,created_by)
  values (p_organization_id,source.title,p_slug,source.subject,source.description,source.short_description,source.category,source.difficulty,source.estimated_hours,false,'class_restricted',source.is_free,source.metadata,uid) returning * into copy;
  perform private.organization_audit(p_organization_id,uid,'cloned','course',copy.id,jsonb_build_object('sourceCourseId',source.id),p_idempotency_key);
  result:=jsonb_build_object('courseId',copy.id,'organizationId',copy.club_id,'sourceCourseId',source.id);
  insert into public.organization_operation_idempotency(actor_id,operation,idempotency_key,request_hash,response_payload,completed_at) values(uid,'clone_global_course',p_idempotency_key,hash,result,now()); return result;
end; $$;
revoke all on function public.save_organization_course_transaction(jsonb), public.clone_global_course_transaction(uuid,uuid,text,text) from public, anon;
grant execute on function public.save_organization_course_transaction(jsonb), public.clone_global_course_transaction(uuid,uuid,text,text) to authenticated;

commit;
