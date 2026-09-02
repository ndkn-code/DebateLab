begin;

-- Finalize the externally verified withdrawal schema only after the preceding
-- migration has backfilled every legacy row. This transaction contains DDL and
-- function definitions only; it intentionally performs no backfill DML.

alter table public.ai_grading_verified_withdrawal_receipts
  drop column withdrawn_by,
  drop column verified_by,
  alter column study_actor_key set not null,
  alter column actor_kind set not null,
  alter column request_key set not null,
  alter column verification_version set not null,
  alter column verification_version set default 'signed_v2',
  add constraint ai_grading_verified_withdrawal_actor_key_check check (
    study_actor_key ~ '^[a-z0-9][a-z0-9._-]{7,127}$'
  ),
  add constraint ai_grading_verified_withdrawal_actor_kind_check check (
    actor_kind in ('participant', 'guardian', 'rights_controller', 'retention_controller')
  ),
  add constraint ai_grading_verified_withdrawal_request_key_unique unique (request_key),
  add constraint ai_grading_verified_withdrawal_version_check check (
    verification_version in ('legacy_profile_v1', 'signed_v2')
  ),
  add constraint ai_grading_verified_withdrawal_signed_fields_check check (
    (
      verification_version = 'legacy_profile_v1'
      and operator_key_id is null
      and signed_payload is null
      and signed_payload_sha256 is null
      and operator_signature_base64 is null
      and expires_at is null
      and legacy_operator_profile_sha256 ~ '^[a-f0-9]{64}$'
    )
    or
    (
      verification_version = 'signed_v2'
      and operator_key_id is not null
      and signed_payload is not null
      and signed_payload_sha256 ~ '^[a-f0-9]{64}$'
      and operator_signature_base64 ~ '^[A-Za-z0-9+/]{80,128}={0,2}$'
      and expires_at is not null
      and legacy_operator_profile_sha256 is null
    )
  ),
  add constraint ai_grading_verified_withdrawal_validity_window_check check (
    verification_version = 'legacy_profile_v1'
    or (
      expires_at > verified_at
      and expires_at <= verified_at + interval '7 days'
    )
  );

alter table public.ai_grading_benchmark_withdrawals
  drop column withdrawn_by,
  alter column study_actor_key set not null,
  alter column actor_kind set not null,
  add constraint ai_grading_benchmark_withdrawal_actor_key_check check (
    study_actor_key ~ '^[a-z0-9][a-z0-9._-]{7,127}$'
  ),
  add constraint ai_grading_benchmark_withdrawal_actor_kind_check check (
    actor_kind in ('participant', 'guardian', 'rights_controller', 'retention_controller')
  ),
  add constraint ai_grading_benchmark_withdrawal_verified_receipt_unique unique (verified_receipt_id);

create or replace function private.validate_ai_grading_verified_withdrawal_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.ai_grading_withdrawal_operator_keys%rowtype;
  v_payload_hash text;
begin
  if new.verification_version <> 'signed_v2' then
    raise exception 'Only signed v2 withdrawal receipts may be registered';
  end if;

  select * into strict v_key
  from public.ai_grading_withdrawal_operator_keys
  where id = new.operator_key_id;

  if new.verified_at < v_key.valid_from or new.verified_at >= v_key.expires_at then
    raise exception 'Withdrawal operator key was not valid at verification time';
  end if;
  if exists (
    select 1
    from public.ai_grading_withdrawal_operator_key_revocations revocation
    where revocation.operator_key_id = new.operator_key_id
      and revocation.revoked_at <= new.verified_at
  ) then
    raise exception 'Withdrawal operator key was revoked at verification time';
  end if;

  v_payload_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(new.signed_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );
  if v_payload_hash <> new.signed_payload_sha256 then
    raise exception 'Signed withdrawal payload hash does not match';
  end if;
  if new.signed_payload ->> 'schema' <> 'debatelab.ielts.withdrawal.v2'
     or new.signed_payload ->> 'benchmarkId' <> new.benchmark_id::text
     or new.signed_payload ->> 'studyActorKey' <> new.study_actor_key
     or new.signed_payload ->> 'actorKind' <> new.actor_kind
     or new.signed_payload ->> 'reasonCode' <> new.reason_code
     or new.signed_payload ->> 'receiptSha256' <> new.receipt_sha256
     or new.signed_payload ->> 'requestKey' <> new.request_key
     or new.signed_payload ->> 'operatorKeyId' <> v_key.key_id then
    raise exception 'Signed withdrawal payload identity does not match registry row';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_ai_grading_verified_withdrawal_receipt()
  from public, anon, authenticated, service_role;
drop trigger if exists validate_ai_grading_verified_withdrawal_receipt
  on public.ai_grading_verified_withdrawal_receipts;
create trigger validate_ai_grading_verified_withdrawal_receipt
  before insert on public.ai_grading_verified_withdrawal_receipts
  for each row execute function private.validate_ai_grading_verified_withdrawal_receipt();

create or replace function private.protect_ai_grading_withdrawal_registry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Verified withdrawal registry rows are immutable';
end;
$$;

revoke all on function private.protect_ai_grading_withdrawal_registry()
  from public, anon, authenticated, service_role;
create trigger protect_ai_grading_withdrawal_operator_keys
  before update or delete on public.ai_grading_withdrawal_operator_keys
  for each row execute function private.protect_ai_grading_withdrawal_registry();
create trigger protect_ai_grading_withdrawal_operator_key_revocations
  before update or delete on public.ai_grading_withdrawal_operator_key_revocations
  for each row execute function private.protect_ai_grading_withdrawal_registry();
create trigger protect_ai_grading_verified_withdrawal_receipts
  before update or delete on public.ai_grading_verified_withdrawal_receipts
  for each row execute function private.protect_ai_grading_withdrawal_registry();
create trigger protect_ai_grading_benchmark_withdrawals
  before update or delete on public.ai_grading_benchmark_withdrawals
  for each row execute function private.protect_ai_grading_withdrawal_registry();

-- A verified receipt has a maximum seven-day authorization window and is
-- bound to exactly one benchmark and request key. Successful retries remain
-- idempotent forever, but an expired, unconsumed receipt cannot be replayed.
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
  if p_benchmark_id is null or p_verified_receipt_id is null then
    raise exception 'Invalid benchmark withdrawal request';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ai-benchmark-withdrawal:' || p_benchmark_id::text, 0)
  );

  select * into v_existing
  from public.ai_grading_benchmark_withdrawals
  where benchmark_id = p_benchmark_id
  for update;
  if found then
    if v_existing.verified_receipt_id = p_verified_receipt_id then
      return true;
    end if;
    raise exception 'Immutable benchmark withdrawal differs';
  end if;

  select * into strict v_verified
  from public.ai_grading_verified_withdrawal_receipts
  where id = p_verified_receipt_id
    and benchmark_id = p_benchmark_id
  for update;
  if v_verified.verification_version <> 'signed_v2'
     or v_verified.expires_at <= pg_catalog.now() then
    raise exception 'Verified withdrawal receipt is not active';
  end if;
  if not exists (
    select 1
    from public.ai_grading_withdrawal_operator_keys operator_key
    where operator_key.id = v_verified.operator_key_id
      and pg_catalog.now() >= operator_key.valid_from
      and pg_catalog.now() < operator_key.expires_at
      and not exists (
        select 1
        from public.ai_grading_withdrawal_operator_key_revocations revocation
        where revocation.operator_key_id = operator_key.id
          and revocation.revoked_at <= pg_catalog.now()
      )
  ) then
    raise exception 'Withdrawal operator key is not active';
  end if;
  if not exists (
    select 1 from public.ai_grading_benchmarks
    where id = p_benchmark_id and is_active
    for update
  ) then
    raise exception 'Active benchmark not found';
  end if;

  insert into public.ai_grading_benchmark_withdrawals(
    benchmark_id,
    study_actor_key,
    actor_kind,
    reason_code,
    receipt_sha256,
    verified_receipt_id
  ) values (
    p_benchmark_id,
    v_verified.study_actor_key,
    v_verified.actor_kind,
    v_verified.reason_code,
    v_verified.receipt_sha256,
    v_verified.id
  );
  update public.ai_grading_benchmarks
  set is_active = false, updated_at = pg_catalog.now()
  where id = p_benchmark_id and is_active;
  if not found then
    raise exception 'Active benchmark was not withdrawn';
  end if;
  return true;
end;
$$;

revoke all on function public.withdraw_ai_grading_benchmark(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.withdraw_ai_grading_benchmark(uuid, uuid)
  to service_role;

-- Apply a whole signed refresh batch atomically. The function locks every
-- existing row in stable order and permits only the four intentionally
-- refreshable envelope fields to change. A stale file or partial batch fails
-- the transaction before it can roll current withdrawal evidence backwards.
create or replace function public.refresh_ai_grading_benchmark_release_attestations(
  p_attestations jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected_count integer;
  v_locked_count integer := 0;
  v_benchmark_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service-role attestation refresh required';
  end if;
  if jsonb_typeof(p_attestations) <> 'array' then
    raise exception 'Attestation refresh must be a JSON array';
  end if;
  v_expected_count := jsonb_array_length(p_attestations);
  if v_expected_count < 1 or v_expected_count > 100000 then
    raise exception 'Attestation refresh batch size is invalid';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_attestations) as incoming(benchmark_id uuid)
    group by incoming.benchmark_id
    having incoming.benchmark_id is null or count(*) <> 1
  ) then
    raise exception 'Attestation refresh benchmark IDs must be unique';
  end if;

  for v_benchmark_id in
    select current_attestation.benchmark_id
    from public.ai_grading_benchmark_release_attestations current_attestation
    join jsonb_to_recordset(p_attestations) as incoming(benchmark_id uuid)
      on incoming.benchmark_id = current_attestation.benchmark_id
    order by current_attestation.benchmark_id
    for update of current_attestation
  loop
    v_locked_count := v_locked_count + 1;
  end loop;
  if v_locked_count <> v_expected_count then
    raise exception 'Attestation refresh does not match existing release rows';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_attestations) as incoming(
      benchmark_id uuid,
      key_id text,
      envelope jsonb,
      signature_base64 text,
      verified_at timestamptz,
      expires_at timestamptz
    )
    join public.ai_grading_benchmark_release_attestations current_attestation
      on current_attestation.benchmark_id = incoming.benchmark_id
    join public.ai_grading_benchmarks benchmark
      on benchmark.id = incoming.benchmark_id
    where incoming.key_id is null
      or incoming.envelope is null
      or incoming.signature_base64 is null
      or incoming.verified_at is null
      or incoming.expires_at is null
      or incoming.envelope ->> 'benchmarkKey' <> benchmark.benchmark_key
      or incoming.verified_at <> (incoming.envelope ->> 'verifiedAt')::timestamptz
      or incoming.expires_at <> (incoming.envelope ->> 'expiresAt')::timestamptz
      or incoming.verified_at > pg_catalog.now()
      or incoming.expires_at <= pg_catalog.now()
      or incoming.verified_at < current_attestation.verified_at
      or (incoming.envelope ->> 'withdrawalCheckedAt')::timestamptz <
        (current_attestation.envelope ->> 'withdrawalCheckedAt')::timestamptz
      or (
        (incoming.envelope ->> 'withdrawalCheckedAt')::timestamptz =
          (current_attestation.envelope ->> 'withdrawalCheckedAt')::timestamptz
        and incoming.envelope ->> 'withdrawalRegistryReceiptSha256' <>
          current_attestation.envelope ->> 'withdrawalRegistryReceiptSha256'
      )
      or (
        incoming.verified_at = current_attestation.verified_at
        and (
          incoming.key_id <> current_attestation.key_id
          or incoming.envelope <> current_attestation.envelope
          or incoming.signature_base64 <> current_attestation.signature_base64
          or incoming.expires_at <> current_attestation.expires_at
        )
      )
      or (
        incoming.envelope
          - 'withdrawalRegistryReceiptSha256'
          - 'withdrawalCheckedAt'
          - 'verifiedAt'
          - 'expiresAt'
        <> current_attestation.envelope
          - 'withdrawalRegistryReceiptSha256'
          - 'withdrawalCheckedAt'
          - 'verifiedAt'
          - 'expiresAt'
      )
  ) then
    raise exception 'Attestation refresh is stale or changes immutable evidence';
  end if;

  insert into public.ai_grading_benchmark_release_attestations(
    benchmark_id,
    key_id,
    envelope,
    signature_base64,
    verified_at,
    expires_at,
    updated_at
  )
  select
    incoming.benchmark_id,
    incoming.key_id,
    incoming.envelope,
    incoming.signature_base64,
    incoming.verified_at,
    incoming.expires_at,
    pg_catalog.now()
  from jsonb_to_recordset(p_attestations) as incoming(
    benchmark_id uuid,
    key_id text,
    envelope jsonb,
    signature_base64 text,
    verified_at timestamptz,
    expires_at timestamptz
  )
  on conflict (benchmark_id) do update set
    key_id = excluded.key_id,
    envelope = excluded.envelope,
    signature_base64 = excluded.signature_base64,
    verified_at = excluded.verified_at,
    expires_at = excluded.expires_at,
    updated_at = excluded.updated_at;

  return v_expected_count;
end;
$$;

revoke all on function public.refresh_ai_grading_benchmark_release_attestations(jsonb)
  from public, anon, authenticated;
grant execute on function public.refresh_ai_grading_benchmark_release_attestations(jsonb)
  to service_role;

-- Initial import may insert an attestation, but every subsequent mutation must
-- pass through the monotonic refresh function above. Service role otherwise
-- bypasses RLS and could replay an older signed-but-still-valid envelope.
revoke update on public.ai_grading_benchmark_release_attestations
  from service_role;

commit;
