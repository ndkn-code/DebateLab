\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_status(actual jsonb, expected text) returns void language plpgsql as $$
begin if actual->>'status' is distinct from expected then raise exception 'Expected %, got %',expected,actual; end if; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.manage_class_join_invitation('20000000-0000-0000-0000-000000000002','create') #>> '{invitation,code}' as code \gset
select pg_temp.assert_status(public.manage_class_join_invitation('20000000-0000-0000-0000-000000000002',null),'unavailable');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
set local role authenticated;
select pg_temp.assert_status(public.manage_class_join_invitation('20000000-0000-0000-0000-000000000002','create'),'forbidden');
select pg_temp.assert_status(public.claim_class_join_invitation('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),'invalid');
do $$ begin
 if exists(select 1 from public.class_join_invitations) then raise exception 'Learner can enumerate codes'; end if;
 begin insert into public.class_join_invitations(class_id,code,created_by) values(gen_random_uuid(),repeat('a',32),auth.uid()); raise exception 'direct write allowed'; exception when insufficient_privilege then null; end;
 begin perform * from public.class_join_invitation_claims; raise exception 'ledger read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Expiry, revocation, and exhausted states agree between preview and claim.
update public.class_join_invitations set expires_at=now()-interval '1 second' where code=:'code';
select pg_temp.assert_status(public.resolve_class_join_invitation(:'code'),'expired');
select pg_temp.assert_status(public.claim_class_join_invitation(:'code'),'expired');
update public.class_join_invitations set expires_at=now()+interval '1 day',revoked_at=now() where code=:'code';
select pg_temp.assert_status(public.claim_class_join_invitation(:'code'),'revoked');
update public.class_join_invitations set revoked_at=null,max_uses=1,use_count=1 where code=:'code';
select pg_temp.assert_status(public.claim_class_join_invitation(:'code'),'exhausted');
update public.class_join_invitations set use_count=0 where code=:'code';
update public.classes set status='archived' where id='20000000-0000-0000-0000-000000000002';
select pg_temp.assert_status(public.claim_class_join_invitation(:'code'),'archived');
update public.classes set status='active' where id='20000000-0000-0000-0000-000000000002';
-- Cross-center membership is never created or upgraded.
update public.club_memberships set club_id='10000000-0000-0000-0000-000000000002' where user_id=auth.uid();
select pg_temp.assert_status(public.resolve_class_join_invitation(:'code'),'organization_required');
select pg_temp.assert_status(public.claim_class_join_invitation(:'code'),'organization_required');
update public.club_memberships set club_id='10000000-0000-0000-0000-000000000001' where user_id=auth.uid();
-- A removed student cannot self-reactivate.
insert into public.class_memberships(class_id,user_id,member_role,status) values('20000000-0000-0000-0000-000000000002',auth.uid(),'student','removed');
select pg_temp.assert_status(public.claim_class_join_invitation(:'code'),'forbidden');
delete from public.class_memberships where user_id=auth.uid();
update public.profiles set role='teacher' where id=auth.uid();
select pg_temp.assert_status(public.claim_class_join_invitation(:'code'),'ineligible');
update public.profiles set role='student' where id=auth.uid();
-- Original manager must still have authority at claim time.
update public.club_memberships set status='removed' where user_id='00000000-0000-0000-0000-000000000001';
select pg_temp.assert_status(public.resolve_class_join_invitation(:'code'),'forbidden');
select pg_temp.assert_status(public.claim_class_join_invitation(:'code'),'forbidden');
update public.club_memberships set status='active' where user_id='00000000-0000-0000-0000-000000000001';
-- A failed audit rolls back membership, ledger and use count together.
create function pg_temp.fail_audit() returns trigger language plpgsql as $$ begin raise exception 'qa audit failure'; end $$;
create trigger qa_fail_audit before insert on public.admin_activity_log for each row execute function pg_temp.fail_audit();
select set_config('qa.invite_code',:'code',true);
do $$ begin
 begin perform public.claim_class_join_invitation(current_setting('qa.invite_code')); raise exception 'expected audit failure';
 exception when others then if sqlerrm <> 'qa audit failure' then raise; end if; end;
 if exists(select 1 from public.class_memberships where user_id=auth.uid()) then raise exception 'partial membership committed'; end if;
 if exists(select 1 from public.class_join_invitation_claims where user_id=auth.uid()) then raise exception 'partial ledger committed'; end if;
 if (select use_count from public.class_join_invitations where code=current_setting('qa.invite_code')) <> 0 then raise exception 'partial usage committed'; end if;
end $$;
drop trigger qa_fail_audit on public.admin_activity_log;
set local role authenticated;
select pg_temp.assert_status(public.claim_class_join_invitation(:'code'),'joined');
select pg_temp.assert_status(public.claim_class_join_invitation(:'code'),'already_joined');
reset role;
update public.class_join_invitations set revoked_at=now(),expires_at=now()-interval '1 second' where code=:'code';
select pg_temp.assert_status(public.resolve_class_join_invitation(:'code'),'already_joined');
select pg_temp.assert_status(public.claim_class_join_invitation(:'code'),'already_joined');
rollback;
select 'security and audit rollback checks passed' as result;
