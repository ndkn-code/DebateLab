-- Private Cloud Run + Pub/Sub runtime for durable AI grading.
-- Forward-only: legacy Workflow columns remain readable during rollback, while
-- all new checkpoint state is service-role-only and never exposed by RLS.

begin;

alter table public.ai_workflow_runs
  add column if not exists backend text not null default 'legacy',
  add column if not exists backend_message_id text,
  add column if not exists published_at timestamptz,
  add column if not exists last_delivery_id text,
  add column if not exists last_delivery_attempt integer,
  add column if not exists worker_claim_token uuid;

alter table public.ai_workflow_runs
  drop constraint if exists ai_workflow_runs_backend_check;
alter table public.ai_workflow_runs
  add constraint ai_workflow_runs_backend_check
  check (backend in ('legacy', 'gcp_pubsub'));

alter table public.ai_workflow_runs
  drop constraint if exists ai_workflow_runs_last_delivery_attempt_check;
alter table public.ai_workflow_runs
  add constraint ai_workflow_runs_last_delivery_attempt_check
  check (last_delivery_attempt is null or last_delivery_attempt > 0);

create index if not exists ai_workflow_runs_gcp_reconcile_idx
  on public.ai_workflow_runs(backend, status, lease_expires_at, updated_at)
  where backend = 'gcp_pubsub';

create table if not exists public.ai_grading_checkpoints (
  workflow_run_id uuid primary key
    references public.ai_workflow_runs(id) on delete cascade,
  prepared_payload jsonb,
  prepared_hash text,
  provider_started_at timestamptz,
  provider_claim_token uuid,
  provider_retry_ordinal integer not null default 0
    check (provider_retry_ordinal >= 0),
  output_payload jsonb,
  output_hash text,
  output_version integer,
  provider_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((output_payload is null) = (output_hash is null)),
  check (output_version is null or output_version > 0)
);

alter table public.ai_grading_checkpoints enable row level security;
revoke all on public.ai_grading_checkpoints from public, anon, authenticated;
grant all on public.ai_grading_checkpoints to service_role;

-- One active lease owns all app and checkpoint writes. The source reference in
-- the Pub/Sub payload must match the durable run before any work is admitted.
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

create or replace function public.checkpoint_ai_grading_prepared(
  p_run_id uuid,
  p_claim_token uuid,
  p_payload jsonb,
  p_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_payload is null or p_hash is null or char_length(p_hash) <> 64 then
    raise exception 'AI_GRADING_PREPARED_INVALID';
  end if;
  if not exists (
    select 1 from public.ai_workflow_runs
     where id = p_run_id and worker_claim_token = p_claim_token
       and status = 'running' and lease_expires_at > now()
  ) then raise exception 'AI_GRADING_CLAIM_LOST'; end if;
  if exists (
    select 1 from public.ai_grading_checkpoints
     where workflow_run_id = p_run_id and prepared_payload is not null
       and prepared_hash is distinct from p_hash
  ) then raise exception 'AI_GRADING_PREPARED_CONFLICT'; end if;
  update public.ai_grading_checkpoints set
    prepared_payload = coalesce(prepared_payload, p_payload),
    prepared_hash = coalesce(prepared_hash, p_hash), updated_at = now()
  where workflow_run_id = p_run_id;
  return true;
end;
$$;

revoke all on function public.checkpoint_ai_grading_prepared(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.checkpoint_ai_grading_prepared(uuid, uuid, jsonb, text)
  to service_role;

-- Reserve one logical provider phase. A stale delivery that finds an earlier
-- started phase without a validated output must not make a second paid call.
-- The single teacher-authorized manual retry is the only new ordinal allowed.
create or replace function public.reserve_ai_grading_provider_call(
  p_run_id uuid,
  p_claim_token uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_run public.ai_workflow_runs%rowtype;
  v_checkpoint public.ai_grading_checkpoints%rowtype;
begin
  select * into v_run from public.ai_workflow_runs
   where id = p_run_id for update;
  if not found or v_run.worker_claim_token is distinct from p_claim_token
     or v_run.status <> 'running' or v_run.lease_expires_at <= now() then
    raise exception 'AI_GRADING_CLAIM_LOST';
  end if;
  select * into v_checkpoint from public.ai_grading_checkpoints
   where workflow_run_id = p_run_id for update;
  if v_checkpoint.output_payload is not null then return 'output_ready'; end if;
  if v_checkpoint.provider_started_at is null
     or v_checkpoint.provider_retry_ordinal < v_run.manual_retry_count then
    update public.ai_grading_checkpoints set
      provider_started_at = now(), provider_claim_token = p_claim_token,
      provider_retry_ordinal = v_run.manual_retry_count,
      output_payload = null, output_hash = null, output_version = null,
      provider_completed_at = null, updated_at = now()
    where workflow_run_id = p_run_id;
    return 'reserved';
  end if;
  if v_checkpoint.provider_claim_token = p_claim_token then return 'reserved'; end if;
  return 'outcome_unknown';
end;
$$;

revoke all on function public.reserve_ai_grading_provider_call(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_ai_grading_provider_call(uuid, uuid)
  to service_role;

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
declare v_existing text;
begin
  if p_payload is null or p_hash is null or char_length(p_hash) <> 64
     or p_version is null or p_version < 1 then
    raise exception 'AI_GRADING_OUTPUT_INVALID';
  end if;
  if not exists (
    select 1 from public.ai_workflow_runs
     where id = p_run_id and worker_claim_token = p_claim_token
       and status = 'running' and lease_expires_at > now()
  ) then raise exception 'AI_GRADING_CLAIM_LOST'; end if;
  select output_hash into v_existing from public.ai_grading_checkpoints
   where workflow_run_id = p_run_id for update;
  if v_existing is not null and v_existing <> p_hash then
    raise exception 'AI_GRADING_OUTPUT_CONFLICT';
  end if;
  update public.ai_grading_checkpoints set
    output_payload = coalesce(output_payload, p_payload),
    output_hash = coalesce(output_hash, p_hash),
    output_version = coalesce(output_version, p_version),
    provider_completed_at = coalesce(provider_completed_at, now()),
    updated_at = now()
  where workflow_run_id = p_run_id;
  return true;
end;
$$;

revoke all on function public.checkpoint_ai_grading_output(uuid, uuid, jsonb, text, integer)
  from public, anon, authenticated;
grant execute on function public.checkpoint_ai_grading_output(uuid, uuid, jsonb, text, integer)
  to service_role;

create or replace function public.complete_ai_grading_delivery(
  p_run_id uuid,
  p_claim_token uuid,
  p_phase text default 'completed'
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_updated uuid;
begin
  if not exists (
    select 1 from public.ai_grading_checkpoints
     where workflow_run_id = p_run_id and output_payload is not null
  ) then raise exception 'AI_GRADING_OUTPUT_MISSING'; end if;
  update public.ai_workflow_runs set
    status = 'completed', phase = left(coalesce(p_phase, 'completed'), 100),
    completed_at = coalesce(completed_at, now()), core_completed_at = coalesce(core_completed_at, now()),
    lease_expires_at = null, worker_claim_token = null,
    last_error_code = null, last_error_message = null, updated_at = now()
  where id = p_run_id and worker_claim_token = p_claim_token
    and status in ('running', 'core_completed')
  returning id into v_updated;
  return v_updated is not null;
end;
$$;

revoke all on function public.complete_ai_grading_delivery(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.complete_ai_grading_delivery(uuid, uuid, text)
  to service_role;

create or replace function public.fail_ai_grading_delivery(
  p_run_id uuid,
  p_claim_token uuid,
  p_error_code text,
  p_error_message text,
  p_retryable boolean
)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_run public.ai_workflow_runs%rowtype;
  v_provider_started timestamptz;
  v_has_output boolean;
  v_retryable boolean;
begin
  select * into v_run from public.ai_workflow_runs
   where id = p_run_id and worker_claim_token = p_claim_token for update;
  if not found then return 'claim_lost'; end if;
  select provider_started_at, output_payload is not null
    into v_provider_started, v_has_output
    from public.ai_grading_checkpoints where workflow_run_id = p_run_id;
  -- Once a provider phase may have completed, redelivery is deliberately
  -- conservative unless a validated output was checkpointed.
  v_retryable := coalesce(p_retryable, false)
    and v_run.workflow_attempt_count < 3
    and (v_provider_started is null or v_has_output);
  update public.ai_workflow_runs set
    status = 'failed', phase = 'failed',
    last_error_code = case
      when v_provider_started is not null and not v_has_output then 'PROVIDER_OUTCOME_UNKNOWN'
      when v_retryable then 'RETRYABLE_WORKFLOW_FAILED'
      else left(coalesce(p_error_code, 'FATAL_WORKFLOW_FAILED'), 100)
    end,
    last_error_message = left(coalesce(p_error_message, 'AI grading failed'), 1000),
    lease_expires_at = null, worker_claim_token = null, failed_at = now(), updated_at = now()
  where id = p_run_id;
  return case when v_retryable then 'retryable' else 'fatal' end;
end;
$$;

revoke all on function public.fail_ai_grading_delivery(uuid, uuid, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.fail_ai_grading_delivery(uuid, uuid, text, text, boolean)
  to service_role;

create or replace function public.list_ai_grading_reconciliation_candidates(
  p_limit integer default 50
)
returns table (
  workflow_run_id uuid,
  workflow_kind text,
  source_id uuid
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select run.id, run.workflow_kind,
    case run.workflow_kind
      when 'practice_analysis' then run.analysis_job_id
      when 'ielts_speaking_score' then run.speaking_response_id
      else run.writing_response_id
    end
  from public.ai_workflow_runs run
  where run.backend = 'gcp_pubsub'
    and run.workflow_attempt_count < 3
    and (
      (run.status = 'queued' and (
        run.published_at is null
        or run.published_at <= now() - interval '15 minutes'
      ))
      or (run.status = 'failed' and run.last_error_code = 'RETRYABLE_WORKFLOW_FAILED')
      or (run.status in ('running', 'starting') and run.lease_expires_at <= now())
    )
  order by run.updated_at
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke all on function public.list_ai_grading_reconciliation_candidates(integer)
  from public, anon, authenticated;
grant execute on function public.list_ai_grading_reconciliation_candidates(integer)
  to service_role;

commit;
