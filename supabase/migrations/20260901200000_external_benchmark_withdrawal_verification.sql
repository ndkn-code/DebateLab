begin;

-- Prepare the externally verified withdrawal schema without touching legacy
-- rows. Backfill and final constraints live in later forward-only migrations so
-- no transaction runs ALTER TABLE after data-changing statements.

-- Study participants and guardians are intentionally not DebateLab accounts.
-- Operator identities remain normal, separately verified profiles, while the
-- subject of a withdrawal is represented only by a study-scoped pseudonym.
create table public.ai_grading_withdrawal_operator_keys (
  id uuid primary key default gen_random_uuid(),
  key_id text not null unique
    check (key_id ~ '^[a-z0-9][a-z0-9._-]{7,127}$'),
  operator_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  credential_verified_by_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  public_key_base64 text not null
    check (public_key_base64 ~ '^[A-Za-z0-9+/]{42,44}={0,2}$'),
  signature_algorithm text not null default 'ed25519'
    check (signature_algorithm = 'ed25519'),
  credential_receipt_sha256 text not null
    check (credential_receipt_sha256 ~ '^[a-f0-9]{64}$'),
  credential_verified_at timestamptz not null,
  valid_from timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (operator_profile_id <> credential_verified_by_profile_id),
  check (expires_at > valid_from),
  check (credential_verified_at <= valid_from)
);

-- Revocation is append-only rather than an update to the verified key record.
create table public.ai_grading_withdrawal_operator_key_revocations (
  operator_key_id uuid primary key
    references public.ai_grading_withdrawal_operator_keys(id) on delete restrict,
  revoked_by_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  reason_code text not null
    check (reason_code in ('key_compromise', 'operator_departed', 'credential_expired', 'administrative')),
  revocation_receipt_sha256 text not null
    check (revocation_receipt_sha256 ~ '^[a-f0-9]{64}$'),
  revoked_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.ai_grading_withdrawal_operator_keys enable row level security;
alter table public.ai_grading_withdrawal_operator_key_revocations enable row level security;
revoke all on public.ai_grading_withdrawal_operator_keys
  from public, anon, authenticated, service_role;
revoke all on public.ai_grading_withdrawal_operator_key_revocations
  from public, anon, authenticated, service_role;

create policy ai_grading_withdrawal_operator_keys_deny_browser
  on public.ai_grading_withdrawal_operator_keys for all to anon, authenticated
  using (false) with check (false);
create policy ai_grading_withdrawal_operator_key_revocations_deny_browser
  on public.ai_grading_withdrawal_operator_key_revocations for all to anon, authenticated
  using (false) with check (false);

-- Add nullable target columns first. A previously consumed receipt remains an
-- idempotency record, while the next migration derives its pseudonymous fields.
alter table public.ai_grading_verified_withdrawal_receipts
  drop constraint if exists ai_grading_verified_withdrawal_receipts_withdrawn_by_fkey,
  drop constraint if exists ai_grading_verified_withdrawal_receipts_verified_by_fkey,
  drop constraint if exists ai_grading_verified_withdrawal_receipts_benchmark_id_key,
  add column study_actor_key text,
  add column actor_kind text,
  add column request_key text,
  add column verification_version text,
  add column operator_key_id uuid
    references public.ai_grading_withdrawal_operator_keys(id) on delete restrict,
  add column signed_payload jsonb,
  add column signed_payload_sha256 text,
  add column operator_signature_base64 text,
  add column expires_at timestamptz,
  add column legacy_operator_profile_sha256 text;

alter table public.ai_grading_benchmark_withdrawals
  drop constraint if exists ai_grading_benchmark_withdrawals_withdrawn_by_fkey,
  add column study_actor_key text,
  add column actor_kind text,
  add column verified_receipt_id uuid
    references public.ai_grading_verified_withdrawal_receipts(id) on delete restrict;

-- Restate the privilege boundary before the backfill so a partially applied
-- rollout never exposes the transitional columns.
revoke all on public.ai_grading_verified_withdrawal_receipts
  from public, anon, authenticated, service_role;
revoke all on public.ai_grading_benchmark_withdrawals
  from public, anon, authenticated, service_role;
revoke execute on function public.withdraw_ai_grading_benchmark(uuid, uuid)
  from service_role;
create index ai_grading_verified_withdrawal_receipts_benchmark_idx
  on public.ai_grading_verified_withdrawal_receipts(benchmark_id, verified_at desc);

commit;
