-- Distinguish a provider's definite failure from an unknown transport outcome,
-- and keep source rows consistent with the fenced GCP workflow run.

begin;

alter table public.ai_grading_checkpoints
  add column if not exists last_provider_failure_kind text,
  add column if not exists last_provider_failed_at timestamptz,
  add column if not exists last_provider_failure_claim_token uuid,
  add column if not exists provider_failure_count integer not null default 0;

alter table public.ai_grading_checkpoints
  drop constraint if exists ai_grading_checkpoints_provider_failure_count_check;
alter table public.ai_grading_checkpoints
  add constraint ai_grading_checkpoints_provider_failure_count_check
  check (provider_failure_count >= 0);

-- A caught, classified provider error (HTTP 429/5xx, timeout, schema failure)
-- proves that there is no usable response to preserve. Record that fact before
-- releasing the provider reservation. Unclassified socket/transport loss never
-- calls this function and therefore remains PROVIDER_OUTCOME_UNKNOWN.
create or replace function public.checkpoint_ai_grading_provider_failure(
  p_run_id uuid,
  p_claim_token uuid,
  p_failure_kind text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_checkpoint public.ai_grading_checkpoints%rowtype;
begin
  if p_failure_kind is null
     or char_length(btrim(p_failure_kind)) not between 1 and 100 then
    raise exception 'AI_GRADING_PROVIDER_FAILURE_INVALID';
  end if;
  if not exists (
    select 1 from public.ai_workflow_runs
     where id = p_run_id
       and worker_claim_token = p_claim_token
       and status = 'running'
       and lease_expires_at > now()
  ) then
    raise exception 'AI_GRADING_CLAIM_LOST';
  end if;

  select * into v_checkpoint
    from public.ai_grading_checkpoints
   where workflow_run_id = p_run_id
   for update;
  if not found then raise exception 'AI_GRADING_CHECKPOINT_NOT_FOUND'; end if;
  if v_checkpoint.output_payload is not null then
    raise exception 'AI_GRADING_OUTPUT_ALREADY_CHECKPOINTED';
  end if;
  if v_checkpoint.provider_started_at is null then
    if v_checkpoint.last_provider_failure_claim_token = p_claim_token then
      return true;
    end if;
    raise exception 'AI_GRADING_PROVIDER_NOT_RESERVED';
  end if;
  if v_checkpoint.provider_claim_token is distinct from p_claim_token then
    raise exception 'AI_GRADING_PROVIDER_CLAIM_LOST';
  end if;

  update public.ai_grading_checkpoints set
    provider_started_at = null,
    provider_claim_token = null,
    last_provider_failure_kind = left(btrim(p_failure_kind), 100),
    last_provider_failed_at = now(),
    last_provider_failure_claim_token = p_claim_token,
    provider_failure_count = provider_failure_count + 1,
    updated_at = now()
  where workflow_run_id = p_run_id;
  return true;
end;
$$;

revoke all on function public.checkpoint_ai_grading_provider_failure(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.checkpoint_ai_grading_provider_failure(uuid, uuid, text)
  to service_role;

-- The workflow row and its source status change in one transaction. The final
-- automatic failure keeps RETRYABLE_WORKFLOW_FAILED as the manual-retry marker,
-- even though automatic retries are exhausted and the RPC returns `fatal`.
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
  v_requested_retryable boolean := coalesce(p_retryable, false);
  v_retryable boolean;
  v_error_code text;
begin
  select * into v_run from public.ai_workflow_runs
   where id = p_run_id and worker_claim_token = p_claim_token for update;
  if not found then return 'claim_lost'; end if;
  select provider_started_at, output_payload is not null
    into v_provider_started, v_has_output
    from public.ai_grading_checkpoints where workflow_run_id = p_run_id;

  v_retryable := v_requested_retryable
    and v_run.workflow_attempt_count < 3
    and (v_provider_started is null or v_has_output);
  v_error_code := case
    when v_provider_started is not null and not v_has_output
      then 'PROVIDER_OUTCOME_UNKNOWN'
    when v_retryable
      then 'RETRYABLE_WORKFLOW_FAILED'
    when v_requested_retryable and v_run.workflow_attempt_count >= 3
      then 'RETRYABLE_WORKFLOW_FAILED'
    else left(coalesce(p_error_code, 'FATAL_WORKFLOW_FAILED'), 100)
  end;

  update public.ai_workflow_runs set
    status = 'failed', phase = 'failed',
    last_error_code = v_error_code,
    last_error_message = left(coalesce(p_error_message, 'AI grading failed'), 1000),
    lease_expires_at = null, worker_claim_token = null,
    failed_at = now(), updated_at = now()
  where id = p_run_id;

  if v_run.workflow_kind = 'ielts_speaking_score' then
    update public.speaking_responses set
      status = case when v_retryable then 'pending' else 'failed' end,
      updated_at = now()
    where id = v_run.speaking_response_id and status <> 'scored';
  elsif v_run.workflow_kind = 'ielts_writing_score' then
    update public.writing_responses set
      status = case when v_retryable then 'pending' else 'failed' end,
      updated_at = now()
    where id = v_run.writing_response_id and status <> 'scored';
  elsif v_run.workflow_kind = 'practice_analysis' and not v_retryable then
    update public.analysis_jobs set
      status = 'failed', error_code = v_error_code,
      error_message = left(coalesce(p_error_message, 'AI grading failed'), 1000),
      finished_at = now(), next_retry_at = null, updated_at = now()
    where id = v_run.analysis_job_id and status not in ('completed', 'cancelled');
    update public.practice_attempts set
      status = 'failed', error_code = v_error_code,
      error_message = left(coalesce(p_error_message, 'AI grading failed'), 1000),
      updated_at = now()
    where id = (
      select analysis_job.attempt_id from public.analysis_jobs analysis_job
       where analysis_job.id = v_run.analysis_job_id
    ) and status <> 'completed';
  end if;

  return case when v_retryable then 'retryable' else 'fatal' end;
end;
$$;

revoke all on function public.fail_ai_grading_delivery(uuid, uuid, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.fail_ai_grading_delivery(uuid, uuid, text, text, boolean)
  to service_role;

-- Re-drive every nonterminal state whose lease/publication is stale. NULL
-- leases are stale too; `core_completed` is replayable because output is already
-- checkpointed and persistence is idempotent.
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
      or (
        run.status in ('starting', 'running', 'core_completed')
        and (run.lease_expires_at is null or run.lease_expires_at <= now())
      )
    )
  order by run.updated_at
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke all on function public.list_ai_grading_reconciliation_candidates(integer)
  from public, anon, authenticated;
grant execute on function public.list_ai_grading_reconciliation_candidates(integer)
  to service_role;

-- Repair states produced by the previous non-atomic failure path. Only a
-- definitely failed provider phase (no live reservation, or a saved output) is
-- promoted to the manual-retry marker. Unknown outcomes stay unknown.
update public.ai_workflow_runs run
set last_error_code = 'RETRYABLE_WORKFLOW_FAILED', updated_at = now()
where run.backend = 'gcp_pubsub'
  and run.status = 'failed'
  and run.workflow_attempt_count >= 3
  and run.last_error_code = 'GRADING_DELIVERY_FAILED'
  and exists (
    select 1 from public.ai_grading_checkpoints checkpoint
    where checkpoint.workflow_run_id = run.id
      and (checkpoint.provider_started_at is null or checkpoint.output_payload is not null)
  );

update public.speaking_responses response
set status = 'failed', updated_at = now()
from public.ai_workflow_runs run
where run.speaking_response_id = response.id
  and run.backend = 'gcp_pubsub'
  and run.status = 'failed'
  and (run.workflow_attempt_count >= 3 or run.last_error_code is distinct from 'RETRYABLE_WORKFLOW_FAILED')
  and response.status not in ('scored', 'failed');

update public.writing_responses response
set status = 'failed', updated_at = now()
from public.ai_workflow_runs run
where run.writing_response_id = response.id
  and run.backend = 'gcp_pubsub'
  and run.status = 'failed'
  and (run.workflow_attempt_count >= 3 or run.last_error_code is distinct from 'RETRYABLE_WORKFLOW_FAILED')
  and response.status not in ('scored', 'failed');

update public.analysis_jobs job
set status = 'failed',
    error_code = run.last_error_code,
    error_message = run.last_error_message,
    finished_at = coalesce(job.finished_at, now()),
    next_retry_at = null,
    updated_at = now()
from public.ai_workflow_runs run
where run.analysis_job_id = job.id
  and run.backend = 'gcp_pubsub'
  and run.status = 'failed'
  and (run.workflow_attempt_count >= 3 or run.last_error_code is distinct from 'RETRYABLE_WORKFLOW_FAILED')
  and job.status not in ('completed', 'cancelled', 'failed');

update public.practice_attempts attempt
set status = 'failed',
    error_code = run.last_error_code,
    error_message = run.last_error_message,
    updated_at = now()
from public.ai_workflow_runs run
join public.analysis_jobs job on job.id = run.analysis_job_id
where job.attempt_id = attempt.id
  and run.backend = 'gcp_pubsub'
  and run.status = 'failed'
  and (run.workflow_attempt_count >= 3 or run.last_error_code is distinct from 'RETRYABLE_WORKFLOW_FAILED')
  and attempt.status not in ('completed', 'failed');

commit;
