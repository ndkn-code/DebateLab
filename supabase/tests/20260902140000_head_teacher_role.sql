-- Head Teacher role/capability contract and isolation checks.
begin;
select plan(34);
select ok(to_regprocedure('private.organization_can_academic_admin(uuid,uuid)') is not null, 'academic capability helper exists');
select ok(to_regprocedure('private.organization_can_manage_people(uuid,uuid)') is not null, 'people capability helper exists');
select ok(to_regprocedure('private.organization_can_manage_curriculum(uuid,uuid)') is not null, 'curriculum capability helper exists');
select ok(to_regprocedure('private.organization_can_override_review(uuid,uuid)') is not null, 'review override helper exists');
select ok((select p.prosecdef from pg_proc p where p.oid = to_regprocedure('private.organization_can_academic_admin(uuid,uuid)')), 'academic helper is security definer');
select ok((select p.proconfig @> array['search_path=public, private, extensions'] from pg_proc p where p.oid = to_regprocedure('private.organization_can_manage_people(uuid,uuid)')), 'people helper pins search path');
select ok(exists (select 1 from pg_constraint where conname = 'club_memberships_role_check' and pg_get_constraintdef(oid) like '%head_teacher%'), 'membership accepts head_teacher');
select ok(exists (select 1 from pg_constraint where conname = 'club_invitations_role_check' and pg_get_constraintdef(oid) like '%head_teacher%'), 'invitation accepts head_teacher');
select ok(not exists (select 1 from pg_attribute where attrelid = 'public.profiles'::regclass and attname = 'head_teacher'), 'head_teacher is not a profile column');
select ok(exists (select 1 from pg_trigger where tgname = 'club_memberships_organization_mutation'), 'membership mutation guard remains installed');
select ok(exists (select 1 from pg_trigger where tgname = 'club_invitations_organization_mutation'), 'invitation mutation guard remains installed');
select ok(to_regprocedure('public.invite_organization_member_transaction(uuid,text,text,text,uuid)') is not null, 'invite RPC contract remains stable');
select ok((select p.prosecdef from pg_proc p where p.oid = to_regprocedure('public.invite_organization_member_transaction(uuid,text,text,text,uuid)')), 'invite RPC is security definer');
select ok((select p.proconfig @> array['search_path=public, private, extensions'] from pg_proc p where p.oid = to_regprocedure('public.invite_organization_member_transaction(uuid,text,text,text,uuid)')), 'invite RPC pins search path');
select ok(has_function_privilege('authenticated', 'private.organization_can_academic_admin(uuid,uuid)', 'execute'), 'authenticated can evaluate academic capability');
select ok(not has_function_privilege('anon', 'private.organization_can_academic_admin(uuid,uuid)', 'execute'), 'anonymous cannot evaluate academic capability');

-- Real two-organization matrix. All rows are rolled back with this test.
set local role postgres;
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
 ('40000000-0000-0000-0000-000000000001','authenticated','authenticated','matrix-platform@example.test','x',now(),now(),now(),'{}','{}'),
 ('40000000-0000-0000-0000-000000000002','authenticated','authenticated','matrix-owner@example.test','x',now(),now(),now(),'{}','{}'),
 ('40000000-0000-0000-0000-000000000003','authenticated','authenticated','matrix-org-admin@example.test','x',now(),now(),now(),'{}','{}'),
 ('40000000-0000-0000-0000-000000000004','authenticated','authenticated','matrix-head@example.test','x',now(),now(),now(),'{}','{}'),
 ('40000000-0000-0000-0000-000000000005','authenticated','authenticated','matrix-teacher@example.test','x',now(),now(),now(),'{}','{}'),
 ('40000000-0000-0000-0000-000000000006','authenticated','authenticated','matrix-student@example.test','x',now(),now(),now(),'{}','{}'),
 ('40000000-0000-0000-0000-000000000007','authenticated','authenticated','matrix-other@example.test','x',now(),now(),now(),'{}','{}')
on conflict (id) do nothing;
update public.profiles set role = case id
  when '40000000-0000-0000-0000-000000000001' then 'admin'
  when '40000000-0000-0000-0000-000000000005' then 'teacher'
  else 'student' end
where id in ('40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000007');
set local role authenticated;
set local search_path = public, extensions;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000001';
select ok((public.create_organization_draft_transaction('Matrix Head A','school','VN',null,'Asia/Ho_Chi_Minh','MATRIX-HEAD-A','head-create-a','40000000-0000-0000-0000-000000000001'::uuid)->>'organizationId') is not null, 'platform admin creates organization A');
select ok((public.create_organization_draft_transaction('Matrix Head B','club','VN',null,'Asia/Ho_Chi_Minh','MATRIX-HEAD-B','head-create-b','40000000-0000-0000-0000-000000000001'::uuid)->>'organizationId') is not null, 'platform admin creates organization B');
set local role postgres;
set local search_path = public, extensions;
select id as head_org_a from public.clubs where code='MATRIX-HEAD-A' \gset
select id as head_org_b from public.clubs where code='MATRIX-HEAD-B' \gset
insert into public.club_memberships (club_id,user_id,role,status,joined_at)
values
 (:'head_org_a'::uuid,'40000000-0000-0000-0000-000000000002','owner','active',now()),
 (:'head_org_a'::uuid,'40000000-0000-0000-0000-000000000003','admin','active',now()),
 (:'head_org_a'::uuid,'40000000-0000-0000-0000-000000000004','head_teacher','active',now()),
 (:'head_org_a'::uuid,'40000000-0000-0000-0000-000000000005','teacher','active',now()),
 (:'head_org_a'::uuid,'40000000-0000-0000-0000-000000000006','student','active',now()),
 (:'head_org_b'::uuid,'40000000-0000-0000-0000-000000000007','student','active',now());
set local role authenticated;
set local search_path = public, extensions;
set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000003';
select ok((public.invite_organization_member_transaction(:'head_org_a'::uuid,'appointed-head@example.test','head_teacher','head-appoint-a','40000000-0000-0000-0000-000000000003'::uuid)->>'role') = 'head_teacher', 'organization admin appoints head teacher');
set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000004';
select ok((public.manage_organization_member_transaction(:'head_org_a'::uuid,'40000000-0000-0000-0000-000000000007'::uuid,'teacher','add',null,'head-add-teacher','40000000-0000-0000-0000-000000000004'::uuid)->>'status') = 'active', 'head teacher manages teacher membership');
select ok((public.manage_organization_member_transaction(:'head_org_a'::uuid,'40000000-0000-0000-0000-000000000006'::uuid,'student','update',null,'head-update-student','40000000-0000-0000-0000-000000000004'::uuid)->>'status') = 'active', 'head teacher manages student membership');
select throws_ok($$select public.invite_organization_member_transaction((select id from public.clubs where code='MATRIX-HEAD-A'),'admin-escalate@example.test','admin','head-invite-admin','40000000-0000-0000-0000-000000000004'::uuid)$$, '42501', null, 'head teacher cannot invite admin');
select throws_ok($$select public.manage_organization_member_transaction((select id from public.clubs where code='MATRIX-HEAD-A'),'40000000-0000-0000-0000-000000000007'::uuid,'head_teacher','update',null,'head-promote-peer','40000000-0000-0000-0000-000000000004'::uuid)$$, '42501', null, 'head teacher cannot appoint peer');
select throws_ok($$select public.manage_organization_member_transaction((select id from public.clubs where code='MATRIX-HEAD-B'),'40000000-0000-0000-0000-000000000007'::uuid,'student','update',null,'head-cross-org','40000000-0000-0000-0000-000000000004'::uuid)$$, '42501', null, 'head teacher cannot manage another organization');
select throws_ok($$insert into public.club_memberships (club_id,user_id,role,status) values ((select id from public.clubs where code='MATRIX-HEAD-A'),'40000000-0000-0000-0000-000000000007','student','active')$$, '42501', null, 'direct authenticated membership DML is denied');
set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000002';
select ok((public.manage_organization_member_transaction(:'head_org_a'::uuid,'40000000-0000-0000-0000-000000000007'::uuid,'admin','update',null,'owner-manage-admin','40000000-0000-0000-0000-000000000002'::uuid)->>'role') = 'admin', 'owner may manage admin membership');
select throws_ok($$select public.manage_organization_member_transaction((select id from public.clubs where code='MATRIX-HEAD-A'),'40000000-0000-0000-0000-000000000002'::uuid,'student','update',null,'owner-demote-owner','40000000-0000-0000-0000-000000000002'::uuid)$$, '42501', null, 'owner cannot demote owner through member RPC');
select public.invite_organization_member_transaction(:'head_org_a'::uuid,'idempotent-head@example.test','head_teacher','owner-idempotent-head','40000000-0000-0000-0000-000000000002'::uuid);
select throws_ok($$select public.invite_organization_member_transaction((select id from public.clubs where code='MATRIX-HEAD-A'),'changed-head@example.test','head_teacher','owner-idempotent-head','40000000-0000-0000-0000-000000000002'::uuid)$$, 'P0001', 'IDEMPOTENCY_KEY_REUSE', 'idempotency mismatch is rejected');
select id as admin_membership, updated_at as admin_updated_at from public.club_memberships where club_id=:'head_org_a'::uuid and user_id='40000000-0000-0000-0000-000000000007' \gset
select throws_ok($$select public.manage_organization_member_transaction((select id from public.clubs where code='MATRIX-HEAD-A'),'40000000-0000-0000-0000-000000000007'::uuid,'student','update','2000-01-01T00:00:00Z'::timestamptz,'stale-member','40000000-0000-0000-0000-000000000002'::uuid)$$, 'P0001', 'STALE_MEMBER', 'stale membership update is rejected');
select ok(exists (select 1 from public.organization_audit_events where organization_id=:'head_org_a'::uuid and action like 'member_%'), 'membership operations are audited');
select ok((private.organization_can_academic_admin(:'head_org_a'::uuid,'40000000-0000-0000-0000-000000000004'::uuid)), 'head teacher academic capability is true');
select ok((not private.organization_can_override_review(:'head_org_a'::uuid,'40000000-0000-0000-0000-000000000002'::uuid)), 'owner has no non-lead review override capability');
select ok((private.organization_can_override_review(:'head_org_a'::uuid,'40000000-0000-0000-0000-000000000004'::uuid)), 'head teacher review override capability is true');
set local role postgres;
set local search_path = public, extensions;
select throws_ok($$update public.organization_audit_events set payload='{"tampered":true}'::jsonb where organization_id=(select id from public.clubs where code='MATRIX-HEAD-A')$$, '42501', null, 'audit events are immutable');
select * from finish();
rollback;
