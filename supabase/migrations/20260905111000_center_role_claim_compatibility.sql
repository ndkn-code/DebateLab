begin;

-- Re-emit the latest definitions while replacing the legacy GUC role lookup.
-- PostgREST exposes claims as JSON, which Supabase's auth.role() reads.
do $migration$
declare
  target regprocedure;
  definition text;
begin
  foreach target in array array[
    'public.center_google_connection_context(uuid,uuid)'::regprocedure,
    'public.center_google_projection(uuid,uuid,jsonb,text,text)'::regprocedure,
    'public.center_queue_google_material(uuid,uuid,text,text,jsonb,text,bigint)'::regprocedure,
    'public.center_revoke_google_material(uuid,uuid)'::regprocedure,
    'private.center_guard_calendar_authority()'::regprocedure,
    'public.center_project_calendar(uuid,uuid,jsonb,timestamptz,timestamptz)'::regprocedure,
    'public.center_calendar_command_context(uuid)'::regprocedure
  ] loop
    select pg_get_functiondef(target) into definition;
    if definition is null then
      raise exception 'Missing role-guarded function: %', target;
    end if;
    definition := replace(definition,
      'coalesce(current_setting(''request.jwt.claim.role'', true),'''')',
      'coalesce(auth.role(),'''')');
    definition := replace(definition,
      'coalesce(current_setting(''request.jwt.claim.role'',true),'''')',
      'coalesce(auth.role(),'''')');
    if position('request.jwt.claim.role' in definition) > 0
       or position('auth.role()' in definition) = 0 then
      raise exception 'Unexpected role guard definition: %', target;
    end if;
    execute definition;
  end loop;
end
$migration$;

commit;
