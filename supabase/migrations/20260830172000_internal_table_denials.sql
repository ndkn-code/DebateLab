-- Internal orchestration tables are written only by SECURITY DEFINER RPCs or
-- service-role workers. Make their client denial explicit for RLS audits.

begin;

drop policy if exists "No direct AI grading checkpoint access"
  on public.ai_grading_checkpoints;
create policy "No direct AI grading checkpoint access"
on public.ai_grading_checkpoints
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "No direct organization idempotency access"
  on public.organization_operation_idempotency;
create policy "No direct organization idempotency access"
on public.organization_operation_idempotency
for all
to anon, authenticated
using (false)
with check (false);

commit;
