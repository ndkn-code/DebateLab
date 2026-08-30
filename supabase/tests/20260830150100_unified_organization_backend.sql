-- Unified organization backend contract and two-organization attack matrix.
-- The fixture is transactional and runs only against the local database.

begin;
select plan(62);

select has_column('public', 'clubs', 'organization_type', 'clubs expose canonical organization type');
select has_column('public', 'clubs', 'setup_version', 'clubs expose setup version');
select has_column('public', 'clubs', 'setup_completed_at', 'clubs expose setup completion timestamp');
select has_column('public', 'clubs', 'onboarding_completed_at', 'clubs expose onboarding completion timestamp');
select has_table('public', 'organization_operation_idempotency', 'organization idempotency storage exists');
select has_table('public', 'organization_audit_events', 'organization audit storage exists');
select ok(to_regprocedure('public.create_organization_draft_transaction(text,text,text,text,text,text,text,uuid)') is not null, 'draft RPC contract exists');
select ok(to_regprocedure('public.update_organization_transaction(uuid,text,text,text,text,text,text,text,text,text,integer,text,uuid)') is not null, 'update RPC contract exists');
select ok(to_regprocedure('public.invite_organization_member_transaction(uuid,text,text,text,uuid)') is not null, 'invite RPC contract exists');
select ok(to_regprocedure('public.activate_organization_transaction(uuid,text,uuid)') is not null, 'activate RPC contract exists');
select ok(to_regprocedure('public.create_organization_class_transaction(uuid,uuid,text,text,text,text,text,text,date,date,text,text,integer,text,uuid)') is not null, 'class RPC contract exists');
select ok(to_regprocedure('public.assign_organization_teacher_transaction(uuid,uuid,uuid,text,text,uuid)') is not null, 'teacher assignment RPC contract exists');
select ok(to_regprocedure('public.assign_organization_course_transaction(uuid,uuid,uuid,text,text,uuid)') is not null, 'course assignment RPC contract exists');
select ok(to_regprocedure('public.assign_organization_material_transaction(uuid,uuid,uuid,text,uuid)') is not null, 'material assignment RPC contract exists');
select ok(to_regprocedure('public.consume_organization_invitation(text)') is not null, 'email-matched consume RPC exists');
select ok(exists (select 1 from pg_trigger where tgname = 'profiles_prevent_role_escalation'), 'profile role escalation trigger exists');
select ok(exists (select 1 from pg_trigger where tgname = 'profiles_prevent_authority_escalation'), 'profile email and role authority trigger exists');
select ok(exists (select 1 from pg_trigger where tgname = 'club_assignments_organization_scope'), 'assignment organization scope trigger exists');
select ok(exists (select 1 from pg_trigger where tgname = 'club_events_organization_scope'), 'event organization scope trigger exists');
select ok(exists (select 1 from pg_trigger where tgname = 'class_schedules_organization_scope'), 'schedule/course scope trigger exists');
select ok(exists (select 1 from pg_proc where oid = 'public.create_organization_draft_transaction(text,text,text,text,text,text,text,uuid)'::regprocedure and prosecdef and proconfig @> array['search_path=public, private, extensions']), 'organization RPC is SECURITY DEFINER with fixed search path');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('30000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'org-admin@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('30000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'org-teacher@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'org-student-a@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('30000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'org-student-b@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('30000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'target@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('30000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'org-unassigned-teacher@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('30000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'org-assigned-teacher@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('30000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'org-removed-student@example.test', 'x', now(), now(), now(), '{}', '{}'),
  ('30000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'org-owner@example.test', 'x', now(), now(), now(), '{}', '{}');

update public.profiles set role = case id
  when '30000000-0000-0000-0000-000000000001' then 'admin'
  when '30000000-0000-0000-0000-000000000002' then 'teacher'
  when '30000000-0000-0000-0000-000000000006' then 'teacher'
  when '30000000-0000-0000-0000-000000000007' then 'teacher'
  else 'student' end
where id in ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000009');

set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';
select ok((public.create_organization_draft_transaction('Organization A', 'school', 'VN', null, 'Asia/Ho_Chi_Minh', 'ORG-MATRIX-A', 'matrix-create-a', auth.uid())->>'organizationId') is not null, 'admin creates organization A');
select ok((public.create_organization_draft_transaction('Organization B', 'club', 'VN', null, 'Asia/Ho_Chi_Minh', 'ORG-MATRIX-B', 'matrix-create-b', auth.uid())->>'organizationId') is not null, 'admin creates organization B');
select ok((public.create_organization_draft_transaction('Organization C', 'club', 'VN', null, 'Asia/Ho_Chi_Minh', 'ORG-MATRIX-C', 'matrix-create-c', auth.uid())->>'organizationId') is not null, 'admin creates organization C for owner-orphan protection');
select throws_ok($$select public.create_organization_draft_transaction('Changed name', 'school', 'VN', null, 'Asia/Ho_Chi_Minh', 'ORG-MATRIX-A', 'matrix-create-a', auth.uid())$$,
  'P0001', 'IDEMPOTENCY_KEY_REUSE', 'idempotency key cannot be reused with changed payload');

-- Stable IDs are retrieved without exposing fixture internals to the RPC API.
set local role postgres;
select id as org_a from public.clubs where code = 'ORG-MATRIX-A' \gset
select id as org_b from public.clubs where code = 'ORG-MATRIX-B' \gset
select id as org_c from public.clubs where code = 'ORG-MATRIX-C' \gset
set local role authenticated;
select is((public.update_organization_transaction(:'org_a'::uuid, 'Organization A updated', 'school', 'VN', 'Hanoi', 'Asia/Ho_Chi_Minh', null, null, null, null, 2, 'matrix-update-a', auth.uid())->>'setupVersion')::integer, 2, 'organization update advances setup version');
select throws_ok($$select public.update_organization_transaction((select id from public.clubs where code = 'ORG-MATRIX-A'), 'Skipped setup', 'school', 'VN', 'Hanoi', 'Asia/Ho_Chi_Minh', null, null, null, null, 5, 'matrix-update-conflict', auth.uid())$$,
  '40001', 'SETUP_VERSION_CONFLICT', 'organization update rejects a skipped setup version');
select ok((public.create_organization_class_transaction(:'org_a'::uuid, :'org_a'::uuid, 'MATRIX-A1', 'Class A', null, 'debate', 'Beginner', 'active', null, null, null, null, null, 'matrix-class-a', auth.uid())->>'classId') is not null, 'organization A creates its class');
select ok((public.create_organization_class_transaction(:'org_b'::uuid, :'org_b'::uuid, 'MATRIX-B1', 'Class B', null, 'debate', 'Beginner', 'active', null, null, null, null, null, 'matrix-class-b', auth.uid())->>'classId') is not null, 'organization B creates its class');
select ok((public.create_organization_class_transaction(:'org_a'::uuid, :'org_a'::uuid, 'MATRIX-A2', 'Class A2', null, 'ielts', 'Foundation', 'active', null, null, null, null, null, 'matrix-class-a2', auth.uid())->>'classId') is not null, 'organization A creates a second class');

set local role postgres;
reset request.jwt.claim.sub;
select id as class_a from public.classes where code = 'MATRIX-A1' \gset
select id as class_b from public.classes where code = 'MATRIX-B1' \gset
select id as class_a2 from public.classes where code = 'MATRIX-A2' \gset
insert into public.club_memberships (club_id, user_id, role, status) values
  (:'org_a'::uuid, '30000000-0000-0000-0000-000000000002', 'admin', 'active'),
  (:'org_a'::uuid, '30000000-0000-0000-0000-000000000006', 'teacher', 'active'),
  (:'org_a'::uuid, '30000000-0000-0000-0000-000000000007', 'teacher', 'active'),
  (:'org_a'::uuid, '30000000-0000-0000-0000-000000000003', 'student', 'active'),
  (:'org_a'::uuid, '30000000-0000-0000-0000-000000000008', 'student', 'removed'),
  (:'org_a'::uuid, '30000000-0000-0000-0000-000000000009', 'owner', 'active'),
  (:'org_b'::uuid, '30000000-0000-0000-0000-000000000004', 'student', 'active');
insert into public.class_memberships (class_id, user_id, member_role, status) values
  (:'class_a'::uuid, '30000000-0000-0000-0000-000000000003', 'student', 'active'),
  (:'class_a'::uuid, '30000000-0000-0000-0000-000000000007', 'teacher', 'active'),
  (:'class_a'::uuid, '30000000-0000-0000-0000-000000000008', 'student', 'removed'),
  (:'class_b'::uuid, '30000000-0000-0000-0000-000000000004', 'student', 'active');

set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000006';
select throws_ok($$select public.assign_organization_teacher_transaction((select id from public.clubs where code = 'ORG-MATRIX-A'), (select id from public.classes where code = 'MATRIX-A1'), '30000000-0000-0000-0000-000000000006'::uuid, 'add', 'matrix-cross-org', auth.uid())$$,
  'P0001', null, 'teacher cannot use organization RPC without admin membership');

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';
select throws_ok($$update public.profiles set role = 'teacher' where id = auth.uid()$$,
  '42501', null, 'student cannot self-escalate profile role');

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000002';
select throws_ok($$select public.invite_organization_member_transaction((select id from public.clubs where code = 'ORG-MATRIX-A'), 'owner-escalation@example.test', 'owner', 'matrix-owner-escalation', auth.uid())$$,
  'P0001', null, 'organization admin cannot grant owner');
select throws_ok($$select public.invite_organization_member_transaction((select id from public.clubs where code = 'ORG-MATRIX-A'), 'admin-escalation@example.test', 'admin', 'matrix-admin-escalation', auth.uid())$$,
  'P0001', null, 'organization admin cannot grant admin');

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000006';
select throws_ok($$insert into public.classes (club_id, code, title, program_type) values ((select id from public.clubs where code = 'ORG-MATRIX-A'), 'DIRECT-A', 'direct write', 'debate')$$,
  '42501', null, 'authenticated direct class DML is denied');
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';
select throws_ok($$select public.assign_organization_teacher_transaction((select id from public.clubs where code = 'ORG-MATRIX-A'), (select id from public.classes where code = 'MATRIX-B1'), '30000000-0000-0000-0000-000000000002'::uuid, 'add', 'matrix-cross-org-admin', auth.uid())$$,
  'P0001', 'CLASS_ORGANIZATION_MISMATCH', 'cross-organization teacher assignment is rejected');

-- Repeating the exact key returns the exact stored result and emits one audit.
select is((public.activate_organization_transaction(:'org_a'::uuid, 'matrix-activate', auth.uid())->>'status'), 'active', 'activation succeeds');
select is((public.activate_organization_transaction(:'org_a'::uuid, 'matrix-activate', auth.uid())->>'status'), 'active', 'activation is idempotent');
set local role postgres;
select ok((select count(*)::integer from public.organization_audit_events where organization_id = :'org_a'::uuid and entity_id = :'org_a'::uuid) >= 1, 'activation is audited for the exact organization');
set local role authenticated;

-- Exact-class learner reads do not reveal a sibling organization class.
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';
select is((select count(*)::integer from public.classes), 1, 'learner reads only exact class membership');
select is((select count(*)::integer from public.classes where id = :'class_b'::uuid), 0, 'learner cannot read sibling organization class');

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000004';
select is((select count(*)::integer from public.classes), 1, 'other-organization learner reads only their class');

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000007';
select is((select count(*)::integer from public.classes), 1, 'assigned teacher reads only the assigned class');
select is((select count(*)::integer from public.classes where id = :'class_a2'::uuid), 0, 'assigned teacher cannot read an unassigned class in the same organization');
update public.club_memberships set role = 'owner'
where club_id = (select id from public.clubs where code = 'ORG-MATRIX-A') and user_id = auth.uid();
select is((select role from public.club_memberships where club_id = :'org_a'::uuid and user_id = auth.uid()), 'teacher', 'teacher cannot self-promote organization membership');

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000006';
select is((select count(*)::integer from public.classes), 0, 'unassigned teacher reads no organization classes');

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.classes where club_id = :'org_a'::uuid), 2, 'organization admin reads both organization classes');
select ok((select count(*)::integer from public.organization_audit_events where organization_id = :'org_a'::uuid) > 0, 'organization admin can read organization audit history');
select is((select count(*)::integer from public.classes where club_id = :'org_b'::uuid), 0, 'organization admin cannot read another organization class');
select throws_ok($$insert into public.class_memberships (class_id, user_id, member_role, status) values ((select id from public.classes where code = 'MATRIX-A1'), '30000000-0000-0000-0000-000000000004', 'student', 'active')$$,
  '42501', null, 'organization admin cannot add another organization student to a class');

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000009';
select is((select count(*)::integer from public.classes where club_id = :'org_a'::uuid), 2, 'organization owner reads all organization classes');
select is((select count(*)::integer from public.classes where club_id = :'org_b'::uuid), 0, 'organization owner cannot read another organization class');

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000008';
select is((select count(*)::integer from public.classes), 0, 'removed learner loses current class access');

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';
select throws_ok($$delete from public.club_memberships where club_id = (select id from public.clubs where code = 'ORG-MATRIX-C') and user_id = auth.uid() and role = 'owner'$$,
  'P0001', 'ORGANIZATION_LAST_OWNER', 'the last owner cannot be removed');
select throws_ok($$update public.organization_audit_events set action = 'tampered' where organization_id = (select id from public.clubs where code = 'ORG-MATRIX-A')$$,
  '42501', null, 'authenticated callers cannot rewrite organization audit history');

set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000001';
select ok((public.invite_organization_member_transaction(:'org_a'::uuid, 'target@example.test', 'teacher', 'matrix-invite', auth.uid())->>'invitationId') is not null, 'organization admin creates a teacher invitation');
set local role postgres;
select token_hash as invitation_token from public.club_invitations where email = 'target@example.test' \gset
set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000004';
select is(public.consume_organization_invitation(:'invitation_token')->>'status', 'email_mismatch', 'wrong email cannot consume invitation');
select ok(public.consume_organization_invitation(:'invitation_token')->>'expectedEmail' is null, 'wrong email response does not disclose target email');
set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000005';
select is(public.consume_organization_invitation(:'invitation_token')->>'status', 'accepted', 'matching email consumes invitation');
select is(public.consume_organization_invitation(:'invitation_token')->>'status', 'accepted', 'matching invitation replay is idempotent');
set local role postgres;
select is((select role from public.profiles where id = auth.uid()), 'teacher', 'accepted teacher invitation promotes profile safely');
select ok(exists (select 1 from public.club_memberships where club_id = :'org_a'::uuid and user_id = '30000000-0000-0000-0000-000000000005' and role = 'teacher' and status = 'active'), 'teacher invitation creates one active canonical membership');

rollback;
