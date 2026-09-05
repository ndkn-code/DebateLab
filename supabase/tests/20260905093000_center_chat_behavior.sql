-- Transactional behavior matrix for center operations. Run only against the
-- isolated center test database with the center migrations applied.
begin;
set local search_path = public, extensions;
select plan(12);

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
set local request.jwt.claim.role='authenticated';
select public.center_execute_command('00000000-0000-0000-0000-000000009101','student.create','{"name":"Chat learner"}','chat-seed-001');
create temp table chat_test as select (public.center_chat_open('00000000-0000-0000-0000-000000009101',null,'Save a note and offer','chat-request-001')->>'conversationId')::uuid cid;
grant select on chat_test to postgres,service_role;
select lives_ok($$select public.center_chat_complete('00000000-0000-0000-0000-000000009101',(select cid from chat_test),'Drafted','[]',jsonb_build_array(jsonb_build_object('kind','note.create','input',jsonb_build_object('studentRecordId',(select id from public.student_records limit 1),'body','Careful reader'),'requiresConfirmation',false),jsonb_build_object('kind','offer.create','input',jsonb_build_object('studentRecordId',(select id from public.student_records limit 1),'classId','00000000-0000-0000-0000-000000009201','amount',500000,'startDate','2099-01-01','endDate','2099-02-01'),'requiresConfirmation',false)),'chat-request-001')$$,'chat saves validated proposal types');
select ok((select requires_confirmation from public.center_proposals where kind='offer.create'),'server requires financial confirmation despite supplied false');
select lives_ok($$select public.center_decide_proposal('00000000-0000-0000-0000-000000009101',(select id from public.center_proposals where kind='note.create'),'automatic')$$,'internal note executes automatically');
select lives_ok($$select public.center_decide_proposal('00000000-0000-0000-0000-000000009101',(select id from public.center_proposals where kind='note.create'),'automatic')$$,'note replay returns receipt');
select is((select count(*)::int from public.center_notes),1,'note executed exactly once');
select throws_ok($$select public.center_decide_proposal('00000000-0000-0000-0000-000000009101',(select id from public.center_proposals where kind='offer.create'),'automatic')$$,'42501',null,'money cannot execute automatically');
create temp table proposal_test as select id from public.center_proposals where kind='offer.create';
grant select on proposal_test to authenticated,postgres;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000009002';
select throws_ok($$select public.center_decide_proposal('00000000-0000-0000-0000-000000009101',(select id from proposal_test),'confirm')$$,'42501',null,'another teacher cannot approve private proposal');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000009001';
set local role postgres;
update public.center_proposals set expires_at=now()-interval '1 minute' where kind='offer.create';
set local role authenticated;
select throws_ok($$select public.center_decide_proposal('00000000-0000-0000-0000-000000009101',(select id from proposal_test),'confirm')$$,null,null,'expired financial proposal cannot execute');
set local role service_role;
set local request.jwt.claim.role='service_role';
select lives_ok($$select public.center_oauth_begin('00000000-0000-0000-0000-000000009101','00000000-0000-0000-0000-000000009001',repeat('a',64),'encrypted-pkce','kms-key',array['calendar'])$$,'authorized owner begins OAuth');
select lives_ok($$select public.center_oauth_consume(repeat('a',64))$$,'OAuth state consumed once');
select throws_ok($$select public.center_oauth_consume(repeat('a',64))$$,'42501',null,'OAuth state replay denied');
select public.center_oauth_begin('00000000-0000-0000-0000-000000009101','00000000-0000-0000-0000-000000009001',repeat('b',64),'encrypted-pkce','kms-key',array['calendar']);
set local role postgres;
insert into public.club_memberships(club_id,user_id,role,status) values('00000000-0000-0000-0000-000000009101','00000000-0000-0000-0000-000000009004','owner','active');
update public.club_memberships set status='removed' where user_id='00000000-0000-0000-0000-000000009001';
update public.clubs set owner_user_id='00000000-0000-0000-0000-000000009004' where id='00000000-0000-0000-0000-000000009101';
set local role service_role;
select throws_ok($$select public.center_oauth_consume(repeat('b',64))$$,'42501',null,'removed owner cannot complete OAuth');
select * from finish();
rollback;
