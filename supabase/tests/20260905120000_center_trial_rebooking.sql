begin;
set local search_path = public, extensions;
select plan(25);
set local role postgres;
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000001201','authenticated','authenticated','rebook-owner@example.test','x',now(),now(),now(),'{}','{}'),
 ('00000000-0000-0000-0000-000000001202','authenticated','authenticated','rebook-outsider@example.test','x',now(),now(),now(),'{}','{}') on conflict (id) do nothing;
update public.profiles set role='teacher' where id='00000000-0000-0000-0000-000000001201';
insert into public.clubs(id,code,name,owner_user_id,status) values
 ('00000000-0000-0000-0000-000000001211','REB-1211','Rebook center','00000000-0000-0000-0000-000000001201','active'),
 ('00000000-0000-0000-0000-000000001212','REB-1212','Foreign center','00000000-0000-0000-0000-000000001202','active');
insert into public.club_memberships(club_id,user_id,role,status,joined_at) values ('00000000-0000-0000-0000-000000001211','00000000-0000-0000-0000-000000001201','owner','active',now());
insert into public.classes(id,club_id,code,title,status,program_type,created_by) values
 ('00000000-0000-0000-0000-000000001221','00000000-0000-0000-0000-000000001211','REB-A','Rebook class','active','debate','00000000-0000-0000-0000-000000001201'),
 ('00000000-0000-0000-0000-000000001222','00000000-0000-0000-0000-000000001212','REB-B','Foreign class','active','debate','00000000-0000-0000-0000-000000001202');
insert into public.student_records(id,club_id,full_name,student_code,created_by) values
 ('00000000-0000-0000-0000-000000001231','00000000-0000-0000-0000-000000001211','Rebook Student','REB-STUDENT','00000000-0000-0000-0000-000000001201'),
 ('00000000-0000-0000-0000-000000001232','00000000-0000-0000-0000-000000001211','Booked Student','REB-BOOKED','00000000-0000-0000-0000-000000001201'),
 ('00000000-0000-0000-0000-000000001233','00000000-0000-0000-0000-000000001211','Chat Student','REB-CHAT','00000000-0000-0000-0000-000000001201'),
 ('00000000-0000-0000-0000-000000001234','00000000-0000-0000-0000-000000001211','Cancel Student','REB-CANCEL','00000000-0000-0000-0000-000000001201');
insert into public.center_trials(id,club_id,student_record_id,class_id,starts_at,ends_at,status) values
 ('00000000-0000-0000-0000-000000001241','00000000-0000-0000-0000-000000001211','00000000-0000-0000-0000-000000001231','00000000-0000-0000-0000-000000001221',now()-interval '3 days',now()-interval '2 days','no_show'),
 ('00000000-0000-0000-0000-000000001242','00000000-0000-0000-0000-000000001211','00000000-0000-0000-0000-000000001233','00000000-0000-0000-0000-000000001221',now()-interval '5 days',now()-interval '4 days','no_show'),
 ('00000000-0000-0000-0000-000000001243','00000000-0000-0000-0000-000000001211','00000000-0000-0000-0000-000000001231','00000000-0000-0000-0000-000000001221',now()-interval '7 days',now()-interval '6 days','no_show'),
 ('00000000-0000-0000-0000-000000001244','00000000-0000-0000-0000-000000001211','00000000-0000-0000-0000-000000001232','00000000-0000-0000-0000-000000001221',now()-interval '9 days',now()-interval '8 days','booked'),
 ('00000000-0000-0000-0000-000000001245','00000000-0000-0000-0000-000000001211','00000000-0000-0000-0000-000000001231','00000000-0000-0000-0000-000000001221',now()+interval '1 day',now()+interval '2 days','no_show'),
 ('00000000-0000-0000-0000-000000001246','00000000-0000-0000-0000-000000001211','00000000-0000-0000-0000-000000001231','00000000-0000-0000-0000-000000001222',now()-interval '11 days',now()-interval '10 days','no_show'),
 ('00000000-0000-0000-0000-000000001247','00000000-0000-0000-0000-000000001211','00000000-0000-0000-0000-000000001234','00000000-0000-0000-0000-000000001221',now()-interval '13 days',now()-interval '12 days','no_show');
set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","sub":"00000000-0000-0000-0000-000000001201"}';
create temp table rebook_receipt as select public.center_execute_command('00000000-0000-0000-0000-000000001211','trial.rebook',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001241','startAt',((now() at time zone 'Asia/Ho_Chi_Minh')::date+3+time '09:00') at time zone 'Asia/Ho_Chi_Minh','endAt',((now() at time zone 'Asia/Ho_Chi_Minh')::date+3+time '10:00') at time zone 'Asia/Ho_Chi_Minh','expectedRevision',1),'rebook-key-1') receipt;
select is((select count(*)::int from public.center_trials where rebook_of='00000000-0000-0000-0000-000000001241'),1,'command creates one linked replacement');
select is((select status from public.center_trials where id='00000000-0000-0000-0000-000000001241'),'no_show','original no-show history remains');
select is((select revision from public.center_trials where id='00000000-0000-0000-0000-000000001241'),2,'original revision increments');
select is((select count(*)::int from public.center_events where kind='trial.booked' and subject_id=(select id from public.center_trials where rebook_of='00000000-0000-0000-0000-000000001241')),1,'rebook emits calendar outbox event');
select is((select public.center_execute_command('00000000-0000-0000-0000-000000001211','trial.rebook',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001241','startAt',((now() at time zone 'Asia/Ho_Chi_Minh')::date+3+time '09:00') at time zone 'Asia/Ho_Chi_Minh','endAt',((now() at time zone 'Asia/Ho_Chi_Minh')::date+3+time '10:00') at time zone 'Asia/Ho_Chi_Minh','expectedRevision',1),'rebook-key-1')->>'commandId'),(select receipt->>'commandId' from rebook_receipt),'same key replays exact receipt');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000001211','trial.rebook',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001241','startAt',now()+interval '4 days','endAt',now()+interval '4 days 1 hour','expectedRevision',1),'rebook-key-1')$$,null,null,'same key with different input is rejected');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000001211','trial.rebook',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001241','startAt',now()+interval '4 days','endAt',now()+interval '4 days 1 hour','expectedRevision',1),'rebook-key-stale')$$,'40001',null,'stale prior revision is rejected');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000001211','trial.rebook',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001243','startAt',((now() at time zone 'Asia/Ho_Chi_Minh')::date+3+time '09:30') at time zone 'Asia/Ho_Chi_Minh','endAt',((now() at time zone 'Asia/Ho_Chi_Minh')::date+3+time '10:30') at time zone 'Asia/Ho_Chi_Minh','expectedRevision',1),'rebook-key-booked')$$,null,null,'overlapping booked trial blocks another replacement');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000001211','trial.rebook',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001245','startAt',now()+interval '4 days','endAt',now()+interval '4 days 1 hour','expectedRevision',1),'rebook-key-future')$$,null,null,'future no-show is rejected');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000001211','trial.rebook',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001244','startAt',now()+interval '4 days','endAt',now()+interval '4 days 1 hour','expectedRevision',1),'rebook-key-status')$$,null,null,'booked prior status is rejected');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000001211','trial.rebook',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001241','startAt',now()+interval '4 days','endAt',now()+interval '4 days 1 hour','expectedRevision',2),'rebook-key-duplicate')$$,null,null,'duplicate replacement is rejected');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000001212','trial.rebook',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001241','startAt',now()+interval '4 days','endAt',now()+interval '4 days 1 hour','expectedRevision',1),'rebook-key-foreign')$$,'42501',null,'foreign club is denied');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000001211','trial.rebook',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001246','startAt',now()+interval '12 days','endAt',now()+interval '12 days 1 hour','expectedRevision',1),'rebook-key-foreign-class')$$,'42501',null,'foreign class is denied');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000001211','trial.rebook',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001243','startAt',null,'endAt',null,'expectedRevision',1),'rebook-key-null-range')$$,null,null,'null range is rejected');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000001211','trial.rebook',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001243','startAt','infinity','endAt','infinity','expectedRevision',1),'rebook-key-infinite-range')$$,null,null,'infinite range is rejected');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000001211','trial.rebook',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001243','startAt',now()+interval '10 days','endAt',now()+interval '11 days','expectedRevision',1),'rebook-key-long-range')$$,null,null,'ranges over eight hours are rejected');
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000001211','trial.rebook',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001243','startAt',now()+interval '10 days 11 hours 30 minutes','endAt',now()+interval '10 days 13 hours 30 minutes','expectedRevision',1),'rebook-key-overnight')$$,null,null,'overnight ranges are rejected');
create temp table rebook_chat as select (public.center_chat_open('00000000-0000-0000-0000-000000001211',null,'Please rebook','rebook-chat-1')->>'conversationId')::uuid conversation_id;
select public.center_chat_complete('00000000-0000-0000-0000-000000001211',(select conversation_id from rebook_chat),'Prepared','[]',jsonb_build_array(jsonb_build_object('kind','trial.rebook','input',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001242','startAt',((now() at time zone 'Asia/Ho_Chi_Minh')::date+5+time '09:00') at time zone 'Asia/Ho_Chi_Minh','endAt',((now() at time zone 'Asia/Ho_Chi_Minh')::date+5+time '10:00') at time zone 'Asia/Ho_Chi_Minh','expectedRevision',1))),'rebook-chat-1');
create temp table rebook_proposal as select id from public.center_proposals where conversation_id=(select conversation_id from rebook_chat);
select is((select requires_confirmation from public.center_proposals where id=(select id from rebook_proposal)),true,'chat rebook requires confirmation');
select throws_ok($$select public.center_decide_proposal('00000000-0000-0000-0000-000000001211',(select id from rebook_proposal),'automatic')$$,'42501',null,'rebook cannot execute automatically');
select lives_ok($$select public.center_decide_proposal('00000000-0000-0000-0000-000000001211',(select id from rebook_proposal),'confirm')$$,'confirmed proposal executes rebook');
select is((select count(*)::int from public.center_trials where rebook_of='00000000-0000-0000-0000-000000001242'),1,'confirmed proposal creates replacement once');
select lives_ok($$select public.center_decide_proposal('00000000-0000-0000-0000-000000001211',(select id from rebook_proposal),'confirm')$$,'confirmed proposal replay is idempotent');
create temp table cancelled_chat as select (public.center_chat_open('00000000-0000-0000-0000-000000001211',null,'Prepare another rebook','rebook-chat-2')->>'conversationId')::uuid conversation_id;
select public.center_chat_complete('00000000-0000-0000-0000-000000001211',(select conversation_id from cancelled_chat),'Prepared','[]',jsonb_build_array(jsonb_build_object('kind','trial.rebook','input',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001247','startAt',now()+interval '6 days','endAt',now()+interval '6 days 1 hour','expectedRevision',1))),'rebook-chat-2');
create temp table cancelled_proposal as select id from public.center_proposals where conversation_id=(select conversation_id from cancelled_chat);
select lives_ok($$select public.center_decide_proposal('00000000-0000-0000-0000-000000001211',(select id from cancelled_proposal),'cancel')$$,'cancelled proposal does not execute rebook');
select is((select count(*)::int from public.center_trials where rebook_of='00000000-0000-0000-0000-000000001247'),0,'cancelled proposal leaves no replacement');
set local role postgres;
insert into public.club_memberships(club_id,user_id,role,status,joined_at) values ('00000000-0000-0000-0000-000000001211','00000000-0000-0000-0000-000000001202','owner','active',now());
update public.club_memberships set status='removed' where club_id='00000000-0000-0000-0000-000000001211' and user_id='00000000-0000-0000-0000-000000001201';
set local role authenticated;
select throws_ok($$select public.center_execute_command('00000000-0000-0000-0000-000000001211','trial.rebook',jsonb_build_object('priorTrialId','00000000-0000-0000-0000-000000001243','startAt',now()+interval '6 days','endAt',now()+interval '6 days 1 hour','expectedRevision',1),'rebook-key-removed')$$,'42501',null,'removed center permission is denied');
select * from finish();
rollback;
