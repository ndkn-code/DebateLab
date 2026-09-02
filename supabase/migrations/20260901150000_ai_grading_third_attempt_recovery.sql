-- A worker can die after claiming the third automatic attempt. Such a run must
-- still be recoverable when output is checkpointed, or atomically terminalized
-- when no safe output exists. Recovery never invokes the provider again.

begin;

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

  -- The third worker died after a safe output checkpoint. Re-lease the
  -- persistence phase without incrementing the attempt count or reserving a
  -- new provider call.
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

  -- No safe output exists after the final automatic attempt. Adopt the stale
  -- lease only long enough to use the atomic failure function, which updates
  -- both the workflow and its source. A known-safe pre-provider crash remains
  -- eligible for the one teacher-authorized manual retry; an in-flight
  -- provider reservation becomes outcome-unknown and is never called again.
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
    and (
      (
        run.workflow_attempt_count < 3
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
      )
      or (
        run.workflow_attempt_count = 3
        and run.status in ('running', 'core_completed')
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

commit;
