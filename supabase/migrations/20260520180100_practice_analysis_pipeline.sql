-- ============================================================
-- Practice analysis pipeline foundation
-- ============================================================

create table if not exists public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'analyzing', 'completed', 'failed')),
  practice_track text not null default 'debate'
    check (practice_track in ('speaking', 'debate')),
  practice_language text not null default 'en'
    check (practice_language in ('en', 'vi')),
  topic_id uuid,
  practice_topic_key text,
  topic_title text not null,
  topic_category text not null default 'Practice',
  topic_category_key text,
  topic_difficulty text not null default 'intermediate'
    check (topic_difficulty in ('beginner', 'intermediate', 'advanced')),
  side text not null check (side in ('proposition', 'opposition')),
  mode text not null default 'quick' check (mode in ('quick', 'full')),
  prep_time integer not null default 0,
  speech_time integer not null default 0,
  duration_seconds integer not null default 0,
  transcript text not null default '',
  prep_notes text,
  ai_difficulty text check (ai_difficulty in ('easy', 'medium', 'hard')),
  rounds jsonb,
  audio_storage_path text,
  attempt_snapshot jsonb not null default '{}',
  input_hash text,
  prompt_hash text,
  prompt_bundle_key text not null default 'practice_feedback',
  prompt_bundle_version integer not null default 1,
  rubric_key text not null default 'debate_v1',
  rubric_version integer not null default 1,
  model_provider text,
  model_name text,
  feedback jsonb,
  total_score integer check (total_score is null or (total_score >= 0 and total_score <= 100)),
  overall_band text,
  legacy_debate_session_id uuid references public.debate_sessions(id) on delete set null,
  error_code text,
  error_message text,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.practice_attempts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_type text not null default 'practice_feedback',
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  queue_topic text not null default 'practice-analysis',
  queue_message_id text,
  idempotency_key text not null unique,
  delivery_count integer not null default 0,
  max_attempts integer not null default 3,
  input_hash text,
  prompt_hash text,
  model_provider text,
  model_name text,
  started_at timestamptz,
  finished_at timestamptz,
  next_retry_at timestamptz,
  error_code text,
  error_message text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, job_type)
);

create index if not exists practice_attempts_user_created_idx
  on public.practice_attempts(user_id, created_at desc);

create index if not exists practice_attempts_status_created_idx
  on public.practice_attempts(status, created_at desc);

create index if not exists analysis_jobs_user_created_idx
  on public.analysis_jobs(user_id, created_at desc);

create index if not exists analysis_jobs_status_created_idx
  on public.analysis_jobs(status, created_at desc);

create index if not exists analysis_jobs_attempt_idx
  on public.analysis_jobs(attempt_id);

alter table public.practice_attempts enable row level security;
alter table public.analysis_jobs enable row level security;

drop policy if exists "Users can view own practice attempts"
  on public.practice_attempts;
create policy "Users can view own practice attempts"
  on public.practice_attempts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own practice attempts"
  on public.practice_attempts;
create policy "Users can insert own practice attempts"
  on public.practice_attempts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can view own analysis jobs"
  on public.analysis_jobs;
create policy "Users can view own analysis jobs"
  on public.analysis_jobs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own analysis jobs"
  on public.analysis_jobs;
create policy "Users can insert own analysis jobs"
  on public.analysis_jobs for insert
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'practice-audio',
  'practice-audio',
  false,
  26214400,
  array['audio/webm', 'audio/webm;codecs=opus']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own practice audio"
  on storage.objects;
create policy "Users can read own practice audio"
  on storage.objects for select
  using (
    bucket_id = 'practice-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can insert own practice audio"
  on storage.objects;
create policy "Users can insert own practice audio"
  on storage.objects for insert
  with check (
    bucket_id = 'practice-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update own practice audio"
  on storage.objects;
create policy "Users can update own practice audio"
  on storage.objects for update
  using (
    bucket_id = 'practice-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'practice-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete own practice audio"
  on storage.objects;
create policy "Users can delete own practice audio"
  on storage.objects for delete
  using (
    bucket_id = 'practice-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
