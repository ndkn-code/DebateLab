-- Calendar authority and projection behavior. Run against thinkfy_center_test only.
begin;
set local search_path = public, extensions;
select plan(12);

set local role postgres;
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000009501','authenticated','authenticated','calendar-owner@example.test','x',now(),now(),now(),'{}','{}'),
 ('00000000-0000-0000-0000-000000009502','authenticated','authenticated','calendar-teacher@example.test','x',now(),now(),now(),'{}','{}') on conflict (id) do nothing;
update public.profiles set role='teacher' where id in ('00000000-0000-0000-0000-000000009501','00000000-0000-0000-0000-000000009502');
insert into public.clubs(id,code,name,owner_user_id,status) values ('00000000-0000-0000-0000-000000009511','CAL-9511','Calendar Test','00000000-0000-0000-0000-000000009501','active') on conflict (id) do nothing;
insert into public.club_memberships(club_id,user_id,role,status,joined_at) values
 ('00000000-0000-0000-0000-000000009511','00000000-0000-0000-0000-000000009501','owner','active',now()),
 ('00000000-0000-0000-0000-000000009511','00000000-0000-0000-0000-000000009502','teacher','active',now()) on conflict do nothing;
insert into public.classes(id,club_id,code,title,status,program_type,created_by) values
 ('00000000-0000-0000-0000-000000009521','00000000-0000-0000-0000-000000009511','CAL-A','Bound class','active','debate','00000000-0000-0000-0000-000000009501'),
 ('00000000-0000-0000-0000-000000009522','00000000-0000-0000-0000-000000009511','CAL-B','Native class','active','debate','00000000-0000-0000-0000-000000009501') on conflict (id) do nothing;
insert into public.center_connections(id,club_id,provider,status,connected_by) values ('00000000-0000-0000-0000-000000009531','00000000-0000-0000-0000-000000009511','google','connected','00000000-0000-0000-0000-000000009501') on conflict (id) do nothing;
insert into public.class_schedules(id,class_id,title,start_date,start_time,end_time,timezone,status,created_by,metadata) values ('00000000-0000-0000-0000-000000009551','00000000-0000-0000-0000-000000009521','Native seed','2099-01-05','10:00','11:00','Asia/Ho_Chi_Minh','active','00000000-0000-0000-0000-000000009501','{}') on conflict (id) do nothing;
insert into public.center_resource_bindings(id,club_id,connection_id,kind,external_id,label,class_id,state) values ('00000000-0000-0000-0000-000000009541','00000000-0000-0000-0000-000000009511','00000000-0000-0000-0000-000000009531','calendar','cal-9511','Bound calendar','00000000-0000-0000-0000-000000009521','active') on conflict (id) do nothing;

set local role service_role;
set local request.jwt.claim.role='service_role';
select lives_ok($$select public.center_project_calendar('00000000-0000-0000-0000-000000009541','00000000-0000-0000-0000-000000009501',jsonb_build_array(jsonb_build_object('id','google-1','summary','Google lesson','etag','"v1"','start',jsonb_build_object('dateTime','2099-01-06T10:00:00+07:00','timeZone','Asia/Ho_Chi_Minh'),'end',jsonb_build_object('dateTime','2099-01-06T11:00:00+07:00','timeZone','Asia/Ho_Chi_Minh'))),'2099-01-01T00:00:00+07:00','2099-01-31T00:00:00+07:00')$$,'service projection creates a schedule');
select is((select count(*)::int from public.class_schedules where metadata->>'centerBindingId'='00000000-0000-0000-0000-000000009541'),1,'one deterministic projected schedule exists');
select is((select id from public.class_schedules where metadata->>'googleEventId'='google-1'),md5('00000000-0000-0000-0000-000000009541:google-1')::uuid,'projected schedule id is stable');
select lives_ok($$select public.center_project_calendar('00000000-0000-0000-0000-000000009541','00000000-0000-0000-0000-000000009501',jsonb_build_array(jsonb_build_object('id','google-1','summary','Google lesson','etag','"v2"','start',jsonb_build_object('dateTime','2099-01-06T12:00:00+07:00','timeZone','Asia/Ho_Chi_Minh'),'end',jsonb_build_object('dateTime','2099-01-06T13:00:00+07:00','timeZone','Asia/Ho_Chi_Minh'))),'2099-01-01T00:00:00+07:00','2099-01-31T00:00:00+07:00')$$,'reprojection updates the stable schedule');
select is((select start_time::text from public.class_schedules where metadata->>'googleEventId'='google-1'),'12:00:00','reprojection updates time');
select lives_ok($$select public.center_project_calendar('00000000-0000-0000-0000-000000009541','00000000-0000-0000-0000-000000009501','[]'::jsonb,'2099-01-01T00:00:00+07:00','2099-01-31T00:00:00+07:00')$$,'empty confirmed window is accepted');
select is((select status from public.class_schedules where metadata->>'googleEventId'='google-1'),'cancelled','missing projected event is cancelled');
select throws_ok($$select public.center_project_calendar('00000000-0000-0000-0000-000000009541','00000000-0000-0000-0000-000000009502','[]'::jsonb,'2099-01-01T00:00:00+07:00','2099-01-31T00:00:00+07:00')$$,'42501',null,'cross actor projection is denied');

set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000009502';
select lives_ok($$update public.class_schedules set title='forged' where id='00000000-0000-0000-0000-000000009551'$$,'bound class direct update is filtered by RLS');
set local role postgres;
select is((select title from public.class_schedules where id='00000000-0000-0000-0000-000000009551'),'Native seed','bound native schedule remains unchanged');
select lives_ok($$insert into public.class_schedules(class_id,title,start_date,start_time,end_time,timezone,status,created_by) values('00000000-0000-0000-0000-000000009522','Allowed','2099-01-07','09:00','10:00','Asia/Ho_Chi_Minh','active','00000000-0000-0000-0000-000000009502')$$,'unbound native class schedule remains writable');
select is((select count(*)::int from public.class_schedules where class_id='00000000-0000-0000-0000-000000009522' and title='Allowed'),1,'unbound schedule was created');
select * from finish();
rollback;
