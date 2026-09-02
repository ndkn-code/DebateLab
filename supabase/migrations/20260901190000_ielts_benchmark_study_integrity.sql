begin;

-- Directly consented commercial evaluation data must not be mislabeled as an
-- excerpt, a derived work, or public-domain material. Retrieval publication
-- functions intentionally continue to exclude this benchmark-only status.
alter table public.ai_knowledge_sources
  drop constraint if exists ai_knowledge_sources_rights_status_check;
alter table public.ai_knowledge_sources
  add constraint ai_knowledge_sources_rights_status_check check (
    rights_status in (
      'approved_for_benchmark_evaluation',
      'approved_for_derived_use', 'approved_for_excerpt', 'public_domain',
      'requires_review', 'restricted', 'unknown'
    )
  );

create table if not exists public.ai_grading_benchmark_withdrawals (
  id uuid primary key default gen_random_uuid(),
  benchmark_id uuid not null unique
    references public.ai_grading_benchmarks(id) on delete restrict,
  withdrawn_by uuid not null references public.profiles(id) on delete restrict,
  reason_code text not null check (
    reason_code in ('participant_withdrawal', 'guardian_withdrawal', 'rights_revoked', 'retention_expired')
  ),
  receipt_sha256 text not null check (receipt_sha256 ~ '^[a-f0-9]{64}$'),
  withdrawn_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Only a database operator/study-lead verification process may populate this
-- registry. The service role is intentionally denied direct writes and can
-- only consume an existing verified receipt through the withdrawal RPC below.
create table if not exists public.ai_grading_verified_withdrawal_receipts (
  id uuid primary key default gen_random_uuid(),
  benchmark_id uuid not null unique
    references public.ai_grading_benchmarks(id) on delete restrict,
  withdrawn_by uuid not null references public.profiles(id) on delete restrict,
  reason_code text not null check (
    reason_code in ('participant_withdrawal', 'guardian_withdrawal', 'rights_revoked', 'retention_expired')
  ),
  receipt_sha256 text not null check (receipt_sha256 ~ '^[a-f0-9]{64}$'),
  verified_by uuid not null references public.profiles(id) on delete restrict,
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (verified_by <> withdrawn_by)
);

-- A current study-lead Ed25519 attestation can be refreshed without mutating
-- the immutable gold label. Service-role importers may store a signed envelope,
-- but cannot forge it because the private key is held offline by the study lead.
create table if not exists public.ai_grading_benchmark_release_attestations (
  benchmark_id uuid primary key
    references public.ai_grading_benchmarks(id) on delete restrict,
  key_id text not null check (key_id ~ '^[a-z0-9][a-z0-9._-]{7,127}$'),
  envelope jsonb not null,
  signature_base64 text not null,
  verified_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > verified_at),
  check (envelope ->> 'benchmarkKey' is not null),
  check (envelope ->> 'withdrawalCheckedAt' is not null)
);

alter table public.ai_grading_benchmark_withdrawals enable row level security;
alter table public.ai_grading_verified_withdrawal_receipts enable row level security;
alter table public.ai_grading_benchmark_release_attestations enable row level security;
revoke all on public.ai_grading_benchmark_withdrawals
  from public, anon, authenticated, service_role;
revoke all on public.ai_grading_verified_withdrawal_receipts
  from public, anon, authenticated, service_role;
revoke all on public.ai_grading_benchmark_release_attestations
  from public, anon, authenticated;
grant select, insert, update on public.ai_grading_benchmark_release_attestations
  to service_role;

-- Explicit browser-role deny policies make the intentional server-only posture
-- auditable and keep the static RLS gate from treating deny-all as accidental.
create policy ai_grading_benchmark_withdrawals_deny_browser
  on public.ai_grading_benchmark_withdrawals for all to anon, authenticated
  using (false) with check (false);
create policy ai_grading_verified_withdrawal_receipts_deny_browser
  on public.ai_grading_verified_withdrawal_receipts for all to anon, authenticated
  using (false) with check (false);
create policy ai_grading_benchmark_release_attestations_deny_browser
  on public.ai_grading_benchmark_release_attestations for all to anon, authenticated
  using (false) with check (false);
create policy ai_grading_benchmark_run_claims_deny_browser
  on public.ai_grading_benchmark_run_claims for all to anon, authenticated
  using (false) with check (false);
create policy ai_grading_evaluation_runs_deny_browser
  on public.ai_grading_evaluation_runs for all to anon, authenticated
  using (false) with check (false);
create policy ai_grading_operational_claims_deny_browser
  on public.ai_grading_operational_claims for all to anon, authenticated
  using (false) with check (false);
create policy ai_grading_operational_evidence_deny_browser
  on public.ai_grading_operational_evidence for all to anon, authenticated
  using (false) with check (false);
create policy ai_grading_operational_scenarios_deny_browser
  on public.ai_grading_operational_scenarios for all to anon, authenticated
  using (false) with check (false);
create policy ai_grading_operational_transitions_deny_browser
  on public.ai_grading_operational_transitions for all to anon, authenticated
  using (false) with check (false);
create policy ai_grading_runtime_attestations_deny_browser
  on public.ai_grading_runtime_attestations for all to anon, authenticated
  using (false) with check (false);

create or replace function private.validate_ielts_benchmark_study_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_kind text;
  v_existing_split text;
begin
  if not new.is_active or new.skill not in ('ielts_speaking', 'ielts_writing') then
    return new;
  end if;
  if not (new.metadata ?& array[
    'candidateKey', 'promptFamilyKey', 'sourceGroupKey', 'captureSessionKey',
    'studyDesignId', 'studyDesignVersion'
  ]) then
    raise exception 'IELTS benchmark study grouping metadata is incomplete';
  end if;
  if new.metadata ->> 'studyDesignId' <> 'debatelab-ielts-examiner-study'
     or new.metadata ->> 'studyDesignVersion' <> '1' then
    raise exception 'IELTS benchmark study design identity is invalid';
  end if;
  if new.protected_label #>> '{consent,withdrawal,status}' <> 'not_withdrawn'
     or new.protected_label #>> '{consent,scopes,commercialAiEvaluation}' <> 'true'
     or new.protected_label #>> '{consent,scopes,humanExaminerReview}' <> 'true' then
    raise exception 'IELTS benchmark consent is incomplete or withdrawn';
  end if;
  if new.split in ('evaluation', 'holdout')
     and new.protected_label #>> '{consent,scopes,futureVersionedReevaluation}' <> 'true' then
    raise exception 'Released benchmark requires future versioned re-evaluation consent';
  end if;
  if new.skill = 'ielts_speaking'
     and new.protected_label #>> '{consent,scopes,voiceProcessing}' <> 'true' then
    raise exception 'Speaking benchmark requires voice-processing consent';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ai-benchmark-source:' || new.source_id::text, 0)
  );
  select benchmark.split into v_existing_split
  from public.ai_grading_benchmarks benchmark
  where benchmark.id <> new.id
    and benchmark.is_active
    and benchmark.skill in ('ielts_speaking', 'ielts_writing')
    and benchmark.source_id = new.source_id
  limit 1;
  if found and v_existing_split <> new.split then
    raise exception 'sourceId cannot cross benchmark splits';
  end if;

  foreach v_kind in array array[
    'candidateKey', 'promptFamilyKey', 'sourceGroupKey', 'captureSessionKey'
  ] loop
    v_key := new.metadata ->> v_kind;
    if coalesce(v_key, '') !~ '^[a-z0-9][a-z0-9._-]{7,127}$' then
      raise exception 'Invalid pseudonymous study key: %', v_kind;
    end if;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('ai-benchmark-group:' || v_kind || ':' || v_key, 0)
    );
    select benchmark.split into v_existing_split
    from public.ai_grading_benchmarks benchmark
    where benchmark.id <> new.id
      and benchmark.is_active
      and benchmark.skill in ('ielts_speaking', 'ielts_writing')
      and benchmark.metadata ->> v_kind = v_key
    limit 1;
    if found and v_existing_split <> new.split then
      raise exception '% cannot cross benchmark splits', v_kind;
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function private.validate_ielts_benchmark_study_row()
  from public, anon, authenticated;
drop trigger if exists validate_ielts_benchmark_study_row
  on public.ai_grading_benchmarks;
create trigger validate_ielts_benchmark_study_row
  before insert or update of metadata, protected_label, split, is_active
  on public.ai_grading_benchmarks
  for each row execute function private.validate_ielts_benchmark_study_row();

create index if not exists ai_grading_benchmarks_candidate_split_idx
  on public.ai_grading_benchmarks ((metadata ->> 'candidateKey'), split)
  where is_active and skill in ('ielts_speaking', 'ielts_writing');
create index if not exists ai_grading_benchmarks_prompt_family_split_idx
  on public.ai_grading_benchmarks ((metadata ->> 'promptFamilyKey'), split)
  where is_active and skill in ('ielts_speaking', 'ielts_writing');
create index if not exists ai_grading_benchmarks_source_group_split_idx
  on public.ai_grading_benchmarks ((metadata ->> 'sourceGroupKey'), split)
  where is_active and skill in ('ielts_speaking', 'ielts_writing');
create index if not exists ai_grading_benchmarks_capture_session_split_idx
  on public.ai_grading_benchmarks ((metadata ->> 'captureSessionKey'), split)
  where is_active and skill in ('ielts_speaking', 'ielts_writing');

create or replace function private.protect_ielts_benchmark_study_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Protected benchmark rows cannot be deleted';
  end if;
  if old.protected_label is distinct from new.protected_label
     or old.metadata is distinct from new.metadata
     or old.collection_id is distinct from new.collection_id
     or old.source_id is distinct from new.source_id
     or old.benchmark_key is distinct from new.benchmark_key
     or old.skill is distinct from new.skill
     or old.task_type is distinct from new.task_type
     or old.band_or_score_range is distinct from new.band_or_score_range
     or old.accent_group is distinct from new.accent_group
     or old.split is distinct from new.split then
    raise exception 'Protected benchmark labels and study identity are immutable';
  end if;
  if old.is_active and not new.is_active then
    if not exists (
      select 1 from public.ai_grading_benchmark_withdrawals withdrawal
      where withdrawal.benchmark_id = old.id
    ) then
      raise exception 'Benchmark deactivation requires a withdrawal audit';
    end if;
    return new;
  end if;
  if old.is_active is distinct from new.is_active then
    raise exception 'Withdrawn benchmarks cannot be reactivated';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_ielts_benchmark_study_row()
  from public, anon, authenticated;
drop trigger if exists protect_ielts_benchmark_study_row
  on public.ai_grading_benchmarks;
create trigger protect_ielts_benchmark_study_row
  before update or delete on public.ai_grading_benchmarks
  for each row execute function private.protect_ielts_benchmark_study_row();

create or replace function public.withdraw_ai_grading_benchmark(
  p_benchmark_id uuid,
  p_verified_receipt_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.ai_grading_benchmark_withdrawals%rowtype;
  v_verified public.ai_grading_verified_withdrawal_receipts%rowtype;
begin
  if p_verified_receipt_id is null then
    raise exception 'Invalid benchmark withdrawal request';
  end if;
  select * into strict v_verified
  from public.ai_grading_verified_withdrawal_receipts
  where id = p_verified_receipt_id
    and benchmark_id = p_benchmark_id
  for update;
  select * into v_existing
  from public.ai_grading_benchmark_withdrawals
  where benchmark_id = p_benchmark_id
  for update;
  if found then
    if v_existing.withdrawn_by <> v_verified.withdrawn_by
       or v_existing.reason_code <> v_verified.reason_code
       or v_existing.receipt_sha256 <> v_verified.receipt_sha256 then
      raise exception 'Immutable benchmark withdrawal differs';
    end if;
    return true;
  end if;
  if not exists (
    select 1 from public.ai_grading_benchmarks
    where id = p_benchmark_id and is_active
    for update
  ) then
    raise exception 'Active benchmark not found';
  end if;
  insert into public.ai_grading_benchmark_withdrawals(
    benchmark_id, withdrawn_by, reason_code, receipt_sha256
  ) values (
    p_benchmark_id, v_verified.withdrawn_by, v_verified.reason_code, v_verified.receipt_sha256
  );
  update public.ai_grading_benchmarks
  set is_active = false, updated_at = now()
  where id = p_benchmark_id and is_active;
  return found;
end;
$$;

revoke all on function public.withdraw_ai_grading_benchmark(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.withdraw_ai_grading_benchmark(uuid, uuid)
  to service_role;

commit;
