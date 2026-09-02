begin;

-- Idempotency receipts contain request hashes and cached RPC results. They are
-- an internal implementation detail: SECURITY DEFINER LMS operations may use
-- them, but browser roles must never read or mutate them directly.
revoke all on table public.lms_operation_receipts from anon, authenticated;

drop policy if exists "No direct LMS operation receipt access"
  on public.lms_operation_receipts;
create policy "No direct LMS operation receipt access"
  on public.lms_operation_receipts
  for all
  to anon, authenticated
  using (false)
  with check (false);

commit;
