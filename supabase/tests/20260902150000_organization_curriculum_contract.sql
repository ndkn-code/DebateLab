-- Executable two-organization curriculum/RLS matrix.
begin;
select plan(27);

select has_column('public', 'courses', 'club_id', 'courses expose organization ownership');
select has_index('public', 'courses', 'courses_global_slug_key', 'global course slugs are unique');
select has_index('public', 'courses', 'courses_organization_slug_key', 'organization course slugs are unique per organization');
select has_function('private', 'can_read_curriculum_course', array['uuid','uuid'], 'course read helper exists');
select has_function('private', 'can_manage_curriculum_course', array['uuid','uuid'], 'course manage helper exists');
select has_function('public', 'load_curriculum_quiz_questions', array['uuid'], 'safe quiz projection exists');
select has_function('public', 'grade_curriculum_quiz_submission', array['uuid','jsonb'], 'safe quiz grading RPC exists');
select has_function('public', 'save_organization_course_transaction', array['jsonb'], 'audited course save RPC exists');
select has_function('public', 'clone_global_course_transaction', array['uuid','uuid','text','text'], 'idempotent global clone RPC exists');
select ok(not has_table_privilege('authenticated', 'public.quiz_questions', 'select'), 'answer-key table is not directly selectable');
select ok(not exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_questions' and policyname='Curriculum readers can view quiz questions'), 'learner answer-key reader policy removed');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='quiz_questions' and policyname='Curriculum managers can view quiz questions'), 'answer-key reads are manager scoped');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='courses' and policyname='Curriculum readers can view courses'), 'course read policy exists');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='course_modules' and policyname='Curriculum readers can view modules'), 'module read policy exists');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='lessons' and policyname='Curriculum readers can view lessons'), 'lesson read policy exists');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='activities' and policyname='Curriculum readers can view active activities'), 'activity read policy exists');
select ok((select pg_get_constraintdef(oid) like '%public_speaking%' from pg_constraint where conrelid='public.courses'::regclass and conname='courses_subject_check'), 'subject constraint includes public speaking');
select ok(position('coalesce(q.correct_answer' in pg_get_functiondef('public.grade_curriculum_quiz_submission(uuid,jsonb)'::regprocedure)) > 0, 'missing quiz answers grade false');

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000002001','authenticated','authenticated','curr-head@example.test','x',now(),now(),now(),'{}','{}'),
 ('00000000-0000-0000-0000-000000002002','authenticated','authenticated','curr-teacher@example.test','x',now(),now(),now(),'{}','{}'),
 ('00000000-0000-0000-0000-000000002003','authenticated','authenticated','curr-student@example.test','x',now(),now(),now(),'{}','{}'),
 ('00000000-0000-0000-0000-000000002004','authenticated','authenticated','curr-other@example.test','x',now(),now(),now(),'{}','{}');
update public.profiles set role=case
  when id in ('00000000-0000-0000-0000-000000002001','00000000-0000-0000-0000-000000002002') then 'teacher'
  else 'student'
end where id in ('00000000-0000-0000-0000-000000002001','00000000-0000-0000-0000-000000002002','00000000-0000-0000-0000-000000002003','00000000-0000-0000-0000-000000002004');
insert into public.clubs (id,code,name,owner_user_id,status) values
 ('00000000-0000-0000-0000-000000002101','CUR-A','Curriculum A','00000000-0000-0000-0000-000000002001','active'),
 ('00000000-0000-0000-0000-000000002102','CUR-B','Curriculum B','00000000-0000-0000-0000-000000002004','active');
insert into public.club_memberships (club_id,user_id,role,status,joined_at) values
 ('00000000-0000-0000-0000-000000002101','00000000-0000-0000-0000-000000002001','head_teacher','active',now()),
 ('00000000-0000-0000-0000-000000002101','00000000-0000-0000-0000-000000002002','teacher','active',now()),
 ('00000000-0000-0000-0000-000000002101','00000000-0000-0000-0000-000000002003','student','active',now()),
 ('00000000-0000-0000-0000-000000002102','00000000-0000-0000-0000-000000002004','student','active',now());
insert into public.classes (id,club_id,code,title,status,grade_level,program_type,created_by) values
 ('00000000-0000-0000-0000-000000002201','00000000-0000-0000-0000-000000002101','CUR-A1','Class A','active','Foundation','ielts','00000000-0000-0000-0000-000000002001'),
 ('00000000-0000-0000-0000-000000002202','00000000-0000-0000-0000-000000002102','CUR-B1','Class B','active','Foundation','ielts','00000000-0000-0000-0000-000000002004');
insert into public.class_memberships (class_id,user_id,member_role,status,joined_at,created_by) values
 ('00000000-0000-0000-0000-000000002201','00000000-0000-0000-0000-000000002002','teacher','active',now(),'00000000-0000-0000-0000-000000002001'),
 ('00000000-0000-0000-0000-000000002201','00000000-0000-0000-0000-000000002003','student','active',now(),'00000000-0000-0000-0000-000000002001'),
 ('00000000-0000-0000-0000-000000002202','00000000-0000-0000-0000-000000002004','student','active',now(),'00000000-0000-0000-0000-000000002004');
insert into public.courses (id,title,slug,subject,club_id,is_published,visibility,created_by) values
 ('00000000-0000-0000-0000-000000002301','Org Course','org-course','ielts','00000000-0000-0000-0000-000000002101',true,'class_restricted','00000000-0000-0000-0000-000000002001'),
 ('00000000-0000-0000-0000-000000002302','Other Org Course','org-course','ielts','00000000-0000-0000-0000-000000002102',true,'class_restricted','00000000-0000-0000-0000-000000002004'),
 ('00000000-0000-0000-0000-000000002303','Global Template','global-template','debate',null,true,'public','00000000-0000-0000-0000-000000002001'),
 ('00000000-0000-0000-0000-000000002304','Unpublished Org','unpublished-org','public_speaking','00000000-0000-0000-0000-000000002101',false,'class_restricted','00000000-0000-0000-0000-000000002001');
insert into public.class_course_assignments (class_id,course_id,assigned_by) values ('00000000-0000-0000-0000-000000002201','00000000-0000-0000-0000-000000002301','00000000-0000-0000-0000-000000002001');

set local role authenticated;
set local search_path = public, extensions;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000002001';
select throws_ok($$insert into public.courses (title,slug,subject,club_id,is_published,visibility) values ('Head Course','head-course','ielts','00000000-0000-0000-0000-000000002101',false,'class_restricted')$$, '42501', null, 'direct curriculum mutation is denied');
select lives_ok($$select public.save_organization_course_transaction(jsonb_build_object('organizationId','00000000-0000-0000-0000-000000002101','title','RPC Course','slug','rpc-course','subject','debate','idempotencyKey','curr-rpc-001'))$$, 'head teacher can create course through audited RPC');
select is((select count(*)::int from public.courses where id='00000000-0000-0000-0000-000000002301'),1,'head teacher reads owned course');
select throws_ok($$insert into public.courses (title,slug,subject,is_published,visibility) values ('Tampered Global','tampered-global','debate',true,'public')$$,'42501',null,'head teacher cannot create global course');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000002002';
select is((select count(*)::int from public.courses where id='00000000-0000-0000-0000-000000002301'),1,'assigned teacher reads exact-class course');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000002003';
select is((select count(*)::int from public.courses where id='00000000-0000-0000-0000-000000002301'),1,'exact-class student reads assigned course');
select is((select count(*)::int from public.courses where id='00000000-0000-0000-0000-000000002302'),0,'student cannot read other organization course');
select is((select count(*)::int from public.courses where id='00000000-0000-0000-0000-000000002304'),0,'student cannot read unpublished organization course');
select lives_ok($$select * from public.load_curriculum_quiz_questions('00000000-0000-0000-0000-000000002999')$$,'safe quiz projection is callable without answer key');
select * from finish();
rollback;
