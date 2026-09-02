-- Correct the first output-fence definition for deployments where provider
-- attempt accounting is deliberately best-effort. A validated output must be
-- persisted even when the observable attempt count is still zero; operational
-- release evidence remains fail-closed until a positive fence is available.

begin;

create or replace function public.checkpoint_ai_grading_output(
  p_run_id uuid,
  p_claim_token uuid,
  p_payload jsonb,
  p_hash text,
  p_version integer default 1
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_existing text;
  v_provider_attempt_count integer;
begin
  if p_payload is null or p_hash is null or char_length(p_hash) <> 64
     or p_version is null or p_version < 1 then
    raise exception 'AI_GRADING_OUTPUT_INVALID';
  end if;
  select run.provider_attempt_count into v_provider_attempt_count
  from public.ai_workflow_runs run
  where run.id = p_run_id
    and run.worker_claim_token = p_claim_token
    and run.status = 'running'
    and run.lease_expires_at > now()
  for share;
  if not found then raise exception 'AI_GRADING_CLAIM_LOST'; end if;
  select output_hash into v_existing from public.ai_grading_checkpoints
   where workflow_run_id = p_run_id for update;
  if not found then raise exception 'AI_GRADING_CHECKPOINT_NOT_FOUND'; end if;
  if v_existing is not null and v_existing <> p_hash then
    raise exception 'AI_GRADING_OUTPUT_CONFLICT';
  end if;
  update public.ai_grading_checkpoints set
    output_payload = coalesce(output_payload, p_payload),
    output_hash = coalesce(output_hash, p_hash),
    output_version = coalesce(output_version, p_version),
    provider_attempt_count_at_output = coalesce(
      provider_attempt_count_at_output,
      case
        when v_provider_attempt_count >= 1 then v_provider_attempt_count
        else null
      end
    ),
    provider_completed_at = coalesce(provider_completed_at, now()),
    updated_at = now()
  where workflow_run_id = p_run_id;
  return true;
end;
$$;

revoke all on function public.checkpoint_ai_grading_output(
  uuid, uuid, jsonb, text, integer
) from public, anon, authenticated;
grant execute on function public.checkpoint_ai_grading_output(
  uuid, uuid, jsonb, text, integer
) to service_role;

commit;
