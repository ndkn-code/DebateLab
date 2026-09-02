-- Completed Pub/Sub redeliveries are acknowledged without a new worker claim
-- or provider reservation. Record their monotonic delivery identity first so
-- operational duplicate-delivery evidence observes the real second delivery.

begin;

create table if not exists private.ai_grading_environment_marker (
  singleton boolean primary key default true check (singleton),
  environment text not null check (environment in ('preview', 'staging', 'production')),
  project_ref text not null check (project_ref ~ '^[a-z0-9]{6,64}$'),
  created_at timestamptz not null default now()
);

create table if not exists private.ai_grading_operational_boundary_attempts (
  id uuid primary key default gen_random_uuid(),
  operational_claim_id uuid not null
    references public.ai_grading_operational_claims(id) on delete restrict,
  workflow_run_id uuid not null
    references public.ai_workflow_runs(id) on delete restrict,
  worker_claim_token uuid not null,
  created_at timestamptz not null default now(),
  unique (workflow_run_id, worker_claim_token)
);

revoke all on private.ai_grading_environment_marker
  from public, anon, authenticated, service_role;
revoke all on private.ai_grading_operational_boundary_attempts
  from public, anon, authenticated, service_role;

drop trigger if exists ai_grading_environment_marker_immutable
  on private.ai_grading_environment_marker;
create trigger ai_grading_environment_marker_immutable
  before update or delete on private.ai_grading_environment_marker
  for each row execute function private.prevent_ai_grading_operational_row_mutation();
drop trigger if exists ai_grading_operational_boundary_attempts_immutable
  on private.ai_grading_operational_boundary_attempts;
create trigger ai_grading_operational_boundary_attempts_immutable
  before update or delete on private.ai_grading_operational_boundary_attempts
  for each row execute function private.prevent_ai_grading_operational_row_mutation();

create or replace function public.bootstrap_ai_grading_environment_marker(
  p_environment text,
  p_project_ref text,
  p_bootstrap_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_marker private.ai_grading_environment_marker%rowtype;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'ai_grading_environment_bootstrap_secret'
  limit 1;
  if coalesce(v_secret, '') = ''
     or p_bootstrap_token is distinct from v_secret
     or p_environment not in ('preview', 'staging', 'production')
     or p_project_ref !~ '^[a-z0-9]{6,64}$' then
    raise exception 'Invalid AI grading environment bootstrap';
  end if;
  insert into private.ai_grading_environment_marker(
    singleton, environment, project_ref
  ) values (true, p_environment, p_project_ref)
  on conflict (singleton) do nothing;
  select * into v_marker from private.ai_grading_environment_marker
  where singleton = true;
  if v_marker.environment is distinct from p_environment
     or v_marker.project_ref is distinct from p_project_ref then
    raise exception 'AI grading environment marker is immutable';
  end if;
  return true;
end;
$$;

create or replace function public.get_ai_grading_environment_marker()
returns table (environment text, project_ref text)
language sql
security definer
set search_path = ''
as $$
  select marker.environment, marker.project_ref
  from private.ai_grading_environment_marker marker
  where marker.singleton = true;
$$;

create or replace function public.record_ai_grading_operational_boundary_attempt(
  p_run_id uuid,
  p_claim_token uuid,
  p_injection_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.ai_workflow_runs%rowtype;
  v_checkpoint public.ai_grading_checkpoints%rowtype;
  v_claim public.ai_grading_operational_claims%rowtype;
  v_evidence public.ai_grading_operational_evidence%rowtype;
  v_marker private.ai_grading_environment_marker%rowtype;
  v_inserted uuid;
begin
  select * into v_marker from private.ai_grading_environment_marker
  where singleton = true;
  if not found or v_marker.environment not in ('preview', 'staging') then
    raise exception 'Operational database environment is not non-production';
  end if;
  select * into v_run from public.ai_workflow_runs
  where id = p_run_id for update;
  if not found or v_run.status <> 'running'
     or v_run.worker_claim_token is distinct from p_claim_token
     or v_run.lease_expires_at <= now() then
    raise exception 'AI_GRADING_CLAIM_LOST';
  end if;
  select * into v_claim from public.ai_grading_operational_claims
  where workflow_run_id = p_run_id
    and injection_token = p_injection_token for share;
  if not found or v_claim.scenario not in ('provider_timeout', 'retry_exhaustion') then
    raise exception 'Operational boundary claim is invalid';
  end if;
  select * into v_evidence from public.ai_grading_operational_evidence
  where id = v_claim.evidence_id and status = 'collecting' for share;
  if not found or v_evidence.environment <> v_marker.environment then
    raise exception 'Operational boundary environment mismatch';
  end if;
  select * into v_checkpoint from public.ai_grading_checkpoints
  where workflow_run_id = p_run_id for share;
  if not found or v_checkpoint.provider_started_at is null
     or v_checkpoint.provider_claim_token is distinct from p_claim_token
     or v_checkpoint.output_payload is not null then
    raise exception 'Operational provider boundary is not reserved';
  end if;
  insert into private.ai_grading_operational_boundary_attempts(
    operational_claim_id, workflow_run_id, worker_claim_token
  ) values (v_claim.id, p_run_id, p_claim_token)
  on conflict (workflow_run_id, worker_claim_token) do nothing
  returning id into v_inserted;
  if v_inserted is null then return false; end if;
  update public.ai_workflow_runs set
    provider_attempt_count = provider_attempt_count + 1,
    updated_at = now()
  where id = p_run_id and worker_claim_token = p_claim_token
    and status = 'running';
  if not found then raise exception 'AI_GRADING_CLAIM_LOST'; end if;
  return true;
end;
$$;

create or replace function public.claim_ai_grading_delivery(
  p_run_id uuid,
  p_kind text,
  p_source_id uuid,
  p_delivery_id text,
  p_delivery_attempt integer,
  p_lease_seconds integer default 1200
)
returns table (
  outcome text,
  claim_token uuid,
  attempt_count integer,
  manual_retry_count integer,
  prepared_payload jsonb,
  output_payload jsonb,
  output_hash text,
  provider_started_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_run public.ai_workflow_runs%rowtype;
  v_checkpoint public.ai_grading_checkpoints%rowtype;
  v_claim uuid := gen_random_uuid();
  v_lease integer := least(greatest(coalesce(p_lease_seconds, 1200), 60), 3600);
begin
  if p_kind not in ('practice_analysis', 'ielts_speaking_score', 'ielts_writing_score')
     or p_source_id is null or p_run_id is null
     or p_delivery_id is null or char_length(p_delivery_id) > 200
     or p_delivery_attempt is null or p_delivery_attempt < 1 then
    raise exception 'AI_GRADING_DELIVERY_INVALID';
  end if;

  select * into v_run from public.ai_workflow_runs
   where id = p_run_id for update;
  if not found then raise exception 'AI_GRADING_RUN_NOT_FOUND'; end if;
  if v_run.workflow_kind <> p_kind
     or (p_kind = 'practice_analysis' and v_run.analysis_job_id is distinct from p_source_id)
     or (p_kind = 'ielts_speaking_score' and v_run.speaking_response_id is distinct from p_source_id)
     or (p_kind = 'ielts_writing_score' and v_run.writing_response_id is distinct from p_source_id) then
    raise exception 'AI_GRADING_SOURCE_MISMATCH';
  end if;

  insert into public.ai_grading_checkpoints(workflow_run_id)
  values (p_run_id) on conflict (workflow_run_id) do nothing;
  select * into v_checkpoint from public.ai_grading_checkpoints
   where workflow_run_id = p_run_id for update;

  if v_run.status = 'completed' then
    update public.ai_workflow_runs set
      last_delivery_id = p_delivery_id,
      last_delivery_attempt = p_delivery_attempt,
      updated_at = now()
    where id = p_run_id
      and status = 'completed'
      and p_delivery_attempt > coalesce(last_delivery_attempt, 0);
    return query select 'completed', null::uuid, v_run.workflow_attempt_count,
      v_run.manual_retry_count, v_checkpoint.prepared_payload,
      v_checkpoint.output_payload, v_checkpoint.output_hash,
      v_checkpoint.provider_started_at;
    return;
  end if;
  if v_run.status in ('running', 'core_completed')
     and v_run.lease_expires_at is not null
     and v_run.lease_expires_at > now() then
    return query select 'lease_active', null::uuid, v_run.workflow_attempt_count,
      v_run.manual_retry_count, v_checkpoint.prepared_payload,
      v_checkpoint.output_payload, v_checkpoint.output_hash,
      v_checkpoint.provider_started_at;
    return;
  end if;

  if v_run.workflow_attempt_count >= 3
     and v_run.status in ('running', 'core_completed')
     and (v_run.lease_expires_at is null or v_run.lease_expires_at <= now())
     and v_checkpoint.output_payload is not null then
    update public.ai_workflow_runs set
      status = 'running', phase = 'checkpoint_recovery',
      worker_claim_token = v_claim,
      last_delivery_id = p_delivery_id,
      last_delivery_attempt = p_delivery_attempt,
      lease_expires_at = now() + make_interval(secs => v_lease),
      last_error_code = null, last_error_message = null, failed_at = null,
      updated_at = now()
    where id = p_run_id;
    return query select 'claimed', v_claim, v_run.workflow_attempt_count,
      v_run.manual_retry_count, v_checkpoint.prepared_payload,
      v_checkpoint.output_payload, v_checkpoint.output_hash,
      v_checkpoint.provider_started_at;
    return;
  end if;

  if v_run.workflow_attempt_count >= 3
     and v_run.status in ('running', 'core_completed')
     and (v_run.lease_expires_at is null or v_run.lease_expires_at <= now()) then
    update public.ai_workflow_runs set
      status = 'running', phase = 'exhaustion_recovery',
      worker_claim_token = v_claim,
      last_delivery_id = p_delivery_id,
      last_delivery_attempt = p_delivery_attempt,
      lease_expires_at = now() + make_interval(secs => v_lease),
      updated_at = now()
    where id = p_run_id;
    perform public.fail_ai_grading_delivery(
      p_run_id,
      v_claim,
      case when v_checkpoint.provider_started_at is null
        then 'RETRYABLE_WORKFLOW_FAILED'
        else 'PROVIDER_OUTCOME_UNKNOWN'
      end,
      'The final automatic worker lease expired before completion.',
      v_checkpoint.provider_started_at is null
    );
    return query select 'exhausted', null::uuid, v_run.workflow_attempt_count,
      v_run.manual_retry_count, v_checkpoint.prepared_payload,
      v_checkpoint.output_payload, v_checkpoint.output_hash,
      v_checkpoint.provider_started_at;
    return;
  end if;

  if v_run.workflow_attempt_count >= 3 then
    return query select 'exhausted', null::uuid, v_run.workflow_attempt_count,
      v_run.manual_retry_count, v_checkpoint.prepared_payload,
      v_checkpoint.output_payload, v_checkpoint.output_hash,
      v_checkpoint.provider_started_at;
    return;
  end if;
  if v_run.status = 'failed'
     and v_run.last_error_code is distinct from 'RETRYABLE_WORKFLOW_FAILED' then
    return query select 'fatal', null::uuid, v_run.workflow_attempt_count,
      v_run.manual_retry_count, v_checkpoint.prepared_payload,
      v_checkpoint.output_payload, v_checkpoint.output_hash,
      v_checkpoint.provider_started_at;
    return;
  end if;

  update public.ai_workflow_runs set
    backend = 'gcp_pubsub', status = 'running', phase = 'claimed',
    worker_claim_token = v_claim,
    workflow_attempt_count = workflow_attempt_count + 1,
    last_delivery_id = p_delivery_id,
    last_delivery_attempt = p_delivery_attempt,
    lease_expires_at = now() + make_interval(secs => v_lease),
    started_at = coalesce(started_at, now()),
    last_error_code = null, last_error_message = null, failed_at = null,
    updated_at = now()
  where id = p_run_id;

  return query select 'claimed', v_claim, v_run.workflow_attempt_count + 1,
    v_run.manual_retry_count, v_checkpoint.prepared_payload,
    v_checkpoint.output_payload, v_checkpoint.output_hash,
    v_checkpoint.provider_started_at;
end;
$$;

revoke all on function public.claim_ai_grading_delivery(
  uuid, text, uuid, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.claim_ai_grading_delivery(
  uuid, text, uuid, text, integer, integer
) to service_role;

revoke all on function public.bootstrap_ai_grading_environment_marker(
  text, text, text
) from public, anon, authenticated;
grant execute on function public.bootstrap_ai_grading_environment_marker(
  text, text, text
) to service_role;
revoke all on function public.get_ai_grading_environment_marker()
  from public, anon, authenticated;
grant execute on function public.get_ai_grading_environment_marker()
  to service_role;
revoke all on function public.record_ai_grading_operational_boundary_attempt(
  uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.record_ai_grading_operational_boundary_attempt(
  uuid, uuid, uuid
) to service_role;

commit;
