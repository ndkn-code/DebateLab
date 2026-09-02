-- Release safety evidence is version-bound before fault injection and finalized
-- from the actual durable workflow/checkpoint rows. Direct scenario labelling is
-- deliberately impossible for the service role.

begin;

create table if not exists public.ai_grading_operational_evidence (
  id uuid primary key default gen_random_uuid(),
  run_id text not null unique,
  grader_version text not null,
  corpus_version integer not null check (corpus_version > 0),
  environment text not null check (environment in ('preview', 'staging')),
  deployment_id text not null,
  image_digest text not null,
  status text not null default 'collecting' check (status in ('collecting', 'sealed')),
  started_at timestamptz not null default now(),
  verified_at timestamptz,
  expires_at timestamptz,
  evidence_hash text check (evidence_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  check (
    (status = 'collecting' and verified_at is null and expires_at is null and evidence_hash is null)
    or
    (status = 'sealed' and verified_at is not null and expires_at is not null and evidence_hash is not null)
  ),
  check (verified_at is null or verified_at >= started_at),
  check (expires_at is null or expires_at > verified_at),
  check (expires_at is null or expires_at <= verified_at + interval '7 days')
);

create table if not exists public.ai_grading_operational_claims (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.ai_grading_operational_evidence(id) on delete restrict,
  workflow_run_id uuid not null references public.ai_workflow_runs(id) on delete restrict,
  scenario text not null check (scenario in (
    'duplicate_delivery', 'provider_timeout', 'stale_claim',
    'persistence_retry', 'retry_exhaustion'
  )),
  injection_token uuid not null default gen_random_uuid(),
  declared_at timestamptz not null default now(),
  unique (evidence_id, scenario),
  unique (workflow_run_id),
  unique (injection_token)
);

create table if not exists public.ai_grading_operational_scenarios (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.ai_grading_operational_claims(id) on delete restrict,
  evidence_id uuid not null references public.ai_grading_operational_evidence(id) on delete restrict,
  workflow_run_id uuid not null unique references public.ai_workflow_runs(id) on delete restrict,
  scenario text not null check (scenario in (
    'duplicate_delivery', 'provider_timeout', 'stale_claim',
    'persistence_retry', 'retry_exhaustion'
  )),
  expected_provider_calls integer not null check (expected_provider_calls >= 0),
  observed_provider_calls integer not null check (observed_provider_calls >= 0),
  terminal_status text not null check (terminal_status in ('completed', 'failed')),
  invalid_authoritative_citation_count integer not null default 0
    check (invalid_authoritative_citation_count >= 0),
  passed boolean not null,
  details_hash text not null check (details_hash ~ '^[0-9a-f]{64}$'),
  finalized_at timestamptz not null default now(),
  unique (evidence_id, scenario),
  check (expected_provider_calls between 1 and 3)
);

create index if not exists ai_grading_operational_evidence_release_idx
  on public.ai_grading_operational_evidence(
    grader_version, corpus_version, environment, deployment_id, verified_at desc
  ) where status = 'sealed';

alter table public.ai_grading_operational_evidence enable row level security;
alter table public.ai_grading_operational_claims enable row level security;
alter table public.ai_grading_operational_scenarios enable row level security;
revoke all on public.ai_grading_operational_evidence from public, anon, authenticated, service_role;
revoke all on public.ai_grading_operational_claims from public, anon, authenticated, service_role;
revoke all on public.ai_grading_operational_scenarios from public, anon, authenticated, service_role;
grant select on public.ai_grading_operational_evidence to service_role;
grant select on public.ai_grading_operational_claims to service_role;
grant select on public.ai_grading_operational_scenarios to service_role;

create or replace function public.begin_ai_grading_operational_evidence(
  p_run_id text, p_grader_version text, p_corpus_version integer,
  p_environment text, p_deployment_id text, p_image_digest text
)
returns public.ai_grading_operational_evidence
language plpgsql security definer set search_path = ''
as $$
declare v_result public.ai_grading_operational_evidence%rowtype;
begin
  if length(trim(p_run_id)) = 0
     or p_grader_version not in ('provisional-v1', 'evidence-adjudicated-v1')
     or p_corpus_version <= 0 or p_environment not in ('preview', 'staging')
     or p_deployment_id !~ '^[a-z][a-z0-9-]{0,62}$'
     or p_image_digest !~ '^sha256:[0-9a-f]{64}$' then
    raise exception 'Invalid operational evidence identity';
  end if;
  insert into public.ai_grading_operational_evidence(
    run_id, grader_version, corpus_version, environment, deployment_id, image_digest
  ) values (
    p_run_id, p_grader_version, p_corpus_version, p_environment, p_deployment_id,
    p_image_digest
  ) returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.declare_ai_grading_operational_scenario(
  p_evidence_id uuid, p_workflow_run_id uuid, p_scenario text
)
returns public.ai_grading_operational_claims
language plpgsql security definer set search_path = ''
as $$
declare
  v_evidence public.ai_grading_operational_evidence%rowtype;
  v_run public.ai_workflow_runs%rowtype;
  v_result public.ai_grading_operational_claims%rowtype;
begin
  select * into v_evidence from public.ai_grading_operational_evidence
    where id = p_evidence_id and status = 'collecting' for update;
  if not found then raise exception 'Collecting operational evidence not found'; end if;
  select * into v_run from public.ai_workflow_runs where id = p_workflow_run_id for update;
  if not found then raise exception 'AI workflow run not found'; end if;
  if p_scenario not in (
    'duplicate_delivery', 'provider_timeout', 'stale_claim',
    'persistence_retry', 'retry_exhaustion'
  ) then raise exception 'Unsupported AI grading operational scenario'; end if;
  if v_run.backend <> 'gcp_pubsub' or v_run.status <> 'queued'
     or v_run.workflow_kind not in ('ielts_speaking_score', 'ielts_writing_score')
     or v_run.provider_attempt_count <> 0 or v_run.workflow_attempt_count <> 0
     or v_run.created_at < v_evidence.started_at then
    raise exception 'Operational workflow must be a fresh queued GCP run';
  end if;
  insert into public.ai_grading_operational_claims(evidence_id, workflow_run_id, scenario)
    values (p_evidence_id, p_workflow_run_id, p_scenario) returning * into v_result;
  update public.ai_workflow_runs set
    progress = coalesce(progress, '{}'::jsonb) || jsonb_build_object(
      'operationalCalibration', jsonb_build_object(
        'injectionToken', v_result.injection_token, 'scenario', p_scenario,
        'graderVersion', v_evidence.grader_version,
        'corpusVersion', v_evidence.corpus_version,
        'environment', v_evidence.environment, 'deploymentId', v_evidence.deployment_id
      )
    ),
    updated_at = now()
  where id = p_workflow_run_id;
  return v_result;
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
     or v_marker ->> 'scenario' <> v_claim.scenario
     or v_marker ->> 'graderVersion' <> v_evidence.grader_version
     or (v_marker ->> 'corpusVersion')::integer <> v_evidence.corpus_version
     or v_marker ->> 'environment' <> v_evidence.environment
     or v_marker ->> 'deploymentId' <> v_evidence.deployment_id then
    raise exception 'Operational workflow version/deployment marker mismatch';
  end if;
  v_expected_provider_calls := case when v_claim.scenario = 'retry_exhaustion' then 3 else 1 end;
  v_passed := coalesce(case v_claim.scenario
    when 'duplicate_delivery' then
      v_run.status = 'completed' and v_run.last_delivery_attempt >= 2
      and v_run.provider_attempt_count = 1 and v_checkpoint.output_payload is not null
    when 'provider_timeout' then
      v_run.status = 'failed' and v_run.last_error_code = 'PROVIDER_OUTCOME_UNKNOWN'
      and v_run.provider_attempt_count = 1 and v_checkpoint.provider_started_at is not null
      and v_checkpoint.output_payload is null
    when 'stale_claim' then
      v_run.status = 'completed' and v_run.workflow_attempt_count >= 2
      and v_run.provider_attempt_count = 1 and v_checkpoint.output_payload is not null
    when 'persistence_retry' then
      v_run.status = 'completed' and v_run.workflow_attempt_count >= 2
      and v_run.provider_attempt_count = 1 and v_checkpoint.output_payload is not null
    when 'retry_exhaustion' then
      v_run.status = 'failed' and v_run.last_error_code = 'RETRYABLE_WORKFLOW_FAILED'
      and v_run.provider_attempt_count = 3 and v_checkpoint.provider_failure_count = 3
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

create or replace function public.seal_ai_grading_operational_evidence(
  p_evidence_id uuid, p_evidence_hash text
)
returns public.ai_grading_operational_evidence
language plpgsql security definer set search_path = ''
as $$
declare v_result public.ai_grading_operational_evidence%rowtype;
begin
  if p_evidence_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid operational evidence hash'; end if;
  if (select count(*) from public.ai_grading_operational_scenarios
      where evidence_id = p_evidence_id and passed = true) <> 5 then
    raise exception 'All five operational scenarios must pass before sealing';
  end if;
  update public.ai_grading_operational_evidence set
    status = 'sealed', verified_at = now(), expires_at = now() + interval '7 days',
    evidence_hash = p_evidence_hash
  where id = p_evidence_id and status = 'collecting'
  returning * into v_result;
  if not found then raise exception 'Collecting operational evidence not found'; end if;
  return v_result;
end;
$$;

create or replace function private.prevent_ai_grading_operational_row_mutation()
returns trigger language plpgsql set search_path = ''
as $$ begin raise exception 'AI grading operational rows are immutable; record a new run'; end; $$;
revoke all on function private.prevent_ai_grading_operational_row_mutation() from public, anon, authenticated;

drop trigger if exists ai_grading_operational_evidence_no_delete on public.ai_grading_operational_evidence;
create trigger ai_grading_operational_evidence_no_delete before delete on public.ai_grading_operational_evidence
  for each row execute function private.prevent_ai_grading_operational_row_mutation();
drop trigger if exists ai_grading_operational_claims_immutable on public.ai_grading_operational_claims;
create trigger ai_grading_operational_claims_immutable before update or delete on public.ai_grading_operational_claims
  for each row execute function private.prevent_ai_grading_operational_row_mutation();
drop trigger if exists ai_grading_operational_scenarios_immutable on public.ai_grading_operational_scenarios;
create trigger ai_grading_operational_scenarios_immutable before update or delete on public.ai_grading_operational_scenarios
  for each row execute function private.prevent_ai_grading_operational_row_mutation();

revoke all on function public.begin_ai_grading_operational_evidence(text, text, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.declare_ai_grading_operational_scenario(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.finalize_ai_grading_operational_scenario(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.seal_ai_grading_operational_evidence(uuid, text) from public, anon, authenticated;
grant execute on function public.begin_ai_grading_operational_evidence(text, text, integer, text, text, text) to service_role;
grant execute on function public.declare_ai_grading_operational_scenario(uuid, uuid, text) to service_role;
grant execute on function public.finalize_ai_grading_operational_scenario(uuid, uuid, integer, text) to service_role;
grant execute on function public.seal_ai_grading_operational_evidence(uuid, text) to service_role;

commit;
