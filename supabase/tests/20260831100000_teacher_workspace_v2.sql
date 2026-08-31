-- Two-organization RLS and scope matrix for teacher_workspace_v2.
begin;

select plan(23);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000001001', 'authenticated', 'authenticated', 'tw-owner@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000001002', 'authenticated', 'authenticated', 'tw-teacher@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000001003', 'authenticated', 'authenticated', 'tw-unassigned@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000001004', 'authenticated', 'authenticated', 'tw-student@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000001005', 'authenticated', 'authenticated', 'tw-other-org@example.test', 'x', now(), now(), now(), '{}', '{}')
on conflict (id) do nothing;

update public.profiles
set role = case id
  when '00000000-0000-0000-0000-000000001001'::uuid then 'teacher'
  when '00000000-0000-0000-0000-000000001002'::uuid then 'teacher'
  when '00000000-0000-0000-0000-000000001003'::uuid then 'teacher'
  when '00000000-0000-0000-0000-000000001005'::uuid then 'teacher'
  else 'student'
end
where id in (
  '00000000-0000-0000-0000-000000001001'::uuid,
  '00000000-0000-0000-0000-000000001002'::uuid,
  '00000000-0000-0000-0000-000000001003'::uuid,
  '00000000-0000-0000-0000-000000001004'::uuid,
  '00000000-0000-0000-0000-000000001005'::uuid
);

insert into public.clubs (id, code, name, owner_user_id, status)
values
  ('00000000-0000-0000-0000-000000001101', 'TW-A', 'Teacher Workspace A', '00000000-0000-0000-0000-000000001001', 'active'),
  ('00000000-0000-0000-0000-000000001102', 'TW-B', 'Teacher Workspace B', null, 'active')
on conflict (id) do nothing;

insert into public.club_memberships (club_id, user_id, role, status, joined_at)
values
  ('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000001001', 'owner', 'active', '2026-01-01'),
  ('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000001002', 'teacher', 'active', '2026-01-01'),
  ('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000001003', 'teacher', 'active', '2026-01-01'),
  ('00000000-0000-0000-0000-000000001102', '00000000-0000-0000-0000-000000001005', 'teacher', 'active', '2026-01-01')
on conflict do nothing;

insert into public.classes (id, club_id, code, title, status, grade_level, program_type, created_by)
values
  ('00000000-0000-0000-0000-000000001201', '00000000-0000-0000-0000-000000001101', 'TW-I', 'Teacher IELTS', 'active', 'Foundation', 'ielts', '00000000-0000-0000-0000-000000001001'),
  ('00000000-0000-0000-0000-000000001202', '00000000-0000-0000-0000-000000001101', 'TW-D', 'Teacher Debate', 'active', 'Beginner', 'debate', '00000000-0000-0000-0000-000000001001'),
  ('00000000-0000-0000-0000-000000001203', '00000000-0000-0000-0000-000000001102', 'TW-P', 'Other Organization Speaking', 'active', 'Beginner', 'public_speaking', '00000000-0000-0000-0000-000000001001');

insert into public.class_memberships (class_id, user_id, member_role, status, joined_at, created_by)
values
  ('00000000-0000-0000-0000-000000001201', '00000000-0000-0000-0000-000000001002', 'teacher', 'active', '2026-01-01', '00000000-0000-0000-0000-000000001001'),
  ('00000000-0000-0000-0000-000000001201', '00000000-0000-0000-0000-000000001004', 'student', 'active', '2026-01-01', '00000000-0000-0000-0000-000000001001'),
  ('00000000-0000-0000-0000-000000001202', '00000000-0000-0000-0000-000000001004', 'student', 'active', '2026-01-01', '00000000-0000-0000-0000-000000001001'),
  ('00000000-0000-0000-0000-000000001202', '00000000-0000-0000-0000-000000001003', 'teacher', 'active', '2026-01-01', '00000000-0000-0000-0000-000000001001'),
  ('00000000-0000-0000-0000-000000001203', '00000000-0000-0000-0000-000000001005', 'teacher', 'active', '2026-01-01', '00000000-0000-0000-0000-000000001001');

update public.classes set teacher_user_id = '00000000-0000-0000-0000-000000001002' where id = '00000000-0000-0000-0000-000000001201';
update public.classes set teacher_user_id = '00000000-0000-0000-0000-000000001003' where id = '00000000-0000-0000-0000-000000001202';
update public.classes set teacher_user_id = '00000000-0000-0000-0000-000000001005' where id = '00000000-0000-0000-0000-000000001203';

insert into public.lms_pilot_flags (club_id, feature_key, enabled, enabled_by, enabled_at)
values
  ('00000000-0000-0000-0000-000000001101', 'teacher_workspace_v2', true, '00000000-0000-0000-0000-000000001001', now()),
  ('00000000-0000-0000-0000-000000001102', 'teacher_workspace_v2', false, '00000000-0000-0000-0000-000000001001', now());

insert into public.courses (id, title, slug, category, difficulty, is_published, visibility, created_by)
values ('00000000-0000-0000-0000-000000001301', 'Teacher Workspace Course', 'teacher-workspace-course', 'debate', 'beginner', true, 'class_restricted', '00000000-0000-0000-0000-000000001001')
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title)
values ('00000000-0000-0000-0000-000000001401', '00000000-0000-0000-0000-000000001301', 'Workspace Module')
on conflict (id) do nothing;
insert into public.lessons (id, module_id, title, slug, type, content)
values ('00000000-0000-0000-0000-000000001501', '00000000-0000-0000-0000-000000001401', 'Workspace Lesson', 'workspace-lesson', 'article', '{}')
on conflict (id) do nothing;
insert into public.class_course_assignments (class_id, course_id, assigned_by, metadata)
values
  ('00000000-0000-0000-0000-000000001201', '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001001', '{}'),
  ('00000000-0000-0000-0000-000000001202', '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001001', '{}'),
  ('00000000-0000-0000-0000-000000001203', '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001001', '{}')
on conflict do nothing;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000001001';
select ok(private.teacher_workspace_enabled('00000000-0000-0000-0000-000000001101', null), 'organization flag enables teacher workspace');
select ok(not private.teacher_workspace_enabled('00000000-0000-0000-0000-000000001102', null), 'disabled organization flag stays disabled');
select ok(private.can_access_teacher_workspace('00000000-0000-0000-0000-000000001201', auth.uid()), 'organization owner can access every enabled class');
select ok(private.has_teacher_ielts_entitlement(auth.uid(), '00000000-0000-0000-0000-000000001101'), 'IELTS entitlement is derived from assigned/managed IELTS class');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000001002';
select ok(private.can_access_teacher_workspace('00000000-0000-0000-0000-000000001201', auth.uid()), 'assigned teacher can access exact class');
select ok(not private.can_access_teacher_workspace('00000000-0000-0000-0000-000000001202', auth.uid()), 'assigned teacher cannot access another class');
select ok(private.has_teacher_ielts_entitlement(auth.uid(), '00000000-0000-0000-0000-000000001101'), 'assigned IELTS class grants teacher IELTS entitlement');
select is((select count(*)::integer from public.lms_pilot_flags where feature_key = 'teacher_workspace_v2'), 1, 'assigned teacher can resolve own organization feature flag only');
select is((select count(*)::integer from public.teacher_workspace_class_preferences), 0, 'assigned teacher cannot read another teacher color preferences');

insert into public.teacher_workspace_preferences (user_id) values (auth.uid());
insert into public.teacher_workspace_class_preferences (user_id, class_id, color_token)
values (auth.uid(), '00000000-0000-0000-0000-000000001201', 'teal');
select is((select color_token from public.teacher_workspace_class_preferences where user_id = auth.uid()), 'teal', 'teacher can persist own class color');
select throws_ok(
  $$insert into public.teacher_workspace_class_preferences (user_id, class_id) values (auth.uid(), '00000000-0000-0000-0000-000000001202')$$,
  '42501', null, 'teacher cannot write an unassigned class color'
);

reset role;
select lives_ok(
  $$insert into public.lms_announcements (
      id, club_id, class_id, title, body, status, published_at, created_by
    ) values (
      '00000000-0000-0000-0000-000000001701',
      '00000000-0000-0000-0000-000000001101',
      '00000000-0000-0000-0000-000000001202',
      'Debate update', 'Prepare your rebuttal.', 'published', now(),
      '00000000-0000-0000-0000-000000001003'
    )$$,
  'teacher workspace accepts a published Debate announcement'
);
select lives_ok(
  $$with resource as (
      insert into public.lms_resources (
        id, club_id, scope_class_id, title, kind, url, provenance,
        license_status, status, created_by, published_at
      ) values (
        '00000000-0000-0000-0000-000000001702',
        '00000000-0000-0000-0000-000000001101',
        '00000000-0000-0000-0000-000000001202',
        'Debate worksheet', 'link', 'https://example.test/debate',
        'Original demo fixture', 'approved', 'published',
        '00000000-0000-0000-0000-000000001003', now()
      )
      returning id
    )
    insert into public.lms_resource_assignments (
      resource_id, class_id, assigned_by
    ) select id, '00000000-0000-0000-0000-000000001202',
      '00000000-0000-0000-0000-000000001003' from resource$$,
  'teacher workspace accepts a class-scoped Debate resource'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000001004';
select is(
  (select count(*)::integer from public.lms_announcements where id = '00000000-0000-0000-0000-000000001701'),
  1,
  'exact-class student reads the published Debate announcement'
);
select is(
  (select count(*)::integer from public.lms_resources where id = '00000000-0000-0000-0000-000000001702'),
  1,
  'exact-class student reads the published Debate resource'
);
select is(
  (select count(*)::integer from public.classes where id = '00000000-0000-0000-0000-000000001203'),
  0,
  'student cannot read a class in another organization'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000001003';
select ok(private.can_access_teacher_workspace('00000000-0000-0000-0000-000000001202', auth.uid()), 'second teacher can access its assigned class');
select ok(not private.has_teacher_ielts_entitlement(auth.uid(), '00000000-0000-0000-0000-000000001101'), 'non-IELTS assignment does not grant IELTS entitlement');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000001005';
select ok(not private.can_access_teacher_workspace('00000000-0000-0000-0000-000000001203', auth.uid()), 'disabled organization blocks workspace access');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000001004';
select ok(not private.can_access_teacher_workspace('00000000-0000-0000-0000-000000001201', auth.uid()), 'student has no teacher workspace access');
select throws_ok(
  $$insert into public.teacher_workspace_preferences (user_id) values (auth.uid())$$,
  '42501', null, 'student cannot create teacher preferences'
);

-- Enabled Debate and Public Speaking occurrences use the new teacher flag while
-- preserving class/course/date scope.  These are inserted as postgres to test
-- the trigger independently of Data API write policies.
reset role;
insert into public.lms_lesson_occurrences (
  id, club_id, class_id, course_id, lesson_id, occurrence_date,
  starts_at, ends_at, timezone, title, created_by
)
values
  ('00000000-0000-0000-0000-000000001601', '00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000001202', '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001501', '2026-09-01', '2026-09-01 13:00+00', '2026-09-01 14:00+00', 'UTC', 'Debate occurrence', '00000000-0000-0000-0000-000000001001');
select is((select count(*)::integer from public.lms_lesson_occurrences where id = '00000000-0000-0000-0000-000000001601'), 1, 'debate occurrence is accepted under teacher workspace');

select throws_ok(
  $$insert into public.lms_lesson_occurrences (
    club_id, class_id, course_id, lesson_id, occurrence_date, starts_at, ends_at, timezone, title, created_by
  ) values (
    '00000000-0000-0000-0000-000000001102', '00000000-0000-0000-0000-000000001203', '00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000001501', '2026-09-01', '2026-09-01 13:00+00', '2026-09-01 14:00+00', 'UTC', 'Disabled occurrence', '00000000-0000-0000-0000-000000001001'
  )$$,
  null, null, 'disabled organization rejects occurrence creation'
);

select * from finish();
rollback;
