-- Transactional behavior matrix for center operations. Run only against the
-- isolated center test database with the center migrations applied.
begin;
set local search_path = public, extensions;
select plan(39);

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000009001','authenticated','authenticated','center-owner@example.test','x',now(),now(),now(),'{}','{}'),
 ('00000000-0000-0000-0000-000000009002','authenticated','authenticated','center-teacher@example.test','x',now(),now(),now(),'{}','{}'),
 ('00000000-0000-0000-0000-000000009003','authenticated','authenticated','center-student@example.test','x',now(),now(),now(),'{}','{}'),
 ('00000000-0000-0000-0000-000000009004','authenticated','authenticated','center-other@example.test','x',now(),now(),now(),'{}','{}');
update public.profiles set role='teacher' where id in ('00000000-0000-0000-0000-000000009001','00000000-0000-0000-0000-000000009002');
insert into public.clubs(id,code,name,owner_user_id,status) values
 ('00000000-0000-0000-0000-000000009101','CTR-A','Center A','00000000-0000-0000-0000-000000009001','active'),
 ('00000000-0000-0000-0000-000000009102','CTR-B','Center B','00000000-0000-0000-0000-000000009004','active');
insert into public.club_memberships(club_id,user_id,role,status,joined_at) values
 ('00000000-0000-0000-0000-000000009101','00000000-0000-0000-0000-000000009001','owner','active',now()),
 ('00000000-0000-0000-0000-000000009101','00000000-0000-0000-0000-000000009002','teacher','active',now()),
 ('00000000-0000-0000-0000-000000009101','00000000-0000-0000-0000-000000009003','student','active',now());
insert into public.classes(id,club_id,code,title,status,grade_level,program_type,created_by) values
 ('00000000-0000-0000-0000-000000009201','00000000-0000-0000-0000-000000009101','CTR-A1','Center Class','active','Foundation','ielts','00000000-0000-0000-0000-000000009001');
insert into public.class_memberships(class_id,user_id,member_role,status,joined_at,created_by) values
 ('00000000-0000-0000-0000-000000009201','00000000-0000-0000-0000-000000009002','teacher','active',now(),'00000000-0000-0000-0000-000000009001');

set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000009001';
select lives_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000009101','student.create',jsonb_build_object('name','Lead Student'),'life-student-001')$$,'owner creates a lead through the command RPC');
select is((select count(*)::int from public.center_admissions where club_id='00000000-0000-0000-0000-000000009101'),1,'lead admission is created');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000009101','student.create',jsonb_build_object('name','Different'),'life-student-001')$$,null,null,'reused idempotency key with different input is rejected');
select lives_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000009101','student.create',jsonb_build_object('name','Lead Student'),'life-student-001')$$,'same command replay is idempotent');

select lives_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000009101','trial.book',jsonb_build_object('studentRecordId',(select student_record_id from public.center_admissions limit 1),'classId','00000000-0000-0000-0000-000000009201','startAt','2099-01-02T10:00:00+07:00','endAt','2099-01-02T11:00:00+07:00'),'life-trial-001')$$,'owner books a future trial');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000009101','trial.book',jsonb_build_object('studentRecordId',(select student_record_id from public.center_admissions limit 1),'classId','00000000-0000-0000-0000-000000009201','startAt','2099-01-02T12:00:00+07:00','endAt','2099-01-02T11:00:00+07:00'),'life-trial-bad')$$,null,null,'trial end before start is rejected');
select lives_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000009101','trial.evaluate',jsonb_build_object('trialId',(select id from public.center_trials limit 1),'assessment',jsonb_build_object('level','B','strengths','clear','weaknesses','pace','recommendation','Practice'),'expectedRevision',1),'life-trial-eval-001')$$,'owner records a trial assessment');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000009101','trial.evaluate',jsonb_build_object('trialId',(select id from public.center_trials limit 1),'assessment',jsonb_build_object('level','A','strengths','clear','weaknesses','pace','recommendation','Practice'),'expectedRevision',1),'life-trial-eval-stale')$$,'40001',null,'stale trial revision is rejected');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000009101','trial.status',jsonb_build_object('trialId',(select id from public.center_trials limit 1),'status','no_show','expectedRevision',2),'life-trial-noshow')$$,null,null,'future trial cannot be marked no show');
select lives_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000009101','admission.stage',jsonb_build_object('admissionId',(select id from public.center_admissions limit 1),'stage','qualified','expectedRevision',1),'life-admission-stage')$$,'owner stages an admission');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000009101','admission.stage',jsonb_build_object('admissionId',(select id from public.center_admissions limit 1),'stage','lost','expectedRevision',1),'life-admission-stage-stale')$$,'40001',null,'stale admission revision is rejected');
select lives_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000009101','offer.create',jsonb_build_object('studentRecordId',(select student_record_id from public.center_admissions limit 1),'classId','00000000-0000-0000-0000-000000009201','amount',500000,'startDate','2099-02-01','endDate','2099-03-01'),'life-offer-001')$$,'owner creates offer and invoice');
select is((select count(*)::int from public.center_invoices),1,'offer creates one invoice');

set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000009001';
select lives_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000009101','connection.prepare',jsonb_build_object('provider','zalopay'),'life-connection-001')$$,'owner prepares a payment connection');
create temp table center_test_payment_ids as
select (select id from public.center_invoices limit 1) invoice_id,
       (select id from public.center_connections where club_id='00000000-0000-0000-0000-000000009101' and provider='zalopay') connection_id;
grant select on center_test_payment_ids to service_role;
set local role postgres;
update public.center_connections set status='sandbox' where id=(select connection_id from center_test_payment_ids);
set local role service_role;
set local request.jwt.claim.role='service_role';
select lives_ok($$select public.center_prepare_payment((select invoice_id from center_test_payment_ids),(select connection_id from center_test_payment_ids),'life-order-001')$$,'service role prepares a payment');
select is((public.center_apply_verified_payment((select connection_id from center_test_payment_ids),'life-order-001','life-tx-bad',499999)->>'status'),'exception','wrong amount persists payment exception');
select lives_ok($$select public.center_prepare_payment((select invoice_id from center_test_payment_ids),(select connection_id from center_test_payment_ids),'life-order-002')$$,'second payment attempt is allowed after exception');
select is((public.center_apply_verified_payment((select connection_id from center_test_payment_ids),'life-order-002','life-tx-good',500000)->>'status'),'paid','valid payment is paid');
select is((public.center_apply_verified_payment((select connection_id from center_test_payment_ids),'life-order-002','life-tx-good',500000)->>'replayed'),'true','valid payment replay is idempotent');
select ok((select expires_at is not null from public.center_payment_attempts where provider_order_id='life-order-002'),'payment attempt has bounded expiry before provider request');
select throws_ok($$select public.center_apply_verified_payment((select connection_id from center_test_payment_ids),'life-order-002','life-tx-tamper',1)$$,null,null,'verified paid attempt rejects changed callback');
select is((select status from public.center_payment_attempts where provider_order_id='life-order-002'),'paid','changed callback never corrupts paid ledger');
set local role postgres;
update public.classes set max_students=1 where id='00000000-0000-0000-0000-000000009201';
set local role authenticated;
select public.center_execute_command('00000000-0000-0000-0000-000000009101','offer.create',jsonb_build_object('studentRecordId',(select student_record_id from public.center_admissions limit 1),'classId','00000000-0000-0000-0000-000000009201','amount',500000,'startDate','2099-03-01','endDate','2099-04-01'),'life-offer-renewal');
set local role service_role;
select public.center_prepare_payment((select id from public.center_invoices where status='open'),(select connection_id from center_test_payment_ids),'life-order-renewal');
select is((public.center_apply_verified_payment((select connection_id from center_test_payment_ids),'life-order-renewal','life-tx-renewal',500000)->>'status'),'paid','existing learner can renew a full class');
set local role postgres;
select is((select count(*)::int from public.student_record_enrollments where status='active'),1,'renewal preserves a single enrollment');
select is((select metadata->>'paidThrough' from public.student_record_enrollments where status='active'),'2099-04-01','renewal extends paid term');
set local role authenticated;
select public.center_execute_command('00000000-0000-0000-0000-000000009101','student.create','{"name":"Capacity learner"}','life-capacity-student');
select public.center_execute_command('00000000-0000-0000-0000-000000009101','offer.create',jsonb_build_object('studentRecordId',(select id from public.student_records where full_name='Capacity learner'),'classId','00000000-0000-0000-0000-000000009201','amount',500000,'startDate','2099-03-01','endDate','2099-04-01'),'life-offer-capacity');
set local role service_role;
select public.center_prepare_payment((select id from public.center_invoices where status='open'),(select connection_id from center_test_payment_ids),'life-order-capacity');
select is((public.center_apply_verified_payment((select connection_id from center_test_payment_ids),'life-order-capacity','life-tx-capacity',500000)->>'reason'),'class_at_capacity','full class records activation exception');
select is((select i.status from public.center_invoices i join public.center_payment_attempts a on a.invoice_id=i.id where a.provider_order_id='life-order-capacity'),'paid','capacity exception still records money received');
set local role postgres;
select is((select count(*)::int from public.student_record_enrollments e join public.student_records s on s.id=e.student_record_id where s.full_name='Capacity learner'),0,'capacity exception does not enroll the learner');


set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000009002';
select is((select count(*)::int from public.center_trials),1,'teacher can see exact class trial');
select lives_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000009101','note.create',jsonb_build_object('studentRecordId',(select student_record_id from public.center_admissions limit 1),'body','teacher note'),'life-note-001')$$,'teacher can write a note for a trial student');

set local request.jwt.claim.sub='00000000-0000-0000-0000-000000009004';
select throws_ok($$select public.center_snapshot('00000000-0000-0000-0000-000000009101')$$,'42501',null,'other center cannot read snapshot');
select throws_ok($$insert into public.center_events(club_id,kind) values('00000000-0000-0000-0000-000000009101','forged')$$,'42501',null,'direct event writes are denied');

select ok(not has_table_privilege('authenticated','private.center_credentials','select'),'credential vault is not directly readable');
select ok(to_regprocedure('public.center_oauth_consume(text)') is not null,'OAuth consume RPC exists for single use/expiry behavior');
select ok(to_regprocedure('public.center_refresh_credentials(uuid,text,text,timestamptz)') is not null,'credential refresh RPC exists for optimistic refresh');
select ok(to_regprocedure('public.center_chat_complete(uuid,uuid,text,jsonb,jsonb,text)') is not null,'chat completion is request bound');
select ok(to_regprocedure('public.center_decide_proposal(uuid,uuid,text)') is not null,'proposal decision RPC exists');
set local role anon;
select throws_ok($$select public.center_snapshot('00000000-0000-0000-0000-000000009101')$$,'42501',null,'anonymous snapshot access is denied');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000009101','note.create','{}','anon-command')$$,'42501',null,'anonymous command access is denied');
select * from finish();
rollback;
