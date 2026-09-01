-- Worker-authored runtime identity/fault transitions and immutable independent
-- benchmark reruns close the remaining release-gate self-attestation paths.

begin;

create table if not exists public.ai_grading_runtime_attestations (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.ai_workflow_runs(id) on delete restrict,
  claim_token uuid not null,
  runtime_revision text not null,
  image_digest text not null,
  grader_version text not null,
  corpus_version integer not null check (corpus_version > 0),
  attested_at timestamptz not null default now(),
  unique (workflow_run_id, claim_token)
);

create table if not exists public.ai_grading_operational_transitions (
  id uuid primary key default gen_random_uuid(),
  workflow_run_id uuid not null references public.ai_workflow_runs(id) on delete restrict,
  claim_token uuid not null,
  event_type text not null check (event_type in (
    'worker_claimed', 'prepared_checkpointed', 'provider_reserved',
    'output_checkpointed', 'persistence_started', 'persistence_completed'
  )),
  created_at timestamptz not null default now(),
  unique (workflow_run_id, claim_token, event_type)
);

create table if not exists public.ai_grading_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.ai_grading_evaluations(id) on delete restrict,
  run_kind text not null check (run_kind in ('primary', 'repeat')),
  prediction jsonb not null check (jsonb_typeof(prediction) = 'object'),
  provider text not null,
  model text not null,
  provider_request_id uuid not null unique
    references public.ai_provider_requests(id) on delete restrict,
  trace_id text not null unique,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (evaluation_id, run_kind),
  check (completed_at > started_at)
);

alter table public.ai_grading_runtime_attestations enable row level security;
alter table public.ai_grading_operational_transitions enable row level security;
alter table public.ai_grading_evaluation_runs enable row level security;
revoke all on public.ai_grading_runtime_attestations from public, anon, authenticated, service_role;
revoke all on public.ai_grading_operational_transitions from public, anon, authenticated, service_role;
revoke all on public.ai_grading_evaluation_runs from public, anon, authenticated;
grant select on public.ai_grading_runtime_attestations to service_role;
grant select on public.ai_grading_operational_transitions to service_role;
grant select on public.ai_grading_evaluation_runs to service_role;

create or replace function private.canonical_ai_grading_json(p_value jsonb)
returns text
language plpgsql immutable set search_path = ''
as $$
declare v_result text;
begin
  if jsonb_typeof(p_value) = 'object' then
    select '{' || coalesce(string_agg(
      to_jsonb(entry.key)::text || ':' || private.canonical_ai_grading_json(entry.value),
      ',' order by entry.key
    ), '') || '}' into v_result
    from jsonb_each(p_value) entry;
    return v_result;
  end if;
  if jsonb_typeof(p_value) = 'array' then
    select '[' || coalesce(string_agg(
      private.canonical_ai_grading_json(entry.value),
      ',' order by entry.ordinality
    ), '') || ']' into v_result
    from jsonb_array_elements(p_value) with ordinality entry(value, ordinality);
    return v_result;
  end if;
  return p_value::text;
end;
$$;
revoke all on function private.canonical_ai_grading_json(jsonb)
  from public, anon, authenticated;

alter table public.ai_grading_operational_scenarios
  drop constraint if exists ai_grading_operational_scenarios_expected_provider_calls_check;
alter table public.ai_grading_operational_scenarios
  add constraint ai_grading_operational_scenarios_expected_provider_calls_check
  check (expected_provider_calls between 1 and 3);

create or replace function public.record_ai_grading_evaluation_run(
  p_evaluation_id uuid,
  p_run_kind text,
  p_prediction jsonb,
  p_provider_request_id uuid
)
returns public.ai_grading_evaluation_runs
language plpgsql security definer set search_path = ''
as $$
declare
  v_evaluation public.ai_grading_evaluations%rowtype;
  v_benchmark public.ai_grading_benchmarks%rowtype;
  v_request public.ai_provider_requests%rowtype;
  v_prediction_hash text;
  v_attestation_secret text;
  v_expected_signature text;
  v_result public.ai_grading_evaluation_runs%rowtype;
begin
  if p_run_kind not in ('primary', 'repeat')
     or jsonb_typeof(p_prediction) <> 'object' then
    raise exception 'Invalid AI grading evaluation run';
  end if;
  select * into v_evaluation from public.ai_grading_evaluations
    where id = p_evaluation_id for share;
  if not found then raise exception 'AI grading evaluation not found'; end if;
  select * into v_benchmark from public.ai_grading_benchmarks
    where id = v_evaluation.benchmark_id and is_active = true for share;
  if not found then raise exception 'Active AI grading benchmark not found'; end if;
  select * into v_request from public.ai_provider_requests
    where id = p_provider_request_id for share;
  if not found then raise exception 'Provider request audit not found'; end if;
  v_prediction_hash := encode(extensions.digest(
    convert_to(private.canonical_ai_grading_json(p_prediction), 'UTF8'),
    'sha256'
  ), 'hex');
  select decrypted_secret into v_attestation_secret
  from vault.decrypted_secrets
  where name = 'ai_grading_benchmark_attestation_secret'
  limit 1;
  if coalesce(v_attestation_secret, '') = '' then
    raise exception 'AI grading benchmark attestation secret is unavailable';
  end if;
  v_expected_signature := encode(extensions.hmac(
    convert_to(private.canonical_ai_grading_json(jsonb_build_object(
      'benchmarkKey', v_benchmark.benchmark_key,
      'graderVersion', v_evaluation.grader_version,
      'corpusVersion', v_evaluation.corpus_version,
      'evaluationRunKind', p_run_kind,
      'aiTask', v_request.metadata ->> 'aiTask',
      'provider', v_request.provider,
      'model', v_request.model,
      'benchmarkArtifactSha256',
        v_benchmark.protected_label #>> '{input,artifactSha256}',
      'requestInputSha256', v_request.metadata ->> 'requestInputSha256',
      'validatedOutputSha256', v_prediction_hash
    )), 'UTF8'),
    convert_to(v_attestation_secret, 'UTF8'),
    'sha256'
  ), 'hex');
  if v_request.status <> 'success'
     or coalesce(v_request.request_id, '') = ''
     or v_request.metadata ->> 'benchmarkEvaluationRun' is distinct from 'true'
     or v_request.metadata ->> 'benchmarkKey'
       is distinct from v_benchmark.benchmark_key
     or v_request.metadata ->> 'graderVersion'
       is distinct from v_evaluation.grader_version
     or (case
       when coalesce(v_request.metadata ->> 'corpusVersion', '') ~ '^[0-9]+$'
         then (v_request.metadata ->> 'corpusVersion')::integer
           <> v_evaluation.corpus_version
       else true
     end)
     or v_request.metadata ->> 'evaluationRunKind' is distinct from p_run_kind
     or v_request.metadata -> 'validatedOutputSnapshot' is distinct from p_prediction
     or v_request.metadata ->> 'validatedOutputSha256'
       is distinct from v_prediction_hash
     or v_request.metadata ->> 'requestInputSha256'
       is distinct from (v_benchmark.protected_label #>> '{input,modelInputSha256}')
     or v_request.metadata ->> 'benchmarkArtifactSha256'
       is distinct from (v_benchmark.protected_label #>> '{input,artifactSha256}')
     or v_request.metadata ->> 'benchmarkAttestationSignature'
       is distinct from v_expected_signature
     or not (coalesce(v_request.metadata ->> 'aiTask', '') = any (array[
       'ielts_speaking_score', 'ielts_writing_score',
       'ielts_speaking_adjudication', 'ielts_writing_adjudication'
     ])) then
    raise exception 'Provider request does not attest this benchmark run';
  end if;
  insert into public.ai_grading_evaluation_runs(
    evaluation_id, run_kind, prediction, provider, model,
    provider_request_id, trace_id, started_at, completed_at
  ) values (
    p_evaluation_id, p_run_kind, p_prediction, v_request.provider,
    v_request.model, v_request.id, v_request.request_id,
    v_request.created_at - greatest(coalesce(v_request.latency_ms, 0), 1)
      * interval '1 millisecond',
    v_request.created_at
  ) on conflict (evaluation_id, run_kind) do nothing
    returning * into v_result;
  if not found then
    select * into v_result from public.ai_grading_evaluation_runs
      where evaluation_id = p_evaluation_id and run_kind = p_run_kind;
    if v_result.provider_request_id <> p_provider_request_id
       or v_result.prediction <> p_prediction then
      raise exception 'Immutable AI grading evaluation run differs';
    end if;
  end if;
  return v_result;
end;
$$;

create or replace function public.attest_ai_grading_runtime(
  p_run_id uuid, p_claim_token uuid, p_runtime_revision text,
  p_image_digest text, p_grader_version text, p_corpus_version integer
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if p_runtime_revision !~ '^[a-z][a-z0-9-]{0,62}$'
     or p_image_digest !~ '^sha256:[0-9a-f]{64}$'
     or length(trim(p_grader_version)) = 0 or p_corpus_version <= 0 then
    raise exception 'Invalid AI grading runtime identity';
  end if;
  if not exists (
    select 1 from public.ai_workflow_runs run
    where run.id = p_run_id and run.worker_claim_token = p_claim_token
      and run.status = 'running'
  ) then raise exception 'AI grading runtime attestation lost its claim'; end if;
  if not exists (
    select 1 from public.ai_grading_operational_claims claim
    where claim.workflow_run_id = p_run_id
  ) then return false; end if;
  insert into public.ai_grading_runtime_attestations(
    workflow_run_id, claim_token, runtime_revision, image_digest,
    grader_version, corpus_version
  ) values (
    p_run_id, p_claim_token, p_runtime_revision, p_image_digest,
    p_grader_version, p_corpus_version
  ) on conflict (workflow_run_id, claim_token) do nothing;
  return true;
end;
$$;

create or replace function public.record_ai_grading_operational_transition(
  p_run_id uuid, p_claim_token uuid, p_event_type text
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if p_event_type not in (
    'worker_claimed', 'prepared_checkpointed', 'provider_reserved',
    'output_checkpointed', 'persistence_started', 'persistence_completed'
  ) then raise exception 'Invalid AI grading operational transition'; end if;
  if not exists (
    select 1 from public.ai_workflow_runs run
    where run.id = p_run_id and run.worker_claim_token = p_claim_token
      and run.status in ('running', 'core_completed')
  ) then raise exception 'AI grading transition lost its claim'; end if;
  if not exists (
    select 1 from public.ai_grading_operational_claims claim
    where claim.workflow_run_id = p_run_id
  ) then return false; end if;
  insert into public.ai_grading_operational_transitions(
    workflow_run_id, claim_token, event_type
  ) values (p_run_id, p_claim_token, p_event_type)
  on conflict (workflow_run_id, claim_token, event_type) do nothing;
  return true;
end;
$$;

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
      and v_run.provider_attempt_count = v_success_provider_calls
      and v_checkpoint.output_payload is not null
    when 'provider_timeout' then
      v_run.status = 'failed' and v_run.last_error_code = 'PROVIDER_OUTCOME_UNKNOWN'
      and v_run.provider_attempt_count = 1 and v_checkpoint.provider_started_at is not null
      and v_checkpoint.output_payload is null
      and exists (select 1 from public.ai_grading_operational_transitions transition
        where transition.workflow_run_id = v_run.id and transition.event_type = 'provider_reserved')
    when 'stale_claim' then
      v_run.status = 'completed' and v_claim_event_count >= 2
      and (v_first_output_at is null or v_first_output_at >= v_second_claim_at)
      and v_run.provider_attempt_count = v_success_provider_calls
      and v_checkpoint.output_payload is not null
    when 'persistence_retry' then
      v_run.status = 'completed' and v_claim_event_count >= 2
      and v_first_output_at < v_second_claim_at
      and v_first_persistence_at < v_second_claim_at
      and v_run.provider_attempt_count = v_success_provider_calls
      and v_checkpoint.output_payload is not null
    when 'retry_exhaustion' then
      v_run.status = 'failed' and v_run.last_error_code = 'RETRYABLE_WORKFLOW_FAILED'
      and v_run.provider_attempt_count = 3 and v_checkpoint.provider_failure_count = 3
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

create or replace function private.prevent_ai_grading_evaluation_run_mutation()
returns trigger language plpgsql set search_path = ''
as $$ begin raise exception 'AI grading evaluation runs are immutable'; end; $$;
revoke all on function private.prevent_ai_grading_evaluation_run_mutation()
  from public, anon, authenticated;
drop trigger if exists ai_grading_evaluation_runs_immutable on public.ai_grading_evaluation_runs;
create trigger ai_grading_evaluation_runs_immutable before update or delete on public.ai_grading_evaluation_runs
  for each row execute function private.prevent_ai_grading_evaluation_run_mutation();

create or replace function private.prevent_benchmark_provider_request_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if exists (
    select 1 from public.ai_grading_evaluation_runs run
    where run.provider_request_id = old.id
  ) then
    raise exception 'Benchmark provider request audit is immutable';
  end if;
  return old;
end;
$$;
revoke all on function private.prevent_benchmark_provider_request_mutation()
  from public, anon, authenticated;
drop trigger if exists benchmark_provider_requests_immutable
  on public.ai_provider_requests;
create trigger benchmark_provider_requests_immutable
  before update or delete on public.ai_provider_requests
  for each row execute function private.prevent_benchmark_provider_request_mutation();

create or replace function private.prevent_linked_ai_evaluation_identity_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if exists (
    select 1 from public.ai_grading_evaluation_runs run
    where run.evaluation_id = old.id
  ) and (
    new.benchmark_id is distinct from old.benchmark_id
    or new.grader_version is distinct from old.grader_version
    or new.corpus_version is distinct from old.corpus_version
  ) then
    raise exception 'Linked AI grading evaluation identity is immutable';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_linked_ai_evaluation_identity_mutation()
  from public, anon, authenticated;
drop trigger if exists linked_ai_evaluation_identity_immutable
  on public.ai_grading_evaluations;
create trigger linked_ai_evaluation_identity_immutable
  before update on public.ai_grading_evaluations
  for each row execute function private.prevent_linked_ai_evaluation_identity_mutation();

revoke all on function public.attest_ai_grading_runtime(uuid, uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.record_ai_grading_operational_transition(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.record_ai_grading_evaluation_run(uuid, text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.attest_ai_grading_runtime(uuid, uuid, text, text, text, integer) to service_role;
grant execute on function public.record_ai_grading_operational_transition(uuid, uuid, text) to service_role;
grant execute on function public.record_ai_grading_evaluation_run(uuid, text, jsonb, uuid)
  to service_role;

commit;
