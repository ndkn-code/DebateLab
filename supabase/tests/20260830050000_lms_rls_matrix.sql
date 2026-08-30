-- Two-organization RLS matrix for the IELTS LMS contracts.
--
-- This test deliberately seeds as postgres, then changes to the Data API role
-- and supplies request.jwt.claim.sub for every read.  The entire fixture is
-- rolled back at the end; it never resets or mutates the shared database.
begin;

select plan(43);

-- Stable identities make the matrix readable and keep auth.uid() assertions
-- independent of any existing local seed data.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'lms-admin@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'lms-owner@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'lms-assigned@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'lms-unassigned@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'lms-active@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'lms-removed@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'lms-class-b@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'lms-org-b@example.test', 'x', now(), now(), now(), '{}', '{}');

update public.profiles
set role = case id
  when '00000000-0000-0000-0000-000000000001'::uuid then 'admin'
  when '00000000-0000-0000-0000-000000000002'::uuid then 'teacher'
  when '00000000-0000-0000-0000-000000000003'::uuid then 'teacher'
  when '00000000-0000-0000-0000-000000000004'::uuid then 'teacher'
  else 'student'
end,
display_name = 'LMS matrix ' || right(id::text, 2)
where id in (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000004'::uuid,
  '00000000-0000-0000-0000-000000000005'::uuid,
  '00000000-0000-0000-0000-000000000006'::uuid,
  '00000000-0000-0000-0000-000000000007'::uuid,
  '00000000-0000-0000-0000-000000000008'::uuid
);

insert into public.clubs (id, code, name, owner_user_id, status)
values
  ('00000000-0000-0000-0000-000000000101', 'RLS-A', 'RLS Organization A', '00000000-0000-0000-0000-000000000002', 'active'),
  ('00000000-0000-0000-0000-000000000102', 'RLS-B', 'RLS Organization B', null, 'active');

insert into public.club_memberships (club_id, user_id, role, status, joined_at)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', 'owner', 'active', '2024-01-01'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000003', 'coach', 'active', '2024-01-01'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000004', 'coach', 'active', '2024-01-01');

insert into public.classes (
  id, club_id, code, title, status, grade_level, program_type,
  teacher_user_id, created_by
)
values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'RLS-A1', 'RLS Class A', 'active', 'Band 5-6', 'ielts', null, '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000101', 'RLS-A2', 'RLS Class B', 'active', 'Band 5-6', 'ielts', null, '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000102', 'RLS-B1', 'RLS Organization B Class', 'active', 'Band 5-6', 'ielts', null, '00000000-0000-0000-0000-000000000001');

insert into public.class_memberships (
  class_id, user_id, member_role, status, joined_at, created_by
)
values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000003', 'teacher', 'active', '2024-01-01', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000005', 'student', 'active', '2024-01-01', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000006', 'student', 'active', '2024-01-01', '00000000-0000-0000-0000-000000000001');

insert into public.class_memberships (
  class_id, user_id, member_role, status, joined_at, created_by
)
values
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000007', 'student', 'active', '2024-01-01', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000008', 'student', 'active', '2024-01-01', '00000000-0000-0000-0000-000000000001');

update public.classes
set teacher_user_id = '00000000-0000-0000-0000-000000000003'
where id = '00000000-0000-0000-0000-000000000201';

insert into public.lms_pilot_flags (club_id, feature_key, enabled, enabled_by, enabled_at)
values
  ('00000000-0000-0000-0000-000000000101', 'ielts_lms_pilot_v1', true, '00000000-0000-0000-0000-000000000001', now()),
  ('00000000-0000-0000-0000-000000000102', 'ielts_lms_pilot_v1', true, '00000000-0000-0000-0000-000000000001', now());

insert into public.courses (id, title, slug, category, difficulty, is_published, visibility, created_by)
values ('00000000-0000-0000-0000-000000000301', 'RLS IELTS Course', 'rls-ielts-course', 'ielts', 'beginner', true, 'class_restricted', '00000000-0000-0000-0000-000000000001');
insert into public.course_modules (id, course_id, title)
values ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301', 'RLS Module');
insert into public.lessons (id, module_id, title, slug, type, content)
values ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000401', 'RLS Lesson', 'rls-lesson', 'article', '{}');

insert into public.class_course_assignments (class_id, course_id, assigned_by, metadata)
values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '{"class":"A"}'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '{"class":"B"}'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '{"org":"B"}');

insert into public.club_assignments (
  id, club_id, class_id, title, assignment_type, assigned_track, status,
  created_by, metadata
)
values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', 'RLS Assignment A', 'practice', 'ielts', 'active', '00000000-0000-0000-0000-000000000001', '{"class":"A"}'),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202', 'RLS Assignment B', 'practice', 'ielts', 'active', '00000000-0000-0000-0000-000000000001', '{"class":"B"}'),
  ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000203', 'RLS Assignment Org B', 'practice', 'ielts', 'active', '00000000-0000-0000-0000-000000000001', '{"org":"B"}');

insert into public.lms_lesson_occurrences (
  id, club_id, class_id, course_id, lesson_id, occurrence_date,
  starts_at, ends_at, title, status, published_at, created_by
)
values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000501', '2024-01-15', '2024-01-15 01:00+00', '2024-01-15 02:00+00', 'RLS A published', 'completed', '2024-01-10', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000501', '2024-01-16', '2024-01-16 01:00+00', '2024-01-16 02:00+00', 'RLS A unpublished', 'scheduled', null, '00000000-0000-0000-0000-000000000001');

insert into public.lms_occurrence_assignments (occurrence_id, assignment_id, added_by)
values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000705', '00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000001');

insert into public.class_attendance_sessions (
  id, class_id, course_id, occurrence_id, session_date, title, taken_by
)
values
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000701', '2024-01-15', 'RLS A attendance', '00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000702', '2024-01-16', 'RLS A hidden attendance', '00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000703', '2999-01-15', 'RLS A future attendance', '00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000804', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000704', '2024-01-15', 'RLS B attendance', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000805', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000705', '2024-01-15', 'RLS Org B attendance', '00000000-0000-0000-0000-000000000001');

insert into public.class_attendance_records (session_id, user_id, status)
values
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000005', 'present'),
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000006', 'absent'),
  ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000005', 'late'),
  ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000006', 'present'),
  ('00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000005', 'present'),
  ('00000000-0000-0000-0000-000000000804', '00000000-0000-0000-0000-000000000007', 'present'),
  ('00000000-0000-0000-0000-000000000805', '00000000-0000-0000-0000-000000000008', 'present');

-- Remove the learner after the first two Class A occurrences.  The trigger
-- changes only those immutable snapshots to removed_after_occurrence.
update public.class_memberships
set status = 'removed', removed_at = '2024-02-01'
where class_id = '00000000-0000-0000-0000-000000000201'
  and user_id = '00000000-0000-0000-0000-000000000006'
  and member_role = 'student';

-- These rows are created after removal, so the removed learner is not in a
-- future roster snapshot.
insert into public.lms_lesson_occurrences (
  id, club_id, class_id, course_id, lesson_id, occurrence_date,
  starts_at, ends_at, title, status, published_at, created_by
)
values
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000501', '2999-01-15', '2999-01-15 01:00+00', '2999-01-15 02:00+00', 'RLS A future', 'scheduled', '2024-01-10', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000501', '2024-01-15', '2024-01-15 02:00+00', '2024-01-15 03:00+00', 'RLS B published', 'completed', '2024-01-10', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000705', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000501', '2024-01-15', '2024-01-15 03:00+00', '2024-01-15 04:00+00', 'RLS Org B published', 'completed', '2024-01-10', '00000000-0000-0000-0000-000000000001');

-- One published criterion-feedback row exercises the private source-table
-- policy and the learner-visible published projection.
insert into public.ielts_tests (id, slug, title, kind, module, status, assessment_mode, author_id, published_at)
values ('00000000-0000-0000-0000-000000000901', 'rls-feedback-test', 'RLS Feedback Test', 'full_mock', 'academic', 'published', 'simulation', '00000000-0000-0000-0000-000000000001', '2024-01-10');
insert into public.ielts_questions (id, test_id, skill, question_type, prompt)
values ('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000901', 'writing', 'writing_task2_essay', 'RLS feedback prompt');
insert into public.ielts_attempts (
  id, user_id, test_id, status, club_id, class_id, assignment_id,
  started_at, submitted_at, completed_at
)
values (
  '00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000901', 'completed',
  '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000601',
  '2024-01-15', '2024-01-15', '2024-01-15'
);
insert into public.writing_responses (id, attempt_id, user_id, question_id, task_number, essay, word_count, status)
values ('00000000-0000-0000-0000-000000000904', '00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000902', 2, 'RLS essay', 2, 'scored');
insert into public.ielts_teacher_reviews (
  id, attempt_id, user_id, club_id, class_id, assignment_id,
  writing_response_id, review_kind, revision, task_number, reviewer_id,
  task_band, criterion_feedback, status, published_at
)
values (
  '00000000-0000-0000-0000-000000000905', '00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000904', 'writing', 0, 2, '00000000-0000-0000-0000-000000000003',
  6.0, '{"taskResponse":"Clear thesis"}', 'published', '2024-01-16'
);

-- The production policies evaluate these two tables in cross-table
-- predicates.  Some local migration snapshots intentionally revoke their
-- direct Data API grants, so provide the minimal predicate privileges only
-- inside this rolled-back fixture; RLS remains the authorization boundary.
grant select on public.class_memberships, public.class_attendance_sessions
  to authenticated;

-- Every matrix read is made through the role/payload path used by PostgREST.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select is(auth.uid()::text, '00000000-0000-0000-0000-000000000001', 'request.jwt.claim.sub drives auth.uid()');
select is((select count(*)::integer from public.lms_lesson_occurrences), 5, 'platform admin sees all organizations and occurrence states');
select is((select count(*)::integer from public.lms_occurrence_assignments), 5, 'platform admin sees all occurrence assignment links');
select is((select count(*)::integer from public.club_assignments), 3, 'platform admin sees all class assignment metadata');
select is((select count(*)::integer from public.lms_occurrence_roster_snapshots), 7, 'platform admin sees all immutable roster snapshots');
select is((select count(*)::integer from public.class_attendance_sessions), 5, 'platform admin sees all attendance sessions');
select is((select count(*)::integer from public.class_attendance_records), 7, 'platform admin sees all attendance rows');
select is((select count(*)::integer from public.ielts_teacher_reviews where status = 'published'), 1, 'platform admin sees published teacher feedback');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.lms_lesson_occurrences), 4, 'Org A owner sees Class A and Class B only');
select is((select count(*)::integer from public.lms_occurrence_assignments), 4, 'Org A owner sees Org A occurrence assignment links only');
select is((select count(*)::integer from public.club_assignments), 2, 'Org A owner sees Class A and Class B assignment metadata only');
select is((select count(*)::integer from public.lms_occurrence_roster_snapshots), 6, 'Org A owner sees Org A snapshots only');
select is((select count(*)::integer from public.class_attendance_sessions), 4, 'Org A owner sees Org A attendance sessions only');
select is((select count(*)::integer from public.class_attendance_records), 6, 'Org A owner sees Org A attendance rows only');
select is((select count(*)::integer from public.ielts_teacher_reviews where status = 'published'), 1, 'Org A owner sees Class A published feedback');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select is((select count(*)::integer from public.lms_lesson_occurrences), 3, 'Assigned Class A teacher sees Class A occurrence states');
select is((select count(*)::integer from public.lms_occurrence_assignments), 3, 'Assigned Class A teacher sees Class A assignment links');
select is((select count(*)::integer from public.club_assignments), 1, 'Assigned Class A teacher sees Class A assignment metadata');
select is((select count(*)::integer from public.lms_occurrence_roster_snapshots), 5, 'Assigned Class A teacher sees Class A snapshots');
select is((select count(*)::integer from public.class_attendance_sessions), 3, 'Assigned Class A teacher sees Class A attendance sessions');
select is((select count(*)::integer from public.class_attendance_records), 5, 'Assigned Class A teacher sees Class A attendance rows');
select is((select count(*)::integer from public.ielts_teacher_reviews where status = 'published'), 1, 'Assigned Class A teacher sees published feedback');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select is((select count(*)::integer from public.lms_lesson_occurrences), 0, 'Unassigned Org A coach sees no lesson occurrences');
select is((select count(*)::integer from public.lms_occurrence_assignments), 0, 'Unassigned Org A coach sees no occurrence assignment links');
select is((select count(*)::integer from public.club_assignments), 0, 'Unassigned Org A coach sees no class assignment metadata');
select is((select count(*)::integer from public.lms_occurrence_roster_snapshots), 0, 'Unassigned Org A coach sees no roster snapshots');
select is((select count(*)::integer from public.class_attendance_sessions), 0, 'Unassigned Org A coach sees no attendance sessions');
select is((select count(*)::integer from public.class_attendance_records), 0, 'Unassigned Org A coach sees no attendance rows');
select is((select count(*)::integer from public.ielts_teacher_reviews where status = 'published'), 0, 'Unassigned Org A coach sees no teacher feedback');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
select is((select count(*)::integer from public.lms_lesson_occurrences), 2, 'Active Class A student sees published Class A occurrences including future');
select is((select count(*)::integer from public.lms_occurrence_assignments), 2, 'Active Class A student sees only published Class A assignment links');
select is((select count(*)::integer from public.club_assignments), 1, 'Active Class A student sees only Class A assignment metadata');
select is((select count(*)::integer from public.lms_occurrence_roster_snapshots), 3, 'Active student sees own snapshots only');
select is((select count(*)::integer from public.class_attendance_sessions), 3, 'Active Class A student sees Class A attendance sessions');
select is((select count(*)::integer from public.class_attendance_records), 3, 'Active student sees own Class A attendance rows only');
select is((select count(*)::integer from public.ielts_teacher_reviews where status = 'published'), 1, 'Active student sees own published teacher feedback');

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000006';
select is((select count(*)::integer from public.lms_lesson_occurrences), 1, 'Removed student sees only published past Class A occurrence');
select is((select count(*)::integer from public.lms_occurrence_assignments), 1, 'Removed student sees only historical published assignment link');
select is((select count(*)::integer from public.club_assignments), 1, 'Removed student sees historical Class A assignment metadata');
select is((select count(*)::integer from public.lms_occurrence_roster_snapshots), 2, 'Removed student sees own historical snapshots only');
select is((select count(*)::integer from public.class_attendance_sessions), 2, 'Removed student sees sessions with historical own attendance');
select is((select count(*)::integer from public.class_attendance_records), 2, 'Removed student sees own historical attendance rows only');
select is((select count(*)::integer from public.ielts_teacher_reviews where status = 'published'), 0, 'Removed student cannot see another learner teacher feedback');

rollback;
