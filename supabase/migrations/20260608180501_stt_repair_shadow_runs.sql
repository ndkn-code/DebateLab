-- Shadow QA records for conservative JudgeTranscript repair experiments.
-- This table stores audit metadata only for admins/service role; student-facing
-- transcript behavior remains controlled by application feature flags.

create table if not exists public.stt_repair_shadow_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  practice_attempt_id uuid references public.practice_attempts(id) on delete cascade,
  analysis_job_id uuid references public.analysis_jobs(id) on delete set null,
  debate_session_id uuid references public.debate_sessions(id) on delete set null,
  source_route text not null default '',
  practice_track text not null default 'debate',
  practice_language text not null default 'vi',
  topic_title text,
  side text,
  audio_storage_path text,
  raw_transcript_hash text not null,
  baseline_transcript_hash text not null,
  judge_transcript_hash text,
  judge_transcript text,
  repair_status text not null default 'skipped' check (
    repair_status in (
      'not_attempted',
      'skipped',
      'repaired',
      'uncertain',
      'hallucination_risk',
      'failed'
    )
  ),
  repair_mode text not null default 'shadow' check (repair_mode in ('shadow', 'judge')),
  repair_provider text not null default '',
  repair_model text not null default '',
  repair_version integer not null default 1,
  repair_latency_ms integer not null default 0 check (repair_latency_ms >= 0),
  edits jsonb not null default '[]'::jsonb,
  uncertain_spans jsonb not null default '[]'::jsonb,
  warnings text[] not null default '{}',
  hallucination_risk numeric(5,4) not null default 0 check (
    hallucination_risk >= 0 and hallucination_risk <= 1
  ),
  score_before integer check (score_before is null or (score_before >= 0 and score_before <= 100)),
  score_after integer check (score_after is null or (score_after >= 0 and score_after <= 100)),
  score_delta integer,
  soft_cap_reasons text[] not null default '{}',
  metrics jsonb not null default '{}'::jsonb,
  review_status text not null default 'unreviewed' check (
    review_status in ('unreviewed', 'reviewed', 'flagged', 'ignored')
  ),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stt_repair_shadow_runs_created_idx
  on public.stt_repair_shadow_runs(created_at desc);

create index if not exists stt_repair_shadow_runs_attempt_idx
  on public.stt_repair_shadow_runs(practice_attempt_id, created_at desc)
  where practice_attempt_id is not null;

create index if not exists stt_repair_shadow_runs_user_created_idx
  on public.stt_repair_shadow_runs(user_id, created_at desc)
  where user_id is not null;

create index if not exists stt_repair_shadow_runs_status_idx
  on public.stt_repair_shadow_runs(repair_status, review_status, created_at desc);

create unique index if not exists stt_repair_shadow_runs_attempt_hash_idx
  on public.stt_repair_shadow_runs(practice_attempt_id, raw_transcript_hash, repair_version);

alter table public.stt_repair_shadow_runs enable row level security;

drop policy if exists "Admins can view stt repair shadow runs" on public.stt_repair_shadow_runs;
create policy "Admins can view stt repair shadow runs"
  on public.stt_repair_shadow_runs for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can update stt repair shadow review" on public.stt_repair_shadow_runs;
create policy "Admins can update stt repair shadow review"
  on public.stt_repair_shadow_runs for update
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

grant select, update on public.stt_repair_shadow_runs to authenticated;
grant all on public.stt_repair_shadow_runs to service_role;
