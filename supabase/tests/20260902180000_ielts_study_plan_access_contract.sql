begin;

select plan(21);

select ok(has_table_privilege('authenticated', 'public.ielts_study_plans', 'SELECT'), 'authenticated can read the study-plan table through RLS');
select ok(has_table_privilege('authenticated', 'public.ielts_study_plan_items', 'SELECT'), 'authenticated can read the study-plan items through RLS');
select ok(has_table_privilege('authenticated', 'public.ielts_study_plan_revisions', 'SELECT'), 'authenticated can read the revision table through RLS');
select ok(not has_table_privilege('anon', 'public.ielts_study_plans', 'SELECT'), 'anon cannot read study plans');
select ok(not has_table_privilege('anon', 'public.ielts_study_plan_items', 'SELECT'), 'anon cannot read study-plan items');
select ok(not has_table_privilege('anon', 'public.ielts_study_plan_revisions', 'SELECT'), 'anon cannot read study-plan revisions');

select ok(exists (
  select 1 from pg_policy
  where polname = 'Users view own IELTS study plans'
    and polrelid = 'public.ielts_study_plans'::regclass
), 'study-plan own-row policy exists');
select ok(exists (
  select 1 from pg_policy
  where polname = 'Users view own IELTS study plan items'
    and polrelid = 'public.ielts_study_plan_items'::regclass
), 'study-plan-item own-row policy exists');
select ok(exists (
  select 1 from pg_policy
  where polname = 'Users view own IELTS study plan revisions'
    and polrelid = 'public.ielts_study_plan_revisions'::regclass
), 'study-plan revision own-row policy exists');
select ok((select pg_get_expr(polqual, polrelid)
  from pg_policy
  where polname = 'Users view own IELTS study plans'
    and polrelid = 'public.ielts_study_plans'::regclass) like '%uid()%'
  , 'study-plan policy includes own-user predicate');
select ok((select pg_get_expr(polqual, polrelid)
  from pg_policy
  where polname = 'Users view own IELTS study plans'
    and polrelid = 'public.ielts_study_plans'::regclass) like '%is_admin%'
  , 'study-plan policy preserves platform-admin predicate');

-- Execute the boundary with two learners and a platform administrator. The
-- transaction rolls back all fixtures, including the auth/profile rows.
set local role postgres;
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
 ('81000000-0000-0000-0000-000000000001','authenticated','authenticated','study-a@example.test','x',now(),now(),now(),'{}','{}'),
 ('81000000-0000-0000-0000-000000000002','authenticated','authenticated','study-b@example.test','x',now(),now(),now(),'{}','{}'),
 ('81000000-0000-0000-0000-000000000003','authenticated','authenticated','study-admin@example.test','x',now(),now(),now(),'{}','{}')
on conflict (id) do nothing;
update public.profiles
set role = case when id = '81000000-0000-0000-0000-000000000003' then 'admin' else 'student' end
where id in ('81000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000002','81000000-0000-0000-0000-000000000003');
insert into public.ielts_study_plans
  (id,user_id,target_test_date,target_overall_band,daily_minutes,study_days,feedback_language)
values
 ('81000000-0000-0000-0000-000000000101','81000000-0000-0000-0000-000000000001',current_date + 30,6.5,30,array[1,3,5]::smallint[],'en'),
 ('81000000-0000-0000-0000-000000000102','81000000-0000-0000-0000-000000000002',current_date + 30,7.0,30,array[2,4,6]::smallint[],'en');
insert into public.courses (id,title,slug,created_by,is_published)
values ('81000000-0000-0000-0000-000000000301','Study plan test course','study-plan-access-test','81000000-0000-0000-0000-000000000003',true);
insert into public.course_modules (id,course_id,title)
values ('81000000-0000-0000-0000-000000000201','81000000-0000-0000-0000-000000000301','Study plan test module');
insert into public.activities (id,module_id,activity_type,title)
values ('81000000-0000-0000-0000-000000000401','81000000-0000-0000-0000-000000000201','lesson','Study plan test activity');
insert into public.ielts_study_plan_items
  (id,plan_id,user_id,kind,scheduled_date,skill,focus_area,activity_id,estimated_minutes,rationale_en,rationale_vi)
values
 ('81000000-0000-0000-0000-000000000501','81000000-0000-0000-0000-000000000101','81000000-0000-0000-0000-000000000001','learn_activity',current_date,'reading','Study plan access', '81000000-0000-0000-0000-000000000401',10,'Test rationale','Nội dung kiểm thử');
insert into public.ielts_study_plan_revisions
  (id,plan_id,user_id,to_version,trigger_type,summary_en,summary_vi)
values
 ('81000000-0000-0000-0000-000000000601','81000000-0000-0000-0000-000000000101', '81000000-0000-0000-0000-000000000001',1,'test','Test revision','Bản kiểm thử');

set local role authenticated;
set local search_path = public, extensions;
set local request.jwt.claim.sub = '81000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.ielts_study_plans), 1, 'learner A reads own plan only');
select is((select count(*)::int from public.ielts_study_plan_items), 1, 'learner A reads own items only');
select is((select count(*)::int from public.ielts_study_plan_revisions), 1, 'learner A reads own revisions only');
set local request.jwt.claim.sub = '81000000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.ielts_study_plans), 1, 'learner B reads own plan only');
select is((select count(*)::int from public.ielts_study_plan_items), 0, 'learner B cannot read learner A items');
select is((select count(*)::int from public.ielts_study_plan_revisions), 0, 'learner B cannot read learner A revisions');
set local request.jwt.claim.sub = '81000000-0000-0000-0000-000000000003';
select is((select count(*)::int from public.ielts_study_plans), 2, 'platform admin retains operational plan access');
select is((select count(*)::int from public.ielts_study_plan_items), 1, 'platform admin retains operational item access');
select is((select count(*)::int from public.ielts_study_plan_revisions), 1, 'platform admin retains operational revision access');
set local role anon;
select throws_ok($$select count(*) from public.ielts_study_plans$$, '42501', null, 'anonymous plan reads are denied');

select * from finish();
rollback;
