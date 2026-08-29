-- Durable application-level records for Vercel Workflow grading runs.
-- Vercel stores step replay state; this table is the product/support-facing
-- projection and protects application writes when a workflow is launched twice.

create table if not exists public.ai_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_kind text not null check (
    workflow_kind in (
      'practice_analysis',
      'ielts_speaking_score',
      'ielts_writing_score'
    )
  ),
  analysis_job_id uuid references public.analysis_jobs(id) on delete cascade,
  speaking_response_id uuid references public.speaking_responses(id) on delete cascade,
  writing_response_id uuid references public.writing_responses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null unique,
  workflow_run_id text unique,
  launch_token uuid,
  status text not null default 'queued' check (
    status in (
      'queued', 'starting', 'running', 'core_completed',
      'completed', 'failed', 'cancelled'
    )
  ),
  phase text not null default 'queued',
  provider_attempt_count integer not null default 0 check (provider_attempt_count >= 0),
  workflow_attempt_count integer not null default 0 check (workflow_attempt_count >= 0),
  lease_expires_at timestamptz,
  last_error_code text,
  last_error_message text,
  progress jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  core_completed_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  check (
    ((analysis_job_id is not null)::integer +
     (speaking_response_id is not null)::integer +
     (writing_response_id is not null)::integer) = 1
  ),
  check (
    (workflow_kind = 'practice_analysis' and analysis_job_id is not null)
    or (workflow_kind = 'ielts_speaking_score' and speaking_response_id is not null)
    or (workflow_kind = 'ielts_writing_score' and writing_response_id is not null)
  )
);

create unique index if not exists ai_workflow_runs_analysis_job_unique
  on public.ai_workflow_runs(analysis_job_id) where analysis_job_id is not null;
create unique index if not exists ai_workflow_runs_speaking_response_unique
  on public.ai_workflow_runs(speaking_response_id) where speaking_response_id is not null;
create unique index if not exists ai_workflow_runs_writing_response_unique
  on public.ai_workflow_runs(writing_response_id) where writing_response_id is not null;
create index if not exists ai_workflow_runs_status_lease_idx
  on public.ai_workflow_runs(status, lease_expires_at, created_at);
create index if not exists ai_workflow_runs_user_created_idx
  on public.ai_workflow_runs(user_id, created_at desc);

alter table public.ai_workflow_runs enable row level security;

drop policy if exists "Users can view own AI workflow runs" on public.ai_workflow_runs;
create policy "Users can view own AI workflow runs"
  on public.ai_workflow_runs for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

revoke all on public.ai_workflow_runs from anon;
revoke all on public.ai_workflow_runs from authenticated;
grant select on public.ai_workflow_runs to authenticated;
grant all on public.ai_workflow_runs to service_role;

-- Atomically acquires an app-level workflow lease. Duplicate Vercel workflow
-- launches are expected to happen in an at-least-once system; only the caller
-- holding this lease may run a phase with external side effects.
create or replace function public.claim_ai_workflow_run(
  p_run_id uuid,
  p_phase text,
  p_lease_seconds integer default 900,
  p_launch_token uuid default null
)
returns setof public.ai_workflow_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease_seconds integer := least(greatest(coalesce(p_lease_seconds, 900), 30), 3600);
begin
  return query
  update public.ai_workflow_runs as run
  set
    status = case when p_phase = 'starting' then 'starting' else 'running' end,
    phase = p_phase,
    launch_token = case when p_phase = 'starting' then p_launch_token else run.launch_token end,
    workflow_run_id = case when p_phase = 'starting' then null else run.workflow_run_id end,
    workflow_attempt_count = case
      when p_phase = 'starting' then run.workflow_attempt_count + 1
      else run.workflow_attempt_count
    end,
    lease_expires_at = now() + make_interval(secs => v_lease_seconds),
    started_at = coalesce(run.started_at, now()),
    updated_at = now()
  where run.id = p_run_id
    and (
      -- A launch reservation is exclusive until it expires.  A workflow that
      -- was successfully started may immediately promote its own `starting`
      -- row to `running`; a second queue delivery may not start another run.
      (
        p_phase = 'starting'
        and p_launch_token is not null
        and run.workflow_attempt_count < 3
        and (
          run.status = 'queued'
          or (
            run.status = 'starting'
            and (run.lease_expires_at is null or run.lease_expires_at <= now())
          )
          or (
            run.status = 'failed'
            and run.last_error_code = 'RETRYABLE_WORKFLOW_FAILED'
            and run.workflow_attempt_count < 3
          )
        )
      )
      or (
        p_phase <> 'starting'
        and p_launch_token is not null
        and run.launch_token = p_launch_token
        and (
          run.status = 'starting'
          or (
            run.status = 'running'
            and (run.lease_expires_at is null or run.lease_expires_at <= now())
          )
        )
      )
    )
  returning run.*;
end;
$$;

revoke all on function public.claim_ai_workflow_run(uuid, text, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_ai_workflow_run(uuid, text, integer, uuid)
  to service_role;

-- Provider calls can be retried independently of the queue/workflow. Keep an
-- atomic operational count for cost and reliability monitoring; only trusted
-- server code is allowed to mutate it.
create or replace function public.increment_ai_workflow_provider_attempt(
  p_run_id uuid
)
returns setof public.ai_workflow_runs
language sql
security definer
set search_path = public
as $$
  update public.ai_workflow_runs
  set
    provider_attempt_count = provider_attempt_count + 1,
    updated_at = now()
  where id = p_run_id
  returning *;
$$;

revoke all on function public.increment_ai_workflow_provider_attempt(uuid)
  from public, anon, authenticated;
grant execute on function public.increment_ai_workflow_provider_attempt(uuid)
  to service_role;

-- Lexical companion to match_debate_corpus_items. The semantic matcher stays
-- unchanged; callers fuse these ranked candidates with semantic candidates.
create index if not exists debate_corpus_items_embedding_text_fts_idx
  on public.debate_corpus_items
  using gin (to_tsvector('simple', embedding_text));

create or replace function public.search_debate_corpus_items_lexical(
  query_text text,
  match_count integer default 8,
  language text default 'vi',
  usable_for text default null,
  review_statuses text[] default array['approved', 'needs_review']::text[],
  min_confidence numeric default 0.7
)
returns table (
  item_id uuid,
  canonical_match_id uuid,
  canonical_match_key text,
  motion_vi text,
  item_type text,
  language text,
  side text,
  usable_for text[],
  evidence_status text,
  confidence numeric,
  review_status text,
  embedding_text text,
  content jsonb,
  similarity double precision,
  lexical_rank integer,
  lexical_score double precision
)
language sql
stable
as $$
  with params as (
    select
      $1::text as raw_query,
      websearch_to_tsquery('simple', trim($1)) as ts_query,
      $3::text as match_language,
      $4::text as match_usable_for,
      $5::text[] as match_review_statuses,
      $6::numeric as match_min_confidence
  ), ranked as (
    select
      item.id as item_id,
      corpus_match.id as canonical_match_id,
      corpus_match.canonical_match_key,
      corpus_match.motion_vi,
      item.item_type,
      item.language,
      item.side,
      item.usable_for,
      item.evidence_status,
      item.confidence,
      item.review_status,
      item.embedding_text,
      item.content,
      0::double precision as similarity,
      ts_rank_cd(
        to_tsvector('simple', item.embedding_text),
        params.ts_query,
        32
      )::double precision as lexical_score
    from public.debate_corpus_items as item
    join public.debate_corpus_matches as corpus_match
      on corpus_match.id = item.canonical_match_id
    cross join params
    where coalesce(trim(params.raw_query), '') <> ''
      and params.ts_query @@ to_tsvector('simple', item.embedding_text)
      and item.language = params.match_language
      and item.review_status = any(params.match_review_statuses)
      and item.confidence >= params.match_min_confidence
      and item.evidence_status in ('verified_from_video', 'mentioned_but_unverified', 'not_applicable')
      and corpus_match.import_decision in ('candidate', 'phrase_only')
      and (
        params.match_usable_for is null
        or params.match_usable_for = any(item.usable_for)
      )
  )
  select
    ranked.item_id,
    ranked.canonical_match_id,
    ranked.canonical_match_key,
    ranked.motion_vi,
    ranked.item_type,
    ranked.language,
    ranked.side,
    ranked.usable_for,
    ranked.evidence_status,
    ranked.confidence,
    ranked.review_status,
    ranked.embedding_text,
    ranked.content,
    ranked.similarity,
    row_number() over (
      order by ranked.lexical_score desc, ranked.confidence desc, ranked.item_id
    )::integer as lexical_rank,
    ranked.lexical_score
  from ranked
  order by lexical_rank
  limit least(greatest(match_count, 1), 24);
$$;

revoke all on function public.search_debate_corpus_items_lexical(
  text, integer, text, text, text[], numeric
) from public, anon, authenticated;
grant execute on function public.search_debate_corpus_items_lexical(
  text, integer, text, text, text[], numeric
) to service_role;
