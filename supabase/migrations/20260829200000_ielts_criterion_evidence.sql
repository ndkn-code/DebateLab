-- Append-only criterion evidence for provisional and adjudicated IELTS W/S runs.
begin;
create table if not exists public.ielts_criterion_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_id uuid not null references public.ielts_attempts(id) on delete cascade,
  question_id uuid not null references public.ielts_questions(id) on delete cascade,
  response_id uuid not null,
  writing_response_id uuid references public.writing_responses(id) on delete cascade,
  speaking_response_id uuid references public.speaking_responses(id) on delete cascade,
  skill public.ielts_skill not null,
  revision integer not null default 0 check (revision >= 0),
  criterion text not null,
  stage text not null check (stage in ('provisional', 'adjudicated')),
  band numeric(2,1) not null check (band >= 0 and band <= 9 and band * 2 = trunc(band * 2)),
  rationale text not null check (char_length(rationale) between 1 and 2000),
  grading_version text not null check (char_length(grading_version) between 1 and 100),
  trace_id text not null check (char_length(trace_id) between 1 and 200),
  run_id text not null check (char_length(run_id) between 1 and 200),
  provider text not null check (char_length(provider) between 1 and 100),
  model text not null check (char_length(model) between 1 and 200),
  rubric_version text not null check (char_length(rubric_version) between 1 and 100),
  prompt_version text not null check (char_length(prompt_version) between 1 and 100),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  workflow_attempt integer not null check (workflow_attempt >= 0),
  provider_attempt integer not null check (provider_attempt >= 0),
  validated_output_snapshot jsonb not null,
  deterministic_hash text not null check (deterministic_hash ~ '^[a-f0-9]{8}$'),
  source_response_revision integer not null check (source_response_revision >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ielts_criterion_evidence_one_response check ((skill = 'writing' and writing_response_id = response_id and speaking_response_id is null) or (skill = 'speaking' and speaking_response_id = response_id and writing_response_id is null)),
  constraint ielts_criterion_evidence_criterion_check check ((skill = 'writing' and criterion in ('taskResponse', 'coherenceCohesion', 'lexicalResource', 'grammaticalRangeAccuracy')) or (skill = 'speaking' and criterion in ('fluencyCoherence', 'lexicalResource', 'grammaticalRangeAccuracy', 'pronunciation'))),
  unique (response_id, revision, run_id, stage, criterion)
);
comment on table public.ielts_criterion_evidence is 'Append-only, versioned criterion evidence emitted by IELTS Writing/Speaking scorer runs.';
create index if not exists idx_ielts_criterion_evidence_user_created on public.ielts_criterion_evidence(user_id, created_at desc);
create index if not exists idx_ielts_criterion_evidence_response on public.ielts_criterion_evidence(response_id, revision, created_at desc);
create index if not exists idx_ielts_criterion_evidence_criterion on public.ielts_criterion_evidence(user_id, skill, criterion, created_at desc);
alter table public.ielts_criterion_evidence enable row level security;
drop policy if exists "No direct learner access to IELTS criterion evidence" on public.ielts_criterion_evidence;
create policy "No direct learner access to IELTS criterion evidence" on public.ielts_criterion_evidence for select to authenticated using (false);
revoke all on table public.ielts_criterion_evidence from anon, authenticated, service_role;
grant select, insert on table public.ielts_criterion_evidence to service_role;
create or replace function private.reject_ielts_criterion_evidence_mutation() returns trigger language plpgsql security invoker set search_path = public as $$ begin raise exception 'ielts_criterion_evidence is append-only'; end; $$;
drop trigger if exists ielts_criterion_evidence_immutable on public.ielts_criterion_evidence;
create trigger ielts_criterion_evidence_immutable before update or delete on public.ielts_criterion_evidence for each row execute function private.reject_ielts_criterion_evidence_mutation();
revoke execute on function private.reject_ielts_criterion_evidence_mutation() from public;

-- Retry requests are also immutable: they are an audit trail for controlled
-- teacher/support actions, not a mutable workflow status projection.
create table if not exists public.ielts_scoring_retry_events (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('writing', 'speaking')),
  source_id uuid not null,
  source_revision integer not null check (source_revision >= 0),
  previous_workflow_run text,
  new_workflow_run text not null,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  class_id uuid,
  attempt_id uuid references public.ielts_attempts(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  retry_ordinal integer not null check (retry_ordinal between 1 and 3),
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);
comment on table public.ielts_scoring_retry_events is
  'Append-only audit events for controlled IELTS Writing/Speaking score retries.';
alter table public.ielts_scoring_retry_events enable row level security;
drop policy if exists "No direct learner access to IELTS scoring retry events" on public.ielts_scoring_retry_events;
create policy "No direct learner access to IELTS scoring retry events"
  on public.ielts_scoring_retry_events for select to authenticated using (false);
revoke all on table public.ielts_scoring_retry_events from anon, authenticated, service_role;
grant select, insert on table public.ielts_scoring_retry_events to service_role;
create or replace function private.reject_ielts_scoring_retry_event_mutation()
returns trigger language plpgsql security invoker set search_path = public
as $$ begin raise exception 'ielts_scoring_retry_events is append-only'; end; $$;
drop trigger if exists ielts_scoring_retry_events_immutable on public.ielts_scoring_retry_events;
create trigger ielts_scoring_retry_events_immutable before update or delete
  on public.ielts_scoring_retry_events for each row
  execute function private.reject_ielts_scoring_retry_event_mutation();
revoke execute on function private.reject_ielts_scoring_retry_event_mutation() from public;

-- The existing telemetry constraint predates the IELTS scorer. Keep all prior
-- output types and admit the four scorer/provider-core values emitted by the
-- reused workflow path.
alter table public.ai_provider_requests
  drop constraint if exists ai_provider_requests_output_type_check;
alter table public.ai_provider_requests
  add constraint ai_provider_requests_output_type_check
  check (
    output_type is null
    or output_type in (
      'rebuttal', 'practice_judging', 'duel_judging', 'coach_chat',
      'coach_deep_review', 'coach_metadata', 'coach_title',
      'coach_visual_prompt', 'coach_visual_planner',
      'ielts_writing_score', 'ielts_speaking_score',
      'ielts_writing_score_adjudication', 'ielts_speaking_score_adjudication'
    )
  );

commit;
