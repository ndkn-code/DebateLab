-- Provider usage is worker-only. Make the existing deny-all RLS intent explicit.
create policy organization_question_import_usage_no_client_access
  on public.organization_question_import_usage
  for all to anon, authenticated
  using (false) with check (false);
