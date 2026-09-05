begin;
set local search_path=public,extensions;
set local request.jwt.claim.role='';
set local request.jwt.claim.sub='';
select plan(6);
set local role postgres;
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000001101','authenticated','authenticated','role-owner@example.test','x',now(),now(),now(),'{}','{}'),
 ('00000000-0000-0000-0000-000000001102','authenticated','authenticated','role-outsider@example.test','x',now(),now(),now(),'{}','{}') on conflict (id) do nothing;
update public.profiles set role='teacher' where id='00000000-0000-0000-0000-000000001101';
insert into public.clubs(id,code,name,owner_user_id,status) values ('00000000-0000-0000-0000-000000001111','ROLE-1111','Role claim test','00000000-0000-0000-0000-000000001101','active') on conflict (id) do nothing;
insert into public.club_memberships(club_id,user_id,role,status,joined_at) values ('00000000-0000-0000-0000-000000001111','00000000-0000-0000-0000-000000001101','owner','active',now()) on conflict do nothing;
insert into public.classes(id,club_id,code,title,status,program_type,created_by) values ('00000000-0000-0000-0000-000000001121','00000000-0000-0000-0000-000000001111','ROLE-A','Role class','active','debate','00000000-0000-0000-0000-000000001101') on conflict (id) do nothing;
insert into public.center_connections(id,club_id,provider,status,connected_by) values ('00000000-0000-0000-0000-000000001131','00000000-0000-0000-0000-000000001111','google','connected','00000000-0000-0000-0000-000000001101') on conflict (id) do nothing;
insert into public.center_resource_bindings(id,club_id,connection_id,kind,external_id,label,class_id,state) values ('00000000-0000-0000-0000-000000001141','00000000-0000-0000-0000-000000001111','00000000-0000-0000-0000-000000001131','drive_file','role-file','Role Drive file','00000000-0000-0000-0000-000000001121','active') on conflict (id) do nothing;

set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
select throws_ok($$select public.center_queue_google_material('00000000-0000-0000-0000-000000001141','00000000-0000-0000-0000-000000001101','role-file',repeat('a',64),'{}'::jsonb,'00000000-0000-0000-0000-000000001111/00000000-0000-0000-0000-000000001161/00000000-0000-0000-0000-000000001171/original.txt',12)$$,'P0001','Google material must be validated and finalized before queueing','unfinalized Google bytes cannot enter the worker');
select lives_ok($$select public.center_queue_google_material('00000000-0000-0000-0000-000000001141','00000000-0000-0000-0000-000000001101','role-file',repeat('a',64),'{"name":"QA original.txt","mimeType":"text/plain","storageBucket":"lms-material-originals"}'::jsonb,'00000000-0000-0000-0000-000000001111/00000000-0000-0000-0000-000000001161/00000000-0000-0000-0000-000000001171/original.txt',12)$$,'finalized original queues successfully with JSON claims');
select is((select original_bucket||':'||detected_mime_type||':'||processing_status from lms_material_versions where id='00000000-0000-0000-0000-000000001171'),'lms-material-originals:text/plain:queued','worker receives finalized original and detected MIME');
select ok((select original_path is not null and ingest_path is null from lms_material_versions where id='00000000-0000-0000-0000-000000001171'),'queued version has original path rather than a pending ingest path');
select is((select status||':'||rights_basis from lms_materials where id='00000000-0000-0000-0000-000000001161'),'draft:unknown','material stays unpublished pending rights review');
select is((select (public.center_queue_google_material('00000000-0000-0000-0000-000000001141','00000000-0000-0000-0000-000000001101','role-file',repeat('a',64),'{"name":"QA original.txt","mimeType":"text/plain","storageBucket":"lms-material-originals"}'::jsonb,'00000000-0000-0000-0000-000000001111/00000000-0000-0000-0000-000000001161/00000000-0000-0000-0000-000000001171/original.txt',12)->>'replayed')::boolean),true,'identical content reuses its material version');
select * from finish();
rollback;
