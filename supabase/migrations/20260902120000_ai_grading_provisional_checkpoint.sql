-- Preserve the paid IELTS provisional result across adjudication retries. The
-- checkpoint is immutable once written and atomically closes the provisional
-- provider reservation so a later lease can reserve only adjudication.

begin;

alter table public.ai_grading_checkpoints
  add column if not exists provisional_payload jsonb,
  add column if not exists provisional_hash text,
  add column if not exists provisional_version integer,
  add column if not exists provisional_workflow_attempt integer,
  add column if not exists provisional_claim_token uuid,
  add column if not exists provisional_completed_at timestamptz,
  add column if not exists provider_attempt_count_at_provisional integer;

alter table public.ai_grading_checkpoints
  add constraint ai_grading_checkpoints_provisional_complete_check
  check (
    (provisional_payload is null
      and provisional_hash is null
      and provisional_version is null
      and provisional_workflow_attempt is null
      and provisional_claim_token is null
      and provisional_completed_at is null
      and provider_attempt_count_at_provisional is null)
    or
    (provisional_payload is not null
      and provisional_hash ~ '^[0-9a-f]{64}$'
      and provisional_version >= 1
      and provisional_workflow_attempt >= 1
      and provisional_claim_token is not null
      and provisional_completed_at is not null
      and provider_attempt_count_at_provisional >= 1)
  );

create or replace function private.protect_ai_grading_provisional_checkpoint()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.provisional_payload is not null then
      raise exception 'AI_GRADING_PROVISIONAL_IMMUTABLE';
    end if;
    return old;
  end if;
  if old.provisional_payload is not null and (
    new.provisional_payload is distinct from old.provisional_payload
    or new.provisional_hash is distinct from old.provisional_hash
    or new.provisional_version is distinct from old.provisional_version
    or new.provisional_workflow_attempt is distinct from old.provisional_workflow_attempt
    or new.provisional_claim_token is distinct from old.provisional_claim_token
    or new.provisional_completed_at is distinct from old.provisional_completed_at
    or new.provider_attempt_count_at_provisional is distinct from
      old.provider_attempt_count_at_provisional
  ) then
    raise exception 'AI_GRADING_PROVISIONAL_IMMUTABLE';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_ai_grading_provisional_checkpoint()
  from public, anon, authenticated, service_role;

drop trigger if exists ai_grading_provisional_checkpoint_immutable
  on public.ai_grading_checkpoints;
create trigger ai_grading_provisional_checkpoint_immutable
  before update or delete on public.ai_grading_checkpoints
  for each row execute function private.protect_ai_grading_provisional_checkpoint();

-- Worker mutations are RPC-only. Read access remains for release verification;
-- all checkpoint writes below execute as their definer and enforce the lease.
revoke insert, update, delete, truncate on public.ai_grading_checkpoints
  from service_role;
grant select on public.ai_grading_checkpoints to service_role;

create or replace function public.load_ai_grading_provisional(
  p_run_id uuid,
  p_claim_token uuid
)
returns table (
  payload jsonb,
  payload_hash text,
  payload_version integer,
  workflow_attempt integer,
  provider_attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.ai_workflow_runs run
    where run.id = p_run_id
      and run.worker_claim_token = p_claim_token
      and run.status = 'running'
      and run.lease_expires_at > now()
      and run.workflow_kind in ('ielts_speaking_score', 'ielts_writing_score')
  ) then
    raise exception 'AI_GRADING_CLAIM_LOST';
  end if;
  return query
    select checkpoint.provisional_payload,
      checkpoint.provisional_hash,
      checkpoint.provisional_version,
      checkpoint.provisional_workflow_attempt,
      checkpoint.provider_attempt_count_at_provisional
    from public.ai_grading_checkpoints checkpoint
    where checkpoint.workflow_run_id = p_run_id
      and checkpoint.provisional_payload is not null;
end;
$$;

revoke all on function public.load_ai_grading_provisional(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.load_ai_grading_provisional(uuid, uuid)
  to service_role;

create or replace function public.checkpoint_ai_grading_provisional(
  p_run_id uuid,
  p_claim_token uuid,
  p_payload jsonb,
  p_hash text,
  p_version integer,
  p_workflow_attempt integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.ai_workflow_runs%rowtype;
  v_checkpoint public.ai_grading_checkpoints%rowtype;
  v_computed_hash text;
begin
  if p_payload is null or p_hash !~ '^[0-9a-f]{64}$'
     or p_version is distinct from 1
     or p_workflow_attempt is null or p_workflow_attempt < 1 then
    raise exception 'AI_GRADING_PROVISIONAL_INVALID';
  end if;
  v_computed_hash := encode(extensions.digest(
    convert_to(private.canonical_ai_grading_json(p_payload), 'UTF8'),
    'sha256'
  ), 'hex');
  if v_computed_hash is distinct from p_hash
     or p_payload ->> 'schemaVersion' <> '1'
     or p_payload ->> 'kind' not in ('ielts_speaking_score', 'ielts_writing_score')
     or p_payload ->> 'workflowAttempt' is null
     or (p_payload ->> 'workflowAttempt')::integer <> p_workflow_attempt
     or jsonb_typeof(p_payload -> 'result') <> 'object' then
    raise exception 'AI_GRADING_PROVISIONAL_INVALID';
  end if;
  select * into v_run from public.ai_workflow_runs run
  where run.id = p_run_id for update;
  if not found or v_run.worker_claim_token is distinct from p_claim_token
     or v_run.status <> 'running' or v_run.lease_expires_at <= now()
     or v_run.workflow_kind not in ('ielts_speaking_score', 'ielts_writing_score')
     or p_payload ->> 'kind' <> v_run.workflow_kind
     or p_workflow_attempt <> v_run.workflow_attempt_count then
    raise exception 'AI_GRADING_CLAIM_LOST';
  end if;
  select * into v_checkpoint from public.ai_grading_checkpoints checkpoint
  where checkpoint.workflow_run_id = p_run_id for update;
  if not found then raise exception 'AI_GRADING_CHECKPOINT_NOT_FOUND'; end if;

  if v_checkpoint.provisional_payload is not null then
    if v_checkpoint.provisional_hash is distinct from p_hash
       or v_checkpoint.provisional_payload is distinct from p_payload
       or v_checkpoint.provisional_version is distinct from p_version
       or v_checkpoint.provisional_workflow_attempt is distinct from p_workflow_attempt then
      raise exception 'AI_GRADING_PROVISIONAL_CONFLICT';
    end if;
    return 'replayed';
  end if;
  if v_checkpoint.output_payload is not null then
    raise exception 'AI_GRADING_OUTPUT_ALREADY_CHECKPOINTED';
  end if;
  if v_checkpoint.provider_started_at is null
     or v_checkpoint.provider_claim_token is distinct from p_claim_token then
    raise exception 'AI_GRADING_PROVIDER_NOT_RESERVED';
  end if;
  if v_run.provider_attempt_count < 1 then
    raise exception 'AI_GRADING_PROVISIONAL_ATTEMPT_FENCE_INVALID';
  end if;

  update public.ai_grading_checkpoints set
    provisional_payload = p_payload,
    provisional_hash = p_hash,
    provisional_version = p_version,
    provisional_workflow_attempt = p_workflow_attempt,
    provisional_claim_token = p_claim_token,
    provisional_completed_at = now(),
    provider_attempt_count_at_provisional = v_run.provider_attempt_count,
    provider_started_at = null,
    provider_claim_token = null,
    updated_at = now()
  where workflow_run_id = p_run_id;
  return 'created';
end;
$$;

revoke all on function public.checkpoint_ai_grading_provisional(
  uuid, uuid, jsonb, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.checkpoint_ai_grading_provisional(
  uuid, uuid, jsonb, text, integer, integer
) to service_role;

-- Reassert the operational finalizer so evidence-adjudicated releases prove
-- that the immutable provisional fence predates the final output fence. This
-- distinguishes bounded pre-checkpoint retries from any accidental replay of
-- the already-completed provisional scoring stage.
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
  v_stage_fences_valid boolean;
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
  v_stage_fences_valid := case
    when v_evidence.grader_version = 'evidence-adjudicated-v1' then
      v_checkpoint.provider_attempt_count_at_provisional >= 1
      and v_checkpoint.provider_attempt_count_at_output >
        v_checkpoint.provider_attempt_count_at_provisional
    else
      v_checkpoint.provider_attempt_count_at_provisional is null
  end;
  v_expected_provider_calls := case
    when v_claim.scenario = 'retry_exhaustion' then 3
    when v_claim.scenario = 'provider_timeout' then 1
    else v_success_provider_calls
  end;
  v_passed := coalesce(case v_claim.scenario
    when 'duplicate_delivery' then
      v_run.status = 'completed' and v_run.last_delivery_attempt >= 2
      and v_stage_fences_valid
      and v_checkpoint.provider_attempt_count_at_output >= v_success_provider_calls
      and v_run.provider_attempt_count = v_checkpoint.provider_attempt_count_at_output
      and v_checkpoint.output_payload is not null
    when 'provider_timeout' then
      v_run.status = 'failed' and v_run.last_error_code = 'PROVIDER_OUTCOME_UNKNOWN'
      and v_run.provider_attempt_count = 1 and v_checkpoint.provider_started_at is not null
      and v_checkpoint.provisional_payload is null
      and v_checkpoint.output_payload is null
      and v_checkpoint.provider_attempt_count_at_output is null
      and exists (select 1 from public.ai_grading_operational_transitions transition
        where transition.workflow_run_id = v_run.id and transition.event_type = 'provider_reserved')
    when 'stale_claim' then
      v_run.status = 'completed' and v_claim_event_count >= 2
      and (v_first_output_at is null or v_first_output_at >= v_second_claim_at)
      and v_stage_fences_valid
      and v_checkpoint.provider_attempt_count_at_output >= v_success_provider_calls
      and v_run.provider_attempt_count = v_checkpoint.provider_attempt_count_at_output
      and v_checkpoint.output_payload is not null
    when 'persistence_retry' then
      v_run.status = 'completed' and v_claim_event_count >= 2
      and v_first_output_at < v_second_claim_at
      and v_first_persistence_at < v_second_claim_at
      and v_stage_fences_valid
      and v_checkpoint.provider_attempt_count_at_output >= v_success_provider_calls
      and v_run.provider_attempt_count = v_checkpoint.provider_attempt_count_at_output
      and v_checkpoint.output_payload is not null
    when 'retry_exhaustion' then
      v_run.status = 'failed' and v_run.last_error_code = 'RETRYABLE_WORKFLOW_FAILED'
      and v_run.provider_attempt_count = 3 and v_checkpoint.provider_failure_count = 3
      and v_checkpoint.provisional_payload is null
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

commit;
