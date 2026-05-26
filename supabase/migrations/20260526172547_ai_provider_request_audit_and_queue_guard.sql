-- Provider-level AI request audit for reconciling app usage with vendor dashboards.

create table if not exists public.ai_provider_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  provider text not null,
  model text not null,
  status text not null check (status in ('success', 'error')),
  source_route text,
  output_type text check (
    output_type is null
    or output_type in ('rebuttal', 'practice_judging', 'duel_judging')
  ),
  request_id text,
  response_status integer check (response_status is null or response_status >= 0),
  finish_reason text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  cache_hit_tokens integer check (cache_hit_tokens is null or cache_hit_tokens >= 0),
  cache_miss_tokens integer check (cache_miss_tokens is null or cache_miss_tokens >= 0),
  reasoning_tokens integer check (reasoning_tokens is null or reasoning_tokens >= 0),
  estimated_cost_usd numeric(12, 6) not null default 0,
  error_code text,
  error_message text,
  practice_attempt_id uuid references public.practice_attempts(id) on delete set null,
  analysis_job_id uuid references public.analysis_jobs(id) on delete set null,
  debate_session_id uuid references public.debate_sessions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_provider_requests_created
  on public.ai_provider_requests(created_at desc);
create index if not exists idx_ai_provider_requests_provider_created
  on public.ai_provider_requests(provider, created_at desc);
create index if not exists idx_ai_provider_requests_status_created
  on public.ai_provider_requests(status, created_at desc);
create index if not exists idx_ai_provider_requests_user_created
  on public.ai_provider_requests(user_id, created_at desc);
create index if not exists idx_ai_provider_requests_attempt
  on public.ai_provider_requests(practice_attempt_id);
create index if not exists idx_ai_provider_requests_job
  on public.ai_provider_requests(analysis_job_id);

alter table public.ai_provider_requests enable row level security;

drop policy if exists "Admins can view ai provider requests"
  on public.ai_provider_requests;
create policy "Admins can view ai provider requests"
  on public.ai_provider_requests for select
  to authenticated
  using (private.is_admin(auth.uid()));

revoke all on public.ai_provider_requests from anon;
revoke all on public.ai_provider_requests from authenticated;
grant select on public.ai_provider_requests to authenticated;
grant all on public.ai_provider_requests to service_role;
