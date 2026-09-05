-- Local integration harness. Apply the migration first, then run this file
-- through class-join-invitations.integration.sh. The transaction is rolled back.
\set ON_ERROR_STOP on
begin;

select 1 / case when not has_table_privilege('anon', 'public.class_join_invitations', 'select') then 1 else 0 end;
select 1 / case when not has_function_privilege('anon', 'public.claim_class_join_invitation(text)', 'execute') then 1 else 0 end;
set role anon;
do $$ begin
  begin
    perform public.claim_class_join_invitation('00000000000000000000000000000000');
    raise exception 'anon unexpectedly executed claim RPC';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role authenticated;
select 1 / case when public.claim_class_join_invitation('00000000000000000000000000000000')->>'status' = 'forbidden' then 1 else 0 end;
reset role;

select set_config('request.jwt.claim.sub', :'manager_id', true);
select public.manage_class_join_invitation(:'class_id'::uuid, 'create') as payload \gset manager_
select (:'manager_payload'::jsonb #>> '{invitation,id}')::uuid as invitation_id,
       :'manager_payload'::jsonb #>> '{invitation,code}' as invitation_code \gset

select 1 / case when :'manager_payload'::jsonb->>'status' = 'ready' and :'invitation_code' ~ '^[0-9a-f]{32}$' then 1 else 0 end;

select public.manage_class_join_invitation(:'class_id'::uuid, 'get') as payload \gset manager_get_
select 1 / case when :'manager_get_payload'::jsonb #>> '{invitation,id}' = :'invitation_id' then 1 else 0 end;

select set_config('request.jwt.claim.sub', :'student_id', true);
select public.resolve_class_join_invitation(:'invitation_code') as payload \gset resolve_
select 1 / case when :'resolve_payload'::jsonb->>'status' = 'ready' then 1 else 0 end;

select public.claim_class_join_invitation(:'invitation_code') as payload \gset claim_
select 1 / case when :'claim_payload'::jsonb->>'status' = 'joined' then 1 else 0 end;
select 1 / case when (select count(*) from public.class_memberships where class_id = :'class_id'::uuid and user_id = :'student_id'::uuid and member_role = 'student' and status = 'active') = 1 then 1 else 0 end;
select 1 / case when (select count(*) from public.class_join_invitation_claims where invitation_id = :'invitation_id'::uuid and user_id = :'student_id'::uuid) = 1 then 1 else 0 end;
select 1 / case when (select count(*) from public.admin_activity_log where action = 'claim_class_join_invitation' and entity_id = :'class_id'::uuid) = 1 then 1 else 0 end;

select public.claim_class_join_invitation(:'invitation_code') as payload \gset replay_
select 1 / case when :'replay_payload'::jsonb->>'status' = 'already_joined' then 1 else 0 end;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select public.resolve_class_join_invitation(:'invitation_code') as payload \gset full_
select 1 / case when :'full_payload'::jsonb->>'status' = 'full' then 1 else 0 end;

select set_config('request.jwt.claim.sub', :'manager_id', true);
select public.manage_class_join_invitation(:'class_id'::uuid, 'replace', gen_random_uuid()) as payload \gset stale_
select 1 / case when :'stale_payload'::jsonb->>'status' = 'stale' then 1 else 0 end;

select public.manage_class_join_invitation('20000000-0000-0000-0000-000000000002'::uuid, 'create') as payload \gset uses_create_
select (:'uses_create_payload'::jsonb #>> '{invitation,id}')::uuid as uses_invitation_id,
       :'uses_create_payload'::jsonb #>> '{invitation,code}' as uses_code \gset
update public.class_join_invitations set max_uses = 1 where id = :'uses_invitation_id'::uuid;
select set_config('request.jwt.claim.sub', :'student_id', true);
select public.claim_class_join_invitation(:'uses_code') as payload \gset uses_claim_
select 1 / case when :'uses_claim_payload'::jsonb->>'status' = 'joined' then 1 else 0 end;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select public.claim_class_join_invitation(:'uses_code') as payload \gset uses_exhausted_
select 1 / case when :'uses_exhausted_payload'::jsonb->>'status' = 'exhausted' then 1 else 0 end;

rollback;
select 'class join invitation integration harness passed' as result;
