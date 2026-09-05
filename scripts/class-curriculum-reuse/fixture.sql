-- Local acceptance fixture. Run only against the disposable thinkfy_reuse_571d database
-- after schema.sql and the feature migration; this file is transactional.
begin;
insert into auth.users (id,email)
values ('70000000-0000-4000-8000-000000000001','reuse-admin@example.test')
on conflict (id) do nothing;
insert into public.profiles (id,role) values ('70000000-0000-4000-8000-000000000001','teacher') on conflict (id) do update set role='teacher';
insert into public.clubs (id,code,name,owner_user_id,status) values ('70000000-0000-4000-8000-000000000010','REUSE-LOCAL','Reuse Local','70000000-0000-4000-8000-000000000001','active') on conflict (id) do nothing;
insert into public.club_memberships (club_id,user_id,role,status,joined_at) values ('70000000-0000-4000-8000-000000000010','70000000-0000-4000-8000-000000000001','owner','active',now()) on conflict do nothing;
insert into public.classes (id,club_id,code,title,status,program_type,grade_level,start_date,end_date,created_by)
values ('70000000-0000-4000-8000-000000000020','70000000-0000-4000-8000-000000000010','REUSE-SRC','Reuse source','active','debate','middle','2026-09-01','2026-09-30','70000000-0000-4000-8000-000000000001') on conflict (id) do nothing;
insert into public.courses (id,title,slug,subject,club_id,is_published,visibility,created_by)
values ('70000000-0000-4000-8000-000000000030','Reuse course','reuse-course','debate','70000000-0000-4000-8000-000000000010',true,'class_restricted','70000000-0000-4000-8000-000000000001') on conflict (id) do nothing;
insert into public.class_course_assignments (class_id,course_id,assigned_by) values ('70000000-0000-4000-8000-000000000020','70000000-0000-4000-8000-000000000030','70000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into public.club_assignments (id,club_id,class_id,title,assignment_type,assigned_track,status,created_by,metadata,due_at)
values ('70000000-0000-4000-8000-000000000040','70000000-0000-4000-8000-000000000010','70000000-0000-4000-8000-000000000020','Reusable practice','practice','debate','active','70000000-0000-4000-8000-000000000001','{}','2026-09-10 15:00:00+00') on conflict (id) do nothing;
insert into public.lms_materials(id,club_id,program_type,title,status) values ('70000000-0000-4000-8000-000000000050','70000000-0000-4000-8000-000000000010','debate','Reusable handout','published');
insert into public.lms_material_versions(id,material_id,processing_status,content_review_status) values ('70000000-0000-4000-8000-000000000051','70000000-0000-4000-8000-000000000050','ready','approved');
insert into public.lms_material_rights_approvals(id,material_id,version_id,decision) values ('70000000-0000-4000-8000-000000000052','70000000-0000-4000-8000-000000000050','70000000-0000-4000-8000-000000000051','approved');
insert into public.lms_material_placements(id,material_id,version_id,club_id,target_type,class_id,status,audience_mode,created_by)
values ('70000000-0000-4000-8000-000000000053','70000000-0000-4000-8000-000000000050','70000000-0000-4000-8000-000000000051','70000000-0000-4000-8000-000000000010','class','70000000-0000-4000-8000-000000000020','published','all','70000000-0000-4000-8000-000000000001');

update club_assignments set submission_instructions='Write your own response';
insert into course_modules(id,course_id,title) values ('70000000-0000-4000-8000-000000000031','70000000-0000-4000-8000-000000000030','Build an argument · Xây dựng lập luận');
insert into lessons(id,module_id,title) values ('70000000-0000-4000-8000-000000000032','70000000-0000-4000-8000-000000000031','Claims and evidence');
update lms_material_placements set release_at='2026-09-02T08:00:00Z',expires_at='2026-09-20T08:00:00Z';

-- Nonempty learner records make accidental copying detectable.
insert into auth.users(id,email) values ('70000000-0000-4000-8000-000000000002','reuse-learner@example.test');
insert into profiles(id,role) values ('70000000-0000-4000-8000-000000000002','student');
insert into class_memberships(id,class_id,user_id,member_role,status) values (gen_random_uuid(),'70000000-0000-4000-8000-000000000020','70000000-0000-4000-8000-000000000002','student','active');
insert into club_assignment_submissions(id,assignment_id,user_id) values (gen_random_uuid(),'70000000-0000-4000-8000-000000000040','70000000-0000-4000-8000-000000000002');
insert into lms_announcements(id,class_id,body) values (gen_random_uuid(),'70000000-0000-4000-8000-000000000020','Private cohort announcement');
insert into lms_outbox_events(id,class_id) values (gen_random_uuid(),'70000000-0000-4000-8000-000000000020');
insert into attendance_records(id,class_id,user_id) values (gen_random_uuid(),'70000000-0000-4000-8000-000000000020','70000000-0000-4000-8000-000000000002');
insert into student_progress(id,class_id,user_id) values (gen_random_uuid(),'70000000-0000-4000-8000-000000000020','70000000-0000-4000-8000-000000000002');
insert into private_feedback(id,class_id,user_id) values (gen_random_uuid(),'70000000-0000-4000-8000-000000000020','70000000-0000-4000-8000-000000000002');
insert into student_grades(id,class_id,user_id) values (gen_random_uuid(),'70000000-0000-4000-8000-000000000020','70000000-0000-4000-8000-000000000002');
commit;
