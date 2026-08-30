begin;

-- The view is owned by postgres and previously executed with owner privileges,
-- bypassing the caller's RLS context on api_usage. Preserve the useful view for
-- signed-in and service callers while enforcing the underlying table policies.
do $$
begin
  -- Older hosted projects contain this legacy view, while a clean schema built
  -- from the current repository does not. Keep the forward fix reset-safe.
  if to_regclass('public.monthly_usage_summary') is not null then
    execute 'alter view public.monthly_usage_summary set (security_invoker = true)';
    execute 'revoke all on table public.monthly_usage_summary from public, anon';
    execute 'grant select on table public.monthly_usage_summary to authenticated, service_role';
  end if;
end;
$$;

commit;
