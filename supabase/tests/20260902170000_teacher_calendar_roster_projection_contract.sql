begin;
select plan(20);

select has_function('public', 'load_teacher_calendar_roster', array['uuid', 'uuid', 'date']);
select function_lang_is('public', 'load_teacher_calendar_roster', array['uuid', 'uuid', 'date'], 'plpgsql');
select ok((select p.prosecdef from pg_proc p where p.oid = to_regprocedure('public.load_teacher_calendar_roster(uuid,uuid,date)')), 'roster RPC is security definer');
select ok((select p.proconfig @> array['search_path=public, private'] from pg_proc p where p.oid = to_regprocedure('public.load_teacher_calendar_roster(uuid,uuid,date)')), 'roster RPC pins search path');
select function_privs_are('public', 'load_teacher_calendar_roster', array['uuid', 'uuid', 'date'], 'authenticated', array['EXECUTE']);
select function_privs_are('public', 'load_teacher_calendar_roster', array['uuid', 'uuid', 'date'], 'anon', array[]::text[]);
select is(
  (select array_agg(parameter_name::text order by ordinal_position)
   from information_schema.parameters
   where specific_schema='public'
     and specific_name like 'load_teacher_calendar_roster%'
     and parameter_mode='OUT'),
  array['user_id', 'display_name', 'enrollment_status', 'attendance_status']::text[],
  'roster projection exposes only safe fields'
);
select ok(position('email' in pg_get_function_result(to_regprocedure('public.load_teacher_calendar_roster(uuid,uuid,date)'))) = 0, 'projection excludes email');
select has_function('public', 'teacher_workspace_reschedule_occurrence', array['uuid', 'timestamp with time zone', 'timestamp with time zone', 'text', 'timestamp with time zone', 'text']);
select function_lang_is('public', 'teacher_workspace_reschedule_occurrence', array['uuid', 'timestamp with time zone', 'timestamp with time zone', 'text', 'timestamp with time zone', 'text'], 'plpgsql');
select ok((select p.prosecdef from pg_proc p where p.oid = to_regprocedure('public.teacher_workspace_reschedule_occurrence(uuid,timestamptz,timestamptz,text,timestamptz,text)')), 'occurrence reschedule RPC is security definer');
select ok((select p.proconfig @> array['search_path=public, private'] from pg_proc p where p.oid = to_regprocedure('public.teacher_workspace_reschedule_occurrence(uuid,timestamptz,timestamptz,text,timestamptz,text)')), 'occurrence reschedule RPC pins search path');
select function_privs_are('public', 'teacher_workspace_reschedule_occurrence', array['uuid', 'timestamp with time zone', 'timestamp with time zone', 'text', 'timestamp with time zone', 'text'], 'authenticated', array['EXECUTE']);
select function_privs_are('public', 'teacher_workspace_reschedule_occurrence', array['uuid', 'timestamp with time zone', 'timestamp with time zone', 'text', 'timestamp with time zone', 'text'], 'anon', array[]::text[]);

-- Executable scope/concurrency smoke fixtures.  Everything is rolled back below.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('17000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'calendar-teacher@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('17000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'calendar-student@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('17000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'calendar-unassigned@example.test', 'x', now(), now(), now(), '{}', '{}')
on conflict (id) do nothing;
insert into public.profiles (id, email, display_name, role) values
  ('17000000-0000-0000-0000-000000000001', 'calendar-teacher@example.test', 'Calendar Teacher', 'teacher'),
  ('17000000-0000-0000-0000-000000000002', 'calendar-student@example.test', 'Calendar Student', 'student'),
  ('17000000-0000-0000-0000-000000000003', 'calendar-unassigned@example.test', 'Unassigned Teacher', 'teacher')
on conflict (id) do nothing;
update public.profiles
set role = case
    when id = '17000000-0000-0000-0000-000000000002' then 'student'
    else 'teacher'
  end,
  display_name = case id
    when '17000000-0000-0000-0000-000000000001' then 'Calendar Teacher'
    when '17000000-0000-0000-0000-000000000002' then 'Calendar Student'
    else 'Unassigned Teacher'
  end
where id in (
  '17000000-0000-0000-0000-000000000001',
  '17000000-0000-0000-0000-000000000002',
  '17000000-0000-0000-0000-000000000003'
);
insert into public.clubs (id, code, name, owner_user_id, status) values ('17000000-0000-0000-0000-000000000010', 'CAL-1700', 'Calendar Test Org', '17000000-0000-0000-0000-000000000001', 'active') on conflict (id) do nothing;
insert into public.club_memberships (club_id, user_id, role, status, joined_at) values
  ('17000000-0000-0000-0000-000000000010', '17000000-0000-0000-0000-000000000001', 'teacher', 'active', now()),
  ('17000000-0000-0000-0000-000000000010', '17000000-0000-0000-0000-000000000002', 'student', 'active', now()),
  ('17000000-0000-0000-0000-000000000010', '17000000-0000-0000-0000-000000000003', 'teacher', 'active', now()) on conflict do nothing;
insert into public.classes (id, club_id, code, title, status, program_type, teacher_user_id, created_by) values ('17000000-0000-0000-0000-000000000020', '17000000-0000-0000-0000-000000000010', 'CAL-A', 'Calendar A', 'active', 'ielts', null, '17000000-0000-0000-0000-000000000001') on conflict (id) do nothing;
insert into public.courses (id, title, slug, category, difficulty, is_published, visibility, created_by) values ('17000000-0000-0000-0000-000000000040', 'Calendar Course', 'calendar-course-1700', 'ielts', 'beginner', true, 'class_restricted', '17000000-0000-0000-0000-000000000001') on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title) values ('17000000-0000-0000-0000-000000000041', '17000000-0000-0000-0000-000000000040', 'Calendar Module') on conflict (id) do nothing;
insert into public.lessons (id, module_id, title, slug, type, content) values ('17000000-0000-0000-0000-000000000042', '17000000-0000-0000-0000-000000000041', 'Calendar Lesson', 'calendar-lesson-1700', 'article', '{}') on conflict (id) do nothing;
insert into public.class_course_assignments (class_id, course_id, assigned_by) values ('17000000-0000-0000-0000-000000000020', '17000000-0000-0000-0000-000000000040', '17000000-0000-0000-0000-000000000001') on conflict do nothing;
insert into public.class_memberships (class_id, user_id, member_role, status, joined_at, created_by) values
  ('17000000-0000-0000-0000-000000000020', '17000000-0000-0000-0000-000000000001', 'teacher', 'active', now(), '17000000-0000-0000-0000-000000000001'),
  ('17000000-0000-0000-0000-000000000020', '17000000-0000-0000-0000-000000000002', 'student', 'active', now(), '17000000-0000-0000-0000-000000000001') on conflict do nothing;
update public.classes
set teacher_user_id = '17000000-0000-0000-0000-000000000001'
where id = '17000000-0000-0000-0000-000000000020';
insert into public.lms_lesson_occurrences (id, club_id, class_id, course_id, lesson_id, occurrence_date, starts_at, ends_at, title, status, published_at, created_by)
values ('17000000-0000-0000-0000-000000000030', '17000000-0000-0000-0000-000000000010', '17000000-0000-0000-0000-000000000020', '17000000-0000-0000-0000-000000000040', '17000000-0000-0000-0000-000000000042', '2026-09-02', '2026-09-02 13:00+00', '2026-09-02 14:00+00', 'Calendar lesson', 'scheduled', now(), '17000000-0000-0000-0000-000000000001');
set local role authenticated;
set local request.jwt.claim.sub = '17000000-0000-0000-0000-000000000001';
select is((select count(*)::integer from public.load_teacher_calendar_roster('17000000-0000-0000-0000-000000000020', '17000000-0000-0000-0000-000000000030', '2026-09-02')), 1, 'assigned manager receives exact occurrence roster');
select ok((select display_name from public.load_teacher_calendar_roster('17000000-0000-0000-0000-000000000020', '17000000-0000-0000-0000-000000000030', '2026-09-02') limit 1) = 'Calendar Student', 'roster projection returns safe identity');
set local request.jwt.claim.sub = '17000000-0000-0000-0000-000000000003';
select throws_ok($$select * from public.load_teacher_calendar_roster('17000000-0000-0000-0000-000000000020', '17000000-0000-0000-0000-000000000030', '2026-09-02')$$, 'FORBIDDEN', 'unassigned teacher cannot read roster');
set local request.jwt.claim.sub = '17000000-0000-0000-0000-000000000001';
select lives_ok($$select public.teacher_workspace_reschedule_occurrence('17000000-0000-0000-0000-000000000030', '2026-09-02 14:00+00', '2026-09-02 15:00+00', 'UTC', (select updated_at from public.lms_lesson_occurrences where id = '17000000-0000-0000-0000-000000000030'), 'calendar-occurrence-1700')$$, 'assigned teacher can reschedule occurrence');
select is((select starts_at from public.lms_lesson_occurrences where id = '17000000-0000-0000-0000-000000000030'), '2026-09-02 14:00:00+00'::timestamptz, 'occurrence start persisted');
select throws_ok($$select public.teacher_workspace_reschedule_occurrence('17000000-0000-0000-0000-000000000030', '2026-09-02 15:00+00', '2026-09-02 16:00+00', 'UTC', '2000-01-01 00:00+00', 'calendar-occurrence-stale')$$, 'STALE_UPDATE', 'stale occurrence token is rejected');

select * from finish();
rollback;
