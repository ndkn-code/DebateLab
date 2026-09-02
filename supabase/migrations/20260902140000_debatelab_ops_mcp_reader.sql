-- Least-privilege read boundary for the private DebateLab operations MCP.
--
-- The Cloud Run service uses the public Supabase key plus a separate random
-- capability token. The token can call only the sanitized functions below;
-- it never receives service_role and cannot select or mutate tables directly.
-- No credential is seeded by this migration. Operations must insert only the
-- SHA-256 hash of a generated token into the private credential table.

begin;

create table if not exists private.debatelab_ops_mcp_credentials (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  label text not null check (length(label) between 1 and 128),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  check (expires_at is null or expires_at > created_at)
);

revoke all on private.debatelab_ops_mcp_credentials
  from public, anon, authenticated, service_role;

create or replace function private.assert_debatelab_ops_mcp_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 256 then
    raise exception 'Invalid operations credential';
  end if;
  if not exists (
    select 1
    from private.debatelab_ops_mcp_credentials credential
    where credential.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and credential.revoked_at is null
      and (credential.expires_at is null or credential.expires_at > now())
  ) then
    raise exception 'Invalid operations credential';
  end if;
end;
$$;

revoke all on function private.assert_debatelab_ops_mcp_token(text)
  from public, anon, authenticated, service_role;

create or replace function public.ops_mcp_ping(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_debatelab_ops_mcp_token(p_token);
  return jsonb_build_object('ready', true, 'schemaVersion', 1);
end;
$$;

create or replace function public.ops_mcp_grading_run_status(
  p_token text,
  p_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  perform private.assert_debatelab_ops_mcp_token(p_token);
  select jsonb_build_object(
    'runId', run.id,
    'kind', run.workflow_kind,
    'backend', run.backend,
    'status', run.status,
    'phase', run.phase,
    'workflowAttemptCount', run.workflow_attempt_count,
    'providerAttemptCount', run.provider_attempt_count,
    'manualRetryCount', run.manual_retry_count,
    'lastErrorCode', run.last_error_code,
    'leaseExpiresAt', run.lease_expires_at,
    'createdAt', run.created_at,
    'updatedAt', run.updated_at,
    'completedAt', run.completed_at,
    'failedAt', run.failed_at
  ) into v_result
  from public.ai_workflow_runs run
  where run.id = p_run_id;
  return v_result;
end;
$$;

create or replace function public.ops_mcp_model_health(
  p_token text,
  p_window_hours integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  perform private.assert_debatelab_ops_mcp_token(p_token);
  if p_window_hours is null or p_window_hours < 1 or p_window_hours > 168 then
    raise exception 'Invalid model-health window';
  end if;
  with sampled as (
    select request.provider, request.model, request.status, request.latency_ms,
      request.estimated_cost_usd, request.total_tokens
    from public.ai_provider_requests request
    where request.created_at >= now() - make_interval(hours => p_window_hours)
    order by request.created_at desc
    limit 5000
  ), grouped as (
    select provider, model,
      count(*)::integer as request_count,
      count(*) filter (where status = 'success')::integer as success_count,
      count(*) filter (where status <> 'success')::integer as error_count,
      avg(latency_ms) filter (where latency_ms is not null) as average_latency_ms,
      percentile_disc(0.95) within group (order by latency_ms)
        filter (where latency_ms is not null) as p95_latency_ms,
      coalesce(sum(total_tokens), 0)::bigint as total_tokens,
      coalesce(sum(estimated_cost_usd), 0)::numeric as estimated_cost_usd
    from sampled
    group by provider, model
  )
  select jsonb_build_object(
    'windowHours', p_window_hours,
    'sampledRequestCount', (select count(*) from sampled),
    'sampleLimited', (select count(*) = 5000 from sampled),
    'models', coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider', left(provider, 32),
        'model', left(model, 128),
        'requestCount', request_count,
        'successCount', success_count,
        'errorCount', error_count,
        'successRate', case when request_count = 0 then 0
          else success_count::numeric / request_count end,
        'averageLatencyMs', case when average_latency_ms is null then null
          else greatest(average_latency_ms, 0) end,
        'p95LatencyMs', case when p95_latency_ms is null then null
          else greatest(p95_latency_ms, 0) end,
        'totalTokens', greatest(total_tokens, 0),
        'estimatedCostUsd', greatest(estimated_cost_usd, 0)
      ) order by request_count desc)
      from grouped
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.ops_mcp_failed_or_stale_jobs(
  p_token text,
  p_limit integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  perform private.assert_debatelab_ops_mcp_token(p_token);
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid failed-job limit';
  end if;
  with candidates as (
    select run.*,
      (
        run.workflow_attempt_count < 3 and (
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
      ) or (
        run.workflow_attempt_count = 3
        and run.status in ('running', 'core_completed')
        and (run.lease_expires_at is null or run.lease_expires_at <= now())
      ) as reconciliation_candidate,
      run.status in ('queued', 'starting', 'running', 'core_completed') and (
        (run.status = 'queued' and (
          run.published_at is null
          or run.published_at <= now() - interval '15 minutes'
        ))
        or (
          run.status <> 'queued'
          and (run.lease_expires_at is null or run.lease_expires_at <= now())
        )
      ) as stale
    from public.ai_workflow_runs run
    where run.backend = 'gcp_pubsub'
      and run.status in ('queued', 'starting', 'running', 'core_completed', 'failed')
  ), selected as (
    select * from candidates
    where status = 'failed' or reconciliation_candidate
    order by updated_at asc
    limit p_limit
  )
  select jsonb_build_object(
    'jobs', coalesce(jsonb_agg(jsonb_build_object(
      'runId', id,
      'kind', workflow_kind,
      'status', status,
      'phase', phase,
      'workflowAttemptCount', workflow_attempt_count,
      'providerAttemptCount', provider_attempt_count,
      'manualRetryCount', manual_retry_count,
      'lastErrorCode', last_error_code,
      'leaseExpiresAt', lease_expires_at,
      'updatedAt', updated_at,
      'stale', stale,
      'reconciliationCandidate', reconciliation_candidate
    ) order by updated_at asc), '[]'::jsonb)
  ) into v_result
  from selected;
  return v_result;
end;
$$;

create or replace function public.ops_mcp_corpus_versions(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  perform private.assert_debatelab_ops_mcp_token(p_token);
  select jsonb_build_object(
    'collections', coalesce(jsonb_agg(jsonb_build_object(
      'collectionId', collection.id,
      'slug', collection.slug,
      'domain', collection.domain,
      'language', collection.language,
      'activeVersion', collection.active_version,
      'active', collection.is_active,
      'embeddingProvider', collection.embedding_provider,
      'embeddingModel', collection.embedding_model,
      'embeddingDimensions', collection.embedding_dimensions
    ) order by collection.slug), '[]'::jsonb)
  ) into v_result
  from public.ai_knowledge_collections collection;
  return v_result;
end;
$$;

create or replace function public.ops_mcp_corpus_readiness(
  p_token text,
  p_collection_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_collection public.ai_knowledge_collections%rowtype;
  v_versions jsonb;
begin
  perform private.assert_debatelab_ops_mcp_token(p_token);
  if p_collection_slug not in (
    'debate.vi.truong_teen', 'debate.en.competitive',
    'ielts.speaking', 'ielts.writing'
  ) then
    raise exception 'Unknown operations collection';
  end if;
  select * into v_collection
  from public.ai_knowledge_collections collection
  where collection.slug = p_collection_slug;
  if not found then
    return jsonb_build_object(
      'collectionSlug', p_collection_slug,
      'collectionFound', false,
      'activeVersion', null,
      'versions', '[]'::jsonb
    );
  end if;

  with version_rows as (
    select version.version, version.status, version.submitted_at,
      version.reviewed_at, version.published_at,
      count(item.id)::integer as item_count,
      count(item.id) filter (where item.review_status = 'approved')::integer
        as approved_item_count,
      count(item.id) filter (where 'grading' = any(item.usable_for))::integer
        as grading_item_count,
      count(item.id) filter (
        where item.review_status = 'approved' and 'grading' = any(item.usable_for)
      )::integer as approved_grading_item_count,
      count(distinct item.source_id)::integer as source_count,
      count(item.id) filter (where item.review_status <> 'approved')::integer
        as unapproved_item_count,
      count(distinct source.id) filter (where source.review_status <> 'approved')::integer
        as unapproved_source_count,
      count(distinct source.id) filter (where source.rights_status not in (
        'approved_for_derived_use', 'approved_for_excerpt', 'public_domain'
      ))::integer as uncleared_rights_source_count,
      count(item.id) filter (
        where 'grading' = any(item.usable_for)
          and source.authority_tier not in ('official', 'qualified_examiner_or_adjudicator')
      )::integer as grading_authority_violation_count,
      count(item.id) filter (where
        case
          when v_collection.slug in ('ielts.speaking', 'ielts.writing') then
            case
              when item.item_kind in ('practice_prompt', 'scored_example_locator_candidate')
                then item.usable_for = array['coaching']::text[]
              when item.item_kind = 'rubric_descriptor_candidate'
                then item.usable_for @> array['grading', 'coaching']::text[]
                  and item.usable_for <@ array['grading', 'coaching']::text[]
                  and source.authority_tier = 'official'
              else false
            end
          when v_collection.slug = 'debate.en.competitive' then
            case
              when source.authority_tier = 'official'
                then item.usable_for @> array['grading', 'coaching']::text[]
                  and item.usable_for <@ array['grading', 'coaching']::text[]
                  and item.metadata -> 'derivedOnly' = 'true'::jsonb
              else item.usable_for = array['coaching']::text[]
                and item.metadata -> 'noTranscriptStored' = 'true'::jsonb
                and item.metadata -> 'verified' = 'true'::jsonb
            end
          else false
        end is not true
      )::integer as purpose_policy_violation_count,
      count(item.id) filter (
        where item.metadata -> 'answerKeyAvailable' = 'true'::jsonb
      )::integer as answer_key_flag_count,
      count(item.id) filter (where
        item.reviewed_by is null
        or source.reviewed_by is null
        or (item.submitted_by is not null and item.reviewed_by = item.submitted_by)
        or (source.submitted_by is not null and source.reviewed_by = source.submitted_by)
      )::integer as review_separation_violation_count,
      count(item.id) filter (where item.id is not null and not exists (
        select 1 from public.ai_knowledge_embeddings embedding
        where embedding.item_id = item.id
          and embedding.collection_id = item.collection_id
          and embedding.provider = v_collection.embedding_provider
          and embedding.model = v_collection.embedding_model
          and embedding.dimensions = v_collection.embedding_dimensions
          and embedding.input_type = 'document'
          and embedding.content_hash = item.content_hash
      ))::integer as missing_embedding_count
    from public.ai_knowledge_collection_versions version
    left join public.ai_knowledge_items item
      on item.collection_id = version.collection_id
      and item.collection_version = version.version
    left join public.ai_knowledge_sources source on source.id = item.source_id
    where version.collection_id = v_collection.id
    group by version.version, version.status, version.submitted_at,
      version.reviewed_at, version.published_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'version', version,
    'status', status,
    'submittedAt', submitted_at,
    'reviewedAt', reviewed_at,
    'publishedAt', published_at,
    'itemCount', item_count,
    'approvedItemCount', approved_item_count,
    'gradingItemCount', grading_item_count,
    'approvedGradingItemCount', approved_grading_item_count,
    'sourceCount', source_count,
    'unapprovedItemCount', unapproved_item_count,
    'unapprovedSourceCount', unapproved_source_count,
    'unclearedRightsSourceCount', uncleared_rights_source_count,
    'gradingAuthorityViolationCount', grading_authority_violation_count,
    'purposePolicyViolationCount', purpose_policy_violation_count,
    'answerKeyFlagCount', answer_key_flag_count,
    'reviewSeparationViolationCount', review_separation_violation_count,
    'missingEmbeddingCount', missing_embedding_count,
    'readyToPublish', status = 'draft' and item_count > 0
      and unapproved_item_count = 0
      and unapproved_source_count = 0
      and uncleared_rights_source_count = 0
      and grading_authority_violation_count = 0
      and purpose_policy_violation_count = 0
      and answer_key_flag_count = 0
      and review_separation_violation_count = 0
      and missing_embedding_count = 0
  ) order by version), '[]'::jsonb) into v_versions
  from version_rows;

  return jsonb_build_object(
    'collectionSlug', v_collection.slug,
    'collectionFound', true,
    'activeVersion', v_collection.active_version,
    'embeddingProvider', v_collection.embedding_provider,
    'embeddingModel', v_collection.embedding_model,
    'embeddingDimensions', v_collection.embedding_dimensions,
    'versions', v_versions
  );
end;
$$;

create or replace function public.ops_mcp_benchmark_summary(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  perform private.assert_debatelab_ops_mcp_token(p_token);
  with active as (
    select benchmark.id, benchmark.skill
    from public.ai_grading_benchmarks benchmark
    where benchmark.is_active
  ), coverage as (
    select skill, count(*)::integer as case_count from active group by skill
  ), recent_evaluations as (
    select evaluation.id, evaluation.grader_version, evaluation.corpus_version,
      evaluation.created_at,
      jsonb_strip_nulls(jsonb_build_object(
        'sampleCount', evaluation.metrics -> 'sampleCount',
        'withinHalfBandRate', evaluation.metrics -> 'withinHalfBandRate',
        'overallWithinHalfBandRate', evaluation.metrics -> 'overallWithinHalfBandRate',
        'quadraticWeightedKappa', evaluation.metrics -> 'quadraticWeightedKappa',
        'overallQuadraticWeightedKappa', evaluation.metrics -> 'overallQuadraticWeightedKappa',
        'meanSignedError', evaluation.metrics -> 'meanSignedError',
        'repeatConsistencyRate', evaluation.metrics -> 'repeatConsistencyRate',
        'schemaComplianceRate', evaluation.metrics -> 'schemaComplianceRate',
        'approvedEvidenceRate', evaluation.metrics -> 'approvedEvidenceRate',
        'passed', evaluation.metrics -> 'passed'
      )) as metrics
    from public.ai_grading_evaluations evaluation
    order by evaluation.created_at desc
    limit 100
  )
  select jsonb_build_object(
    'activeCaseCount', (select count(*) from active),
    'attestedActiveCaseCount', (
      select count(*) from active
      join public.ai_grading_benchmark_release_attestations attestation
        on attestation.benchmark_id = active.id
      where attestation.expires_at > now()
    ),
    'coverageBySkill', coalesce((
      select jsonb_object_agg(skill, case_count) from coverage
    ), '{}'::jsonb),
    'historicalEvaluations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'evaluationId', id,
        'graderVersion', left(grader_version, 128),
        'corpusVersion', corpus_version,
        'createdAt', created_at,
        'metrics', metrics,
        'authoritative', false
      ) order by created_at desc)
      from recent_evaluations
    ), '[]'::jsonb),
    'historicalQueryLimited', (
      select count(*) > 100 from public.ai_grading_evaluations
    )
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.ops_mcp_ping(text) from public, authenticated, service_role;
revoke all on function public.ops_mcp_grading_run_status(text, uuid) from public, authenticated, service_role;
revoke all on function public.ops_mcp_model_health(text, integer) from public, authenticated, service_role;
revoke all on function public.ops_mcp_failed_or_stale_jobs(text, integer) from public, authenticated, service_role;
revoke all on function public.ops_mcp_corpus_versions(text) from public, authenticated, service_role;
revoke all on function public.ops_mcp_corpus_readiness(text, text) from public, authenticated, service_role;
revoke all on function public.ops_mcp_benchmark_summary(text) from public, authenticated, service_role;

grant execute on function public.ops_mcp_ping(text) to anon;
grant execute on function public.ops_mcp_grading_run_status(text, uuid) to anon;
grant execute on function public.ops_mcp_model_health(text, integer) to anon;
grant execute on function public.ops_mcp_failed_or_stale_jobs(text, integer) to anon;
grant execute on function public.ops_mcp_corpus_versions(text) to anon;
grant execute on function public.ops_mcp_corpus_readiness(text, text) to anon;
grant execute on function public.ops_mcp_benchmark_summary(text) to anon;

commit;
