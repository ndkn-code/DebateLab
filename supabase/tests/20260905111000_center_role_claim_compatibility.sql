begin;
set local search_path = public, extensions;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select plan(10);

select is((select count(*)::int from pg_proc where oid in (
  'public.center_google_connection_context(uuid,uuid)'::regprocedure,
  'public.center_google_projection(uuid,uuid,jsonb,text,text)'::regprocedure,
  'public.center_queue_google_material(uuid,uuid,text,text,jsonb,text,bigint)'::regprocedure,
  'public.center_revoke_google_material(uuid,uuid)'::regprocedure,
  'private.center_guard_calendar_authority()'::regprocedure,
  'public.center_project_calendar(uuid,uuid,jsonb,timestamptz,timestamptz)'::regprocedure,
  'public.center_calendar_command_context(uuid)'::regprocedure)),7,'all role-guarded functions retain their signatures');
select is((select count(*)::int from pg_proc p where p.oid in (
  'public.center_google_connection_context(uuid,uuid)'::regprocedure,
  'public.center_google_projection(uuid,uuid,jsonb,text,text)'::regprocedure,
  'public.center_queue_google_material(uuid,uuid,text,text,jsonb,text,bigint)'::regprocedure,
  'public.center_revoke_google_material(uuid,uuid)'::regprocedure,
  'private.center_guard_calendar_authority()'::regprocedure,
  'public.center_project_calendar(uuid,uuid,jsonb,timestamptz,timestamptz)'::regprocedure,
  'public.center_calendar_command_context(uuid)'::regprocedure)
  and pg_get_functiondef(p.oid) like '%auth.role()%'
  and pg_get_functiondef(p.oid) not like '%request.jwt.claim.role%'),7,'all definitions use the JSON-backed role');

set local role postgres;
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000001101','authenticated','authenticated','role-owner@example.test','x',now(),now(),now(),'{}','{}'),
 ('00000000-0000-0000-0000-000000001102','authenticated','authenticated','role-outsider@example.test','x',now(),now(),now(),'{}','{}') on conflict (id) do nothing;
update public.profiles set role='teacher' where id='00000000-0000-0000-0000-000000001101';
insert into public.clubs(id,code,name,owner_user_id,status) values ('00000000-0000-0000-0000-000000001111','ROLE-1111','Role claim test','00000000-0000-0000-0000-000000001101','active') on conflict (id) do nothing;
insert into public.club_memberships(club_id,user_id,role,status,joined_at) values ('00000000-0000-0000-0000-000000001111','00000000-0000-0000-0000-000000001101','owner','active',now()) on conflict do nothing;
insert into public.classes(id,club_id,code,title,status,program_type,created_by) values ('00000000-0000-0000-0000-000000001121','00000000-0000-0000-0000-000000001111','ROLE-A','Role class','active','debate','00000000-0000-0000-0000-000000001101') on conflict (id) do nothing;
insert into public.center_connections(id,club_id,provider,status,connected_by) values ('00000000-0000-0000-0000-000000001131','00000000-0000-0000-0000-000000001111','google','connected','00000000-0000-0000-0000-000000001101') on conflict (id) do nothing;
insert into public.class_schedules(id,class_id,title,start_date,start_time,end_time,timezone,status,created_by,metadata) values ('00000000-0000-0000-0000-000000001151','00000000-0000-0000-0000-000000001121','Role seed','2099-01-05','10:00','11:00','Asia/Ho_Chi_Minh','active','00000000-0000-0000-0000-000000001101','{}') on conflict (id) do nothing;
insert into public.center_resource_bindings(id,club_id,connection_id,kind,external_id,label,class_id,state) values ('00000000-0000-0000-0000-000000001141','00000000-0000-0000-0000-000000001111','00000000-0000-0000-0000-000000001131','calendar','role-cal','Role calendar','00000000-0000-0000-0000-000000001121','active') on conflict (id) do nothing;

set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
select lives_ok($$select public.center_google_connection_context('00000000-0000-0000-0000-000000001111','00000000-0000-0000-0000-000000001101')$$,'JSON-only service role can load Google context');
select lives_ok($$update public.class_schedules set title='service update' where id='00000000-0000-0000-0000-000000001151'$$,'JSON-only service role passes calendar trigger');
select is((select title from public.class_schedules where id='00000000-0000-0000-0000-000000001151'),'service update','service role update is applied');
select throws_ok($$select public.center_google_connection_context('00000000-0000-0000-0000-000000001111','00000000-0000-0000-0000-000000001102')$$,'42501',null,'non-owner service request is denied');

set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","sub":"00000000-0000-0000-0000-000000001101"}';
select throws_ok($$select public.center_google_connection_context('00000000-0000-0000-0000-000000001111','00000000-0000-0000-0000-000000001101')$$,'42501',null,'authenticated caller is denied');
select throws_ok($$update public.class_schedules set title='forged update' where id='00000000-0000-0000-0000-000000001151'$$,'P0001','This class uses Google Calendar. Reschedule through the center workspace or Google Calendar.','authenticated direct calendar update is denied');
set local role postgres;
select is((select title from public.class_schedules where id='00000000-0000-0000-0000-000000001151'),'service update','authenticated direct update did not change the schedule');
select throws_ok($$update public.class_schedules set title='forged update' where id='00000000-0000-0000-0000-000000001151'$$,'P0001','This class uses Google Calendar. Reschedule through the center workspace or Google Calendar.','calendar trigger rejects authenticated JSON claims even when RLS is bypassed');

select * from finish();
rollback;
