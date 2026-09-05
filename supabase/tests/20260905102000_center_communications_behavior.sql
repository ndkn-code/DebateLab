-- Isolated notification reservation behavior; all fixtures roll back.
begin;
set local search_path = public, extensions;
select plan(12);

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data)
values('00000000-0000-0000-0000-000000102001','authenticated','authenticated','center-cap-owner@example.test','x',now(),now(),now(),'{}','{}');
insert into public.clubs(id,code,name,owner_user_id,status)
values('00000000-0000-0000-0000-000000102101','CAP-TEST','Cap Test Center','00000000-0000-0000-0000-000000102001','active');
insert into public.student_records(id,club_id,full_name,created_by) values
('00000000-0000-0000-0000-000000102201','00000000-0000-0000-0000-000000102101','First recipient','00000000-0000-0000-0000-000000102001'),
('00000000-0000-0000-0000-000000102202','00000000-0000-0000-0000-000000102101','Second recipient','00000000-0000-0000-0000-000000102001');
insert into public.center_connections(id,club_id,provider,status)
values('00000000-0000-0000-0000-000000102301','00000000-0000-0000-0000-000000102101','zbs','connected');
insert into public.center_communication_policies(club_id,template_key,provider_template_id,approval_status,enabled,daily_limit,quiet_start,quiet_end)
values('00000000-0000-0000-0000-000000102101','progress_summary','approved-template','approved',true,1,
 (extract(hour from now() at time zone 'Asia/Ho_Chi_Minh')::int+12)%24,
 (extract(hour from now() at time zone 'Asia/Ho_Chi_Minh')::int+12)%24);
insert into public.center_recipient_channels(id,club_id,student_record_id,channel,address,consent_at,verified_at) values
('00000000-0000-0000-0000-000000102401','00000000-0000-0000-0000-000000102101','00000000-0000-0000-0000-000000102201','zbs','+84905111111',now(),now()),
('00000000-0000-0000-0000-000000102402','00000000-0000-0000-0000-000000102101','00000000-0000-0000-0000-000000102202','zbs','+84905222222',now(),now());
insert into public.center_events(id,club_id,kind,subject_id,payload) values
('00000000-0000-0000-0000-000000102501','00000000-0000-0000-0000-000000102101','message.requested','00000000-0000-0000-0000-000000102201','{"input":{"templateKey":"progress_summary","studentRecordId":"00000000-0000-0000-0000-000000102201"}}'),
('00000000-0000-0000-0000-000000102502','00000000-0000-0000-0000-000000102101','message.requested','00000000-0000-0000-0000-000000102202','{"input":{"templateKey":"progress_summary","studentRecordId":"00000000-0000-0000-0000-000000102202"}}');

set local role service_role;
set local request.jwt.claim.role='service_role';
-- Both callers may receive an eligible context before either reserves capacity.
select is(public.center_notification_context('00000000-0000-0000-0000-000000102501')->>'allowed','true','first event is initially eligible');
select is(public.center_notification_context('00000000-0000-0000-0000-000000102502')->>'allowed','true','second event is initially eligible');
select is(public.center_reserve_delivery('00000000-0000-0000-0000-000000102501','zbs:00000000-0000-0000-0000-000000102401')->>'allowed','true','first reservation consumes the sole daily slot');
select is(public.center_reserve_delivery('00000000-0000-0000-0000-000000102502','zbs:00000000-0000-0000-0000-000000102402')->>'reason','deferred_daily_limit','second reservation rechecks the cap despite its earlier eligible context');
select is((select count(*)::int from public.center_event_receipts where event_id in ('00000000-0000-0000-0000-000000102501','00000000-0000-0000-0000-000000102502')),1,'cap deferral does not reserve another delivery');
select ok((select available_at>now() from public.center_events where id='00000000-0000-0000-0000-000000102502'),'deferred event receives a later retry time');
select is(public.center_reserve_delivery('00000000-0000-0000-0000-000000102501','zbs:00000000-0000-0000-0000-000000102401')->>'reason','delivery_unknown','processing receipt is never reserved twice');
select is(public.center_record_delivery('00000000-0000-0000-0000-000000102501','zbs:00000000-0000-0000-0000-000000102401','completed','provider-message')->>'status','completed','successful delivery records completion');
select is(public.center_reserve_delivery('00000000-0000-0000-0000-000000102501','zbs:00000000-0000-0000-0000-000000102401')->>'reason','already_completed','completed receipt remains idempotent even while cap is full');

set local role postgres;
-- Move the prior receipt outside today's budget, then revoke the second recipient.
update public.center_event_receipts set created_at=now()-interval '2 days' where event_id='00000000-0000-0000-0000-000000102501';
update public.center_recipient_channels set revoked_at=now() where id='00000000-0000-0000-0000-000000102402';
set local role service_role;
select is(public.center_notification_context('00000000-0000-0000-0000-000000102502')->>'allowed','true','the daily cap is open again before testing recipient revocation');
select is(public.center_reserve_delivery('00000000-0000-0000-0000-000000102502','zbs:00000000-0000-0000-0000-000000102402')->>'reason','recipient_not_eligible','fresh consent check denies a revoked recipient');
select is((select count(*)::int from public.center_event_receipts where event_id='00000000-0000-0000-0000-000000102502'),0,'revoked recipient creates no delivery receipt');
select * from finish();
rollback;
