begin;
set local search_path = public, extensions;
select plan(12);

set local role postgres;
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) values
 ('73000000-0000-0000-0000-000000000001','authenticated','authenticated','security-owner@example.test','x',now(),now(),now(),'{}','{}'),
 ('73000000-0000-0000-0000-000000000002','authenticated','authenticated','security-guardian@example.test','x',now(),now(),now(),'{}','{}') on conflict (id) do nothing;
update public.profiles set role='teacher' where id='73000000-0000-0000-0000-000000000001';
insert into public.clubs(id,code,name,owner_user_id,status) values ('73000000-0000-0000-0000-000000000010','SEC-7300','Security Center','73000000-0000-0000-0000-000000000001','active') on conflict (id) do nothing;
insert into public.club_memberships(club_id,user_id,role,status) values ('73000000-0000-0000-0000-000000000010','73000000-0000-0000-0000-000000000001','owner','active') on conflict do nothing;
insert into public.classes(id,club_id,code,title,status,max_students,created_by) values ('73000000-0000-0000-0000-000000000020','73000000-0000-0000-0000-000000000010','SEC-A','Security Class','active',10,'73000000-0000-0000-0000-000000000001') on conflict (id) do nothing;
insert into public.student_records(id,club_id,full_name,student_code,user_id) values ('73000000-0000-0000-0000-000000000030','73000000-0000-0000-0000-000000000010','Security Student','SEC-STUDENT',null) on conflict (id) do nothing;
insert into public.center_offers(id,club_id,student_record_id,class_id,amount,starts_on,ends_on) values ('73000000-0000-0000-0000-000000000040','73000000-0000-0000-0000-000000000010','73000000-0000-0000-0000-000000000030','73000000-0000-0000-0000-000000000020',250000,'2099-01-01','2099-12-31') on conflict (id) do nothing;
insert into public.center_invoices(id,club_id,offer_id,amount) values ('73000000-0000-0000-0000-000000000050','73000000-0000-0000-0000-000000000010','73000000-0000-0000-0000-000000000040',250000) on conflict (id) do nothing;
insert into public.center_connections(id,club_id,provider,status) values ('73000000-0000-0000-0000-000000000060','73000000-0000-0000-0000-000000000010','zalopay','sandbox') on conflict (id) do nothing;

set local role authenticated;
set local request.jwt.claim.sub='73000000-0000-0000-0000-000000000001';
select ok((public.center_create_guardian_invite('73000000-0000-0000-0000-000000000010','73000000-0000-0000-0000-000000000030','Parent','security-guardian@example.test',null,'security-guardian-key')->>'token') is not null,'manager receives a one-time guardian token');
set local role postgres;
select (public.center_create_guardian_invite('73000000-0000-0000-0000-000000000010','73000000-0000-0000-0000-000000000030','Parent','security-guardian@example.test',null,'security-guardian-key')->>'guardianId')::uuid as guardian_id, (select id from private.center_guardian_invites where idempotency_key='security-guardian-key') invite_id \gset
set local role authenticated;
set local request.jwt.claim.sub='73000000-0000-0000-0000-000000000001';
select is((public.center_create_guardian_invite('73000000-0000-0000-0000-000000000010','73000000-0000-0000-0000-000000000030','Parent','security-guardian@example.test',null,'security-guardian-key')->>'alreadyCreated')::boolean,true,'guardian invite key is idempotent without reissuing a token');
set local role authenticated;
set local request.jwt.claim.sub='73000000-0000-0000-0000-000000000002';
select throws_ok($$select public.center_claim_guardian_invite(encode(gen_random_bytes(32),'base64'))$$,'P0001',null,'random guardian token cannot claim a relationship');
set local role postgres;
update private.center_guardian_invites set revoked_at=now() where id=:'invite_id'::uuid;
set local role authenticated;
set local request.jwt.claim.sub='73000000-0000-0000-0000-000000000002';
select throws_ok($$select public.center_guardian_progress('73000000-0000-0000-0000-000000000030')$$,'42501',null,'unverified or revoked guardian cannot read progress');

set local role service_role;
set local request.jwt.claim.role='service_role';
select is((public.center_prepare_payment('73000000-0000-0000-0000-000000000050','73000000-0000-0000-0000-000000000060','security-order-1')->>'reused')::boolean,false,'first payment preparation creates an attempt');
select is((public.center_prepare_payment('73000000-0000-0000-0000-000000000050','73000000-0000-0000-0000-000000000060','security-order-1')->>'reused')::boolean,true,'payment preparation replay reuses the pending attempt');
select is((public.center_apply_verified_payment('73000000-0000-0000-0000-000000000060','security-order-1','security-tx-1',250000)->>'status'),'paid','valid payment is recorded');
select is((public.center_apply_verified_payment('73000000-0000-0000-0000-000000000060','security-order-1','security-tx-1',250000)->>'replayed')::boolean,true,'same provider callback replays idempotently');
set local role postgres;
select is((select count(*)::integer from public.center_events where kind='payment.completed' and subject_id=(select id from public.center_payment_attempts where provider_order_id='security-order-1')),1,'payment completed event is emitted once');
insert into public.center_offers(id,club_id,student_record_id,class_id,amount,starts_on,ends_on) values ('73000000-0000-0000-0000-000000000041','73000000-0000-0000-0000-000000000010','73000000-0000-0000-0000-000000000030','73000000-0000-0000-0000-000000000020',250000,'2099-01-01','2099-12-31');
insert into public.center_invoices(id,club_id,offer_id,amount) values ('73000000-0000-0000-0000-000000000051','73000000-0000-0000-0000-000000000010','73000000-0000-0000-0000-000000000041',250000);
set local role service_role;
select lives_ok($$select public.center_prepare_payment('73000000-0000-0000-0000-000000000051','73000000-0000-0000-0000-000000000060','security-order-2')$$,'a separate invoice can be prepared after another payment');
select throws_ok($$select public.center_apply_verified_payment('73000000-0000-0000-0000-000000000060','security-order-2','security-tx-1',250000)$$,null,null,'provider transaction cannot be reused on another order');
select throws_ok($$select public.center_attach_checkout((select id from public.center_payment_attempts where provider_order_id='security-order-2'),'https://evil.example/checkout',now()+interval '1 hour')$$,null,null,'unallowlisted checkout URL is rejected');
select * from finish();
rollback;
