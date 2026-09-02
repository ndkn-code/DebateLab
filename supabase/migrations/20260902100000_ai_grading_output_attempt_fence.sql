-- Capture the provider-attempt ordinal at the first validated output checkpoint.
-- Operational recovery scenarios may legitimately have earlier definite
-- provider failures, but no provider attempt may occur after this fence.

begin;

alter table public.ai_grading_checkpoints
  add column if not exists provider_attempt_count_at_output integer;

alter table public.ai_grading_checkpoints
  drop constraint if exists ai_grading_checkpoints_output_attempt_count_check;
alter table public.ai_grading_checkpoints
  add constraint ai_grading_checkpoints_output_attempt_count_check
  check (
    provider_attempt_count_at_output is null
    or provider_attempt_count_at_output >= 1
  );

create or replace function private.protect_ai_grading_output_attempt_count()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_current_attempt_count integer;
begin
  if tg_op = 'INSERT' then
    if new.provider_attempt_count_at_output is not null then
      raise exception 'AI grading output provider-attempt fence must start empty';
    end if;
    return new;
  end if;
  if old.provider_attempt_count_at_output is not null
     and new.provider_attempt_count_at_output is distinct from
       old.provider_attempt_count_at_output then
    raise exception 'AI grading output provider-attempt fence is immutable';
  end if;
  if old.provider_attempt_count_at_output is null
     and new.provider_attempt_count_at_output is not null then
    if new.output_payload is null then
      raise exception 'AI grading output provider-attempt fence requires output';
    end if;
    select run.provider_attempt_count into v_current_attempt_count
    from public.ai_workflow_runs run
    where run.id = new.workflow_run_id;
    if not found
       or new.provider_attempt_count_at_output is distinct from
         v_current_attempt_count then
      raise exception 'AI grading output provider-attempt fence mismatch';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_ai_grading_output_attempt_count()
  from public, anon, authenticated, service_role;

drop trigger if exists ai_grading_output_attempt_count_immutable
  on public.ai_grading_checkpoints;
create trigger ai_grading_output_attempt_count_immutable
  before insert or update on public.ai_grading_checkpoints
  for each row execute function private.protect_ai_grading_output_attempt_count();

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

create or replace function public.finalize_ai_grading_operational_scenario(
  p_claim_id uuid, p_injection_token uuid,
  p_invalid_authoritative_citation_count integer, p_details_hash text
)
returns public.ai_grading_operational_scenarios
language plpgsql security definer set search_path = ''
as $$
declare
  v_claim public.ai_grading_operational_claims%rowtype;
  v_evidence public.ai_grading_operational_evidence%rowtype;
  v_run public.ai_workflow_runs%rowtype;
  v_checkpoint public.ai_grading_checkpoints%rowtype;
  v_expected_provider_calls integer;
  v_success_provider_calls integer;
  v_claim_event_count integer;
  v_second_claim_at timestamptz;
  v_first_output_at timestamptz;
  v_first_persistence_at timestamptz;
  v_passed boolean := false;
  v_marker jsonb;
  v_result public.ai_grading_operational_scenarios%rowtype;
begin
  select * into v_claim from public.ai_grading_operational_claims
    where id = p_claim_id and injection_token = p_injection_token for share;
  if not found then raise exception 'Operational claim not found'; end if;
  select * into v_evidence from public.ai_grading_operational_evidence
    where id = v_claim.evidence_id and status = 'collecting' for share;
  if not found then raise exception 'Collecting operational evidence not found'; end if;
  select * into v_run from public.ai_workflow_runs where id = v_claim.workflow_run_id for share;
  select * into v_checkpoint from public.ai_grading_checkpoints
    where workflow_run_id = v_claim.workflow_run_id;
  if p_invalid_authoritative_citation_count < 0 or p_details_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid operational scenario evidence';
  end if;
  if v_run.status not in ('completed', 'failed') or v_run.updated_at < v_claim.declared_at then
    raise exception 'Operational workflow is not terminal after declaration';
  end if;
  v_marker := v_run.progress -> 'operationalCalibration';
  if v_marker ->> 'injectionToken' <> v_claim.injection_token::text
     or v_marker ->> 'scenario' <> v_claim.scenario then
    raise exception 'Operational workflow injection marker mismatch';
  end if;
  if not exists (
    select 1 from public.ai_grading_runtime_attestations attestation
    where attestation.workflow_run_id = v_run.id
      and attestation.attested_at >= v_claim.declared_at
  ) or exists (
    select 1 from public.ai_grading_runtime_attestations attestation
    where attestation.workflow_run_id = v_run.id and (
      attestation.runtime_revision <> v_evidence.deployment_id
      or attestation.image_digest <> v_evidence.image_digest
      or attestation.grader_version <> v_evidence.grader_version
      or attestation.corpus_version <> v_evidence.corpus_version
    )
  ) then raise exception 'Worker-authored runtime identity does not match release pins'; end if;

  select count(distinct transition.claim_token) into v_claim_event_count
  from public.ai_grading_operational_transitions transition
  where transition.workflow_run_id = v_run.id and transition.event_type = 'worker_claimed';
  select transition.created_at into v_second_claim_at
  from public.ai_grading_operational_transitions transition
  where transition.workflow_run_id = v_run.id and transition.event_type = 'worker_claimed'
  order by transition.created_at offset 1 limit 1;
  select min(transition.created_at) into v_first_output_at
  from public.ai_grading_operational_transitions transition
  where transition.workflow_run_id = v_run.id and transition.event_type = 'output_checkpointed';
  select min(transition.created_at) into v_first_persistence_at
  from public.ai_grading_operational_transitions transition
  where transition.workflow_run_id = v_run.id and transition.event_type = 'persistence_started';

  v_success_provider_calls := case
    when v_evidence.grader_version = 'evidence-adjudicated-v1' then 2
    when v_evidence.grader_version = 'provisional-v1' then 1
    else 0
  end;
  if v_success_provider_calls = 0 then
    raise exception 'Unsupported operational grader pipeline';
  end if;
  v_expected_provider_calls := case
    when v_claim.scenario = 'retry_exhaustion' then 3
    when v_claim.scenario = 'provider_timeout' then 1
    else v_success_provider_calls
  end;
  v_passed := coalesce(case v_claim.scenario
    when 'duplicate_delivery' then
      v_run.status = 'completed' and v_run.last_delivery_attempt >= 2
      and v_checkpoint.provider_attempt_count_at_output >= v_success_provider_calls
      and v_run.provider_attempt_count = v_checkpoint.provider_attempt_count_at_output
      and v_checkpoint.output_payload is not null
    when 'provider_timeout' then
      v_run.status = 'failed' and v_run.last_error_code = 'PROVIDER_OUTCOME_UNKNOWN'
      and v_run.provider_attempt_count = 1 and v_checkpoint.provider_started_at is not null
      and v_checkpoint.output_payload is null
      and v_checkpoint.provider_attempt_count_at_output is null
      and exists (select 1 from public.ai_grading_operational_transitions transition
        where transition.workflow_run_id = v_run.id and transition.event_type = 'provider_reserved')
    when 'stale_claim' then
      v_run.status = 'completed' and v_claim_event_count >= 2
      and (v_first_output_at is null or v_first_output_at >= v_second_claim_at)
      and v_checkpoint.provider_attempt_count_at_output >= v_success_provider_calls
      and v_run.provider_attempt_count = v_checkpoint.provider_attempt_count_at_output
      and v_checkpoint.output_payload is not null
    when 'persistence_retry' then
      v_run.status = 'completed' and v_claim_event_count >= 2
      and v_first_output_at < v_second_claim_at
      and v_first_persistence_at < v_second_claim_at
      and v_checkpoint.provider_attempt_count_at_output >= v_success_provider_calls
      and v_run.provider_attempt_count = v_checkpoint.provider_attempt_count_at_output
      and v_checkpoint.output_payload is not null
    when 'retry_exhaustion' then
      v_run.status = 'failed' and v_run.last_error_code = 'RETRYABLE_WORKFLOW_FAILED'
      and v_run.provider_attempt_count = 3 and v_checkpoint.provider_failure_count = 3
      and v_checkpoint.provider_attempt_count_at_output is null
      and v_claim_event_count = 3
    else false
  end, false);
  insert into public.ai_grading_operational_scenarios(
    claim_id, evidence_id, workflow_run_id, scenario, expected_provider_calls,
    observed_provider_calls, terminal_status, invalid_authoritative_citation_count,
    passed, details_hash
  ) values (
    v_claim.id, v_claim.evidence_id, v_claim.workflow_run_id, v_claim.scenario,
    v_expected_provider_calls, v_run.provider_attempt_count, v_run.status::text,
    p_invalid_authoritative_citation_count, v_passed, p_details_hash
  ) returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.finalize_ai_grading_operational_scenario(
  uuid, uuid, integer, text
) from public, anon, authenticated;
grant execute on function public.finalize_ai_grading_operational_scenario(
  uuid, uuid, integer, text
) to service_role;

-- Existing completed checkpoints predate this column. At migration time the
-- durable provider fence guarantees no provider call can have occurred after
-- a persisted output, so the current monotonic count is the safe snapshot.
update public.ai_grading_checkpoints checkpoint
set provider_attempt_count_at_output = run.provider_attempt_count,
    updated_at = now()
from public.ai_workflow_runs run
where run.id = checkpoint.workflow_run_id
  and checkpoint.output_payload is not null
  and checkpoint.provider_attempt_count_at_output is null
  and run.provider_attempt_count >= 1;

commit;
