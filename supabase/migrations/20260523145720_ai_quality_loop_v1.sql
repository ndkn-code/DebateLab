-- AI feedback quality loop for beta calibration.

create table if not exists public.ai_quality_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  output_type text not null check (
    output_type in ('rebuttal', 'practice_judging', 'duel_judging')
  ),
  status text not null default 'success' check (status in ('success', 'error')),
  review_status text not null default 'unreviewed' check (
    review_status in ('unreviewed', 'reviewed', 'flagged', 'ignored')
  ),
  source_route text,
  provider text not null,
  requested_provider text,
  model text not null,
  prompt_bundle_key text,
  prompt_bundle_version integer,
  prompt_hash text,
  rubric_key text,
  rubric_version integer,
  practice_track text check (practice_track in ('speaking', 'debate')),
  practice_language text check (practice_language in ('en', 'vi')),
  difficulty text,
  debate_format text,
  side text check (side in ('proposition', 'opposition')),
  ai_side text check (ai_side in ('proposition', 'opposition')),
  topic_title text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  cache_hit_tokens integer check (cache_hit_tokens is null or cache_hit_tokens >= 0),
  cache_miss_tokens integer check (cache_miss_tokens is null or cache_miss_tokens >= 0),
  reasoning_tokens integer check (reasoning_tokens is null or reasoning_tokens >= 0),
  estimated_cost_usd numeric(12, 6) not null default 0,
  fallback_used boolean not null default false,
  error_code text,
  error_message text,
  winner text check (
    winner is null
    or winner in ('user', 'ai', 'tie', 'proposition', 'opposition')
  ),
  score integer check (score is null or (score >= 0 and score <= 100)),
  confidence numeric(5, 4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  output_preview text,
  output_text text,
  input_preview text,
  practice_attempt_id uuid references public.practice_attempts(id) on delete set null,
  analysis_job_id uuid references public.analysis_jobs(id) on delete set null,
  debate_session_id uuid references public.debate_sessions(id) on delete set null,
  debate_duel_id uuid references public.debate_duels(id) on delete set null,
  debate_duel_judgment_id uuid references public.debate_duel_judgments(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  admin_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_quality_ratings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ai_quality_runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  usefulness text check (usefulness is null or usefulness in ('yes', 'somewhat', 'no')),
  fairness text check (fairness is null or fairness in ('too_harsh', 'fair', 'too_generous')),
  reason_tags text[] not null default '{}'::text[],
  comment text,
  locale text check (locale is null or locale in ('en', 'vi')),
  route text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, user_id),
  check (
    reason_tags <@ array[
      'too_generic',
      'missed_argument',
      'wrong_winner',
      'score_felt_wrong',
      'vietnamese_sounded_weird',
      'hallucinated_evidence',
      'too_harsh',
      'too_easy',
      'latency_too_slow'
    ]::text[]
  )
);

create index if not exists idx_ai_quality_runs_user_created
  on public.ai_quality_runs(user_id, created_at desc);
create index if not exists idx_ai_quality_runs_output_created
  on public.ai_quality_runs(output_type, created_at desc);
create index if not exists idx_ai_quality_runs_review_created
  on public.ai_quality_runs(review_status, created_at desc);
create index if not exists idx_ai_quality_runs_provider_created
  on public.ai_quality_runs(provider, created_at desc);
create index if not exists idx_ai_quality_runs_language_created
  on public.ai_quality_runs(practice_language, created_at desc);
create index if not exists idx_ai_quality_runs_attempt
  on public.ai_quality_runs(practice_attempt_id);
create index if not exists idx_ai_quality_runs_analysis_job
  on public.ai_quality_runs(analysis_job_id);
create index if not exists idx_ai_quality_runs_session
  on public.ai_quality_runs(debate_session_id);
create index if not exists idx_ai_quality_runs_duel
  on public.ai_quality_runs(debate_duel_id);
create index if not exists idx_ai_quality_runs_duel_judgment
  on public.ai_quality_runs(debate_duel_judgment_id);
create index if not exists idx_ai_quality_runs_reviewed_by
  on public.ai_quality_runs(reviewed_by);
create index if not exists idx_ai_quality_ratings_run
  on public.ai_quality_ratings(run_id);
create index if not exists idx_ai_quality_ratings_user_created
  on public.ai_quality_ratings(user_id, created_at desc);
create index if not exists idx_ai_quality_ratings_tags
  on public.ai_quality_ratings using gin(reason_tags);

alter table public.ai_quality_runs enable row level security;
alter table public.ai_quality_ratings enable row level security;

drop policy if exists "Users can view own ai quality runs" on public.ai_quality_runs;
create policy "Users can view own ai quality runs"
  on public.ai_quality_runs for select
  to authenticated
  using (
    auth.uid() = user_id
    or private.is_admin(auth.uid())
    or (
      debate_duel_id is not null
      and public.can_access_duel(debate_duel_id, auth.uid())
    )
  );

drop policy if exists "Users can insert own ai quality runs" on public.ai_quality_runs;
create policy "Users can insert own ai quality runs"
  on public.ai_quality_runs for insert
  to authenticated
  with check (auth.uid() = user_id or private.is_admin(auth.uid()));

drop policy if exists "Admins can manage ai quality runs" on public.ai_quality_runs;
drop policy if exists "Admins can update ai quality runs" on public.ai_quality_runs;
create policy "Admins can update ai quality runs"
  on public.ai_quality_runs for update
  to authenticated
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can delete ai quality runs" on public.ai_quality_runs;
create policy "Admins can delete ai quality runs"
  on public.ai_quality_runs for delete
  to authenticated
  using (private.is_admin(auth.uid()));

drop policy if exists "Users can view own ai quality ratings" on public.ai_quality_ratings;
create policy "Users can view own ai quality ratings"
  on public.ai_quality_ratings for select
  to authenticated
  using (auth.uid() = user_id or private.is_admin(auth.uid()));

drop policy if exists "Users can insert own ai quality ratings" on public.ai_quality_ratings;
create policy "Users can insert own ai quality ratings"
  on public.ai_quality_ratings for insert
  to authenticated
  with check (
    private.is_admin(auth.uid())
    or (
      auth.uid() = user_id
      and exists (
        select 1
        from public.ai_quality_runs run
        where run.id = public.ai_quality_ratings.run_id
          and (
            run.user_id = auth.uid()
            or (
              run.debate_duel_id is not null
              and public.can_access_duel(run.debate_duel_id, auth.uid())
            )
          )
      )
    )
  );

drop policy if exists "Users can update own ai quality ratings" on public.ai_quality_ratings;
create policy "Users can update own ai quality ratings"
  on public.ai_quality_ratings for update
  to authenticated
  using (auth.uid() = user_id or private.is_admin(auth.uid()))
  with check (
    private.is_admin(auth.uid())
    or (
      auth.uid() = user_id
      and exists (
        select 1
        from public.ai_quality_runs run
        where run.id = public.ai_quality_ratings.run_id
          and (
            run.user_id = auth.uid()
            or (
              run.debate_duel_id is not null
              and public.can_access_duel(run.debate_duel_id, auth.uid())
            )
          )
      )
    )
  );

drop policy if exists "Admins can manage ai quality ratings" on public.ai_quality_ratings;
drop policy if exists "Admins can delete ai quality ratings" on public.ai_quality_ratings;
create policy "Admins can delete ai quality ratings"
  on public.ai_quality_ratings for delete
  to authenticated
  using (private.is_admin(auth.uid()));

revoke all on public.ai_quality_runs from anon;
revoke all on public.ai_quality_ratings from anon;
revoke all on public.ai_quality_runs from authenticated;
revoke all on public.ai_quality_ratings from authenticated;
grant select, insert on public.ai_quality_runs to authenticated;
grant select, insert, update on public.ai_quality_ratings to authenticated;
grant all on public.ai_quality_runs to service_role;
grant all on public.ai_quality_ratings to service_role;
