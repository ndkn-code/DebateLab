begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

set local role postgres;
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
 ('50000000-0000-4000-8000-000000000001','authenticated','authenticated','attendance-manager@example.test','x',now(),now(),now(),'{}','{}'),
 ('50000000-0000-4000-8000-000000000002','authenticated','authenticated','attendance-student@example.test','x',now(),now(),now(),'{}','{}'),
 ('50000000-0000-4000-8000-000000000003','authenticated','authenticated','attendance-other@example.test','x',now(),now(),now(),'{}','{}')
on conflict (id) do nothing;
insert into public.profiles (id, email, display_name, role)
values
 ('50000000-0000-4000-8000-000000000001','attendance-manager@example.test','Attendance Manager','teacher'),
 ('50000000-0000-4000-8000-000000000002','attendance-student@example.test','Attendance Student','student'),
 ('50000000-0000-4000-8000-000000000003','attendance-other@example.test','Attendance Other','student')
on conflict (id) do nothing;
update public.profiles set role = 'teacher', display_name = 'Attendance Manager' where id = '50000000-0000-4000-8000-000000000001';
update public.profiles set role = 'student' where id in ('50000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003');
insert into public.clubs (id, code, name, owner_user_id)
values ('50000000-0000-4000-8000-000000000101','ATTENDANCE-REGRESSION','Attendance Regression Club','50000000-0000-4000-8000-000000000001');
insert into public.club_memberships (club_id, user_id, role, status)
values ('50000000-0000-4000-8000-000000000101','50000000-0000-4000-8000-000000000001','owner','active');
insert into public.classes (id, club_id, code, title, program_type, status, created_by)
values ('50000000-0000-4000-8000-000000000102','50000000-0000-4000-8000-000000000101','ATTENDANCE-REGRESSION','Attendance Regression Class','debate','active','50000000-0000-4000-8000-000000000001');
insert into public.courses (id, title, slug, description, category, difficulty, created_by, club_id)
values ('50000000-0000-4000-8000-000000000103','Attendance Regression Course','attendance-regression','Attendance regression fixture','debate','beginner','50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000101');
insert into public.class_course_assignments (class_id, course_id, assigned_by)
values ('50000000-0000-4000-8000-000000000102','50000000-0000-4000-8000-000000000103','50000000-0000-4000-8000-000000000001');
insert into public.class_memberships (class_id, user_id, member_role, status, created_by)
values
 ('50000000-0000-4000-8000-000000000102','50000000-0000-4000-8000-000000000001','teacher','active','50000000-0000-4000-8000-000000000001'),
 ('50000000-0000-4000-8000-000000000102','50000000-0000-4000-8000-000000000002','student','active','50000000-0000-4000-8000-000000000001');
update public.class_memberships set joined_at = '2026-01-01' where class_id = '50000000-0000-4000-8000-000000000102';
update public.classes set teacher_user_id = '50000000-0000-4000-8000-000000000001' where id = '50000000-0000-4000-8000-000000000102';
insert into public.course_modules (id, course_id, title)
values ('50000000-0000-4000-8000-000000000104','50000000-0000-4000-8000-000000000103','Regression Module');
insert into public.lessons (id, module_id, course_id, title, slug, lesson_type)
values ('50000000-0000-4000-8000-000000000105','50000000-0000-4000-8000-000000000104','50000000-0000-4000-8000-000000000103','Regression Lesson','attendance-regression-lesson','article');
insert into public.lms_lesson_occurrences (id, club_id, class_id, course_id, occurrence_date, starts_at, ends_at, title, lesson_id, created_by)
values
 ('50000000-0000-4000-8000-000000000106','50000000-0000-4000-8000-000000000101','50000000-0000-4000-8000-000000000102','50000000-0000-4000-8000-000000000103','2026-09-03','2026-09-03 20:00:00+07','2026-09-03 21:00:00+07','Regression Occurrence','50000000-0000-4000-8000-000000000105','50000000-0000-4000-8000-000000000001'),
 ('50000000-0000-4000-8000-000000000107','50000000-0000-4000-8000-000000000101','50000000-0000-4000-8000-000000000102','50000000-0000-4000-8000-000000000103','2026-09-05','2026-09-05 20:00:00+07','2026-09-05 21:00:00+07','Regression Occurrence A','50000000-0000-4000-8000-000000000105','50000000-0000-4000-8000-000000000001'),
 ('50000000-0000-4000-8000-000000000108','50000000-0000-4000-8000-000000000101','50000000-0000-4000-8000-000000000102','50000000-0000-4000-8000-000000000103','2026-09-05','2026-09-05 22:00:00+07','2026-09-05 23:00:00+07','Regression Occurrence B','50000000-0000-4000-8000-000000000105','50000000-0000-4000-8000-000000000001');

set local role authenticated;
set local search_path = public, extensions;
set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000001';
select lives_ok($$select public.save_class_attendance_transaction('50000000-0000-4000-8000-000000000102','50000000-0000-4000-8000-000000000103','2026-09-03','QA attendance','occurrence-linked write',jsonb_build_array(jsonb_build_object('userId','50000000-0000-4000-8000-000000000002','status','present','notes','fixture')))$$, 'authorized manager can save attendance');
select is((select occurrence_id::text from public.class_attendance_sessions where class_id = '50000000-0000-4000-8000-000000000102' and course_id = '50000000-0000-4000-8000-000000000103' and session_date = '2026-09-03'), '50000000-0000-4000-8000-000000000106', 'saved session is linked to the matching occurrence');
select ok(exists (select 1 from public.class_attendance_records r join public.class_attendance_sessions s on s.id = r.session_id where s.class_id = '50000000-0000-4000-8000-000000000102' and s.session_date = '2026-09-03' and r.user_id = '50000000-0000-4000-8000-000000000002' and r.status = 'present'), 'student attendance record is written');
select ok(exists (select 1 from public.class_attendance_correction_events e join public.class_attendance_sessions s on s.id = e.session_id where s.class_id = '50000000-0000-4000-8000-000000000102' and s.session_date = '2026-09-03' and e.action = 'saved'), 'correction event is written');
set local role postgres;
select ok(exists (select 1 from public.admin_activity_log where action = 'save_class_attendance' and entity_id = '50000000-0000-4000-8000-000000000102'), 'class operation audit is written');
set local role authenticated;
set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000003';
select throws_ok($$select public.save_class_attendance_transaction('50000000-0000-4000-8000-000000000102','50000000-0000-4000-8000-000000000103','2026-09-05',null,null,jsonb_build_array(jsonb_build_object('userId','50000000-0000-4000-8000-000000000002','status','present')))$$, 'P0001', 'FORBIDDEN', 'wrong manager is denied');
set local request.jwt.claim.sub = '50000000-0000-4000-8000-000000000001';
select throws_ok($$select public.save_class_attendance_transaction('50000000-0000-4000-8000-000000000102','50000000-0000-4000-8000-000000000103','2026-09-05',null,null,jsonb_build_array(jsonb_build_object('userId','50000000-0000-4000-8000-000000000002','status','present'),jsonb_build_object('userId','11111111-1111-4111-8111-111111111111','status','present')))$$, 'P0001', 'ATTENDANCE_OCCURRENCE_AMBIGUOUS', 'ambiguous occurrence is refused');
select throws_ok($$select public.save_class_attendance_transaction('50000000-0000-4000-8000-000000000102','50000000-0000-4000-8000-000000000103','2026-09-03',null,null,jsonb_build_array(jsonb_build_object('userId','50000000-0000-4000-8000-000000000002','status','present'),jsonb_build_object('userId','11111111-1111-4111-8111-111111111111','status','present')))$$, 'P0001', 'ATTENDANCE_STUDENT_NOT_ACTIVE', 'invalid student rejects the whole write');
select is((select count(*)::integer from public.class_attendance_records r join public.class_attendance_sessions s on s.id = r.session_id where s.class_id = '50000000-0000-4000-8000-000000000102' and s.session_date = '2026-09-03' and r.user_id = '50000000-0000-4000-8000-000000000002'), 1, 'invalid student leaves valid records unchanged');
select throws_ok($$select public.save_class_attendance_transaction('50000000-0000-4000-8000-000000000102','50000000-0000-4000-8000-000000000103','2026-09-04',null,null,jsonb_build_array(jsonb_build_object('userId','50000000-0000-4000-8000-000000000002','status','present')))$$, 'P0001', 'ATTENDANCE_OCCURRENCE_REQUIRED', 'missing occurrence is refused');
select lives_ok($$select 1$$, 'rollback-wrapped fixture remains usable after rejected writes');

select * from finish();
rollback;
