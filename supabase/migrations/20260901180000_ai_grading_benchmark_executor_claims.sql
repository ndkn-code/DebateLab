-- Atomic spend fencing and Vault-backed verification for the locked IELTS
-- evidence-adjudicated benchmark executor. This is a Cloud Run Job boundary;
-- it creates no HTTP or Vercel surface.

begin;

create or replace function private.protect_ai_grading_benchmark_bucket()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and old.id = 'ai-grading-benchmarks-private' then
    raise exception 'Protected benchmark bucket cannot be deleted';
  end if;
  if tg_op = 'UPDATE'
     and old.id = 'ai-grading-benchmarks-private'
     and (
       new.id is distinct from old.id
       or new.name is distinct from 'ai-grading-benchmarks-private'
       or new.public is distinct from false
     ) then
    raise exception 'Protected benchmark bucket identity/privacy is immutable';
  end if;
  if tg_op in ('INSERT', 'UPDATE')
     and new.id = 'ai-grading-benchmarks-private'
     and (
       new.name is distinct from 'ai-grading-benchmarks-private'
       or new.public is distinct from false
     ) then
    raise exception 'Protected benchmark bucket must remain private';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.protect_ai_grading_benchmark_bucket()
  from public, anon, authenticated;
drop trigger if exists protect_ai_grading_benchmark_bucket
  on storage.buckets;
create trigger protect_ai_grading_benchmark_bucket
  before insert or update or delete on storage.buckets
  for each row execute function private.protect_ai_grading_benchmark_bucket();

-- Protected response artifacts and raw Azure reports never share a learner-
-- accessible bucket. Storage remains service-role only: no anon/authenticated
-- object policy is created by this migration. DDL above intentionally precedes
-- this upsert because every migration runs as one transaction.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'ai-grading-benchmarks-private',
  'ai-grading-benchmarks-private',
  false,
  104857600,
  array[
    'application/json',
    'application/pdf',
    'audio/wav',
    'audio/x-wav',
    'image/jpeg',
    'image/png'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.ai_grading_benchmark_run_claims (
  benchmark_id uuid not null references public.ai_grading_benchmarks(id) on delete restrict,
  grader_version text not null,
  corpus_version integer not null check (corpus_version > 0),
  run_kind text not null check (run_kind in ('primary', 'repeat')),
  pipeline_stage text not null check (pipeline_stage in ('provisional', 'adjudicated')),
  status text not null check (status in (
    'reserved', 'provider_started', 'provider_succeeded', 'imported',
    'outcome_unknown', 'exhausted'
  )),
  claim_token uuid,
  lease_expires_at timestamptz,
  claim_attempt_count integer not null default 0 check (claim_attempt_count between 0 and 3),
  provider_request_id uuid references public.ai_provider_requests(id) on delete restrict,
  provisional_provider_request_id uuid references public.ai_provider_requests(id) on delete restrict,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (benchmark_id, grader_version, corpus_version, run_kind, pipeline_stage),
  check (pipeline_stage = 'adjudicated' or provisional_provider_request_id is null),
  check (grader_version = 'evidence-adjudicated-v1')
);

alter table public.ai_grading_benchmark_run_claims enable row level security;
revoke all on public.ai_grading_benchmark_run_claims
  from public, anon, authenticated, service_role;

-- Benchmark queries contain protected candidate responses. Application code
-- suppresses the preview, and this trigger makes the privacy boundary durable
-- even if a future caller forgets the sensitive flag.
create or replace function private.scrub_benchmark_knowledge_query_preview()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.source_route like 'gcp:ai-grading-worker/benchmark-executor%' then
    new.query_preview := null;
  end if;
  return new;
end;
$$;
revoke all on function private.scrub_benchmark_knowledge_query_preview()
  from public, anon, authenticated;
drop trigger if exists scrub_benchmark_knowledge_query_preview
  on public.ai_knowledge_retrieval_logs;
create trigger scrub_benchmark_knowledge_query_preview
  before insert or update on public.ai_knowledge_retrieval_logs
  for each row execute function private.scrub_benchmark_knowledge_query_preview();

-- Verify one provider audit against the executor-only Vault secret. The base
-- hash binds the protected artifact/current rubric; requestInputSha256 binds
-- the exact runtime request after version-pinned evidence is added.
create or replace function private.verify_ai_grading_benchmark_audit(
  p_benchmark_id uuid,
  p_grader_version text,
  p_corpus_version integer,
  p_run_kind text,
  p_pipeline_stage text,
  p_provider_request_id uuid
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_benchmark public.ai_grading_benchmarks%rowtype;
  v_request public.ai_provider_requests%rowtype;
  v_prediction jsonb;
  v_prediction_hash text;
  v_provisional_prediction jsonb;
  v_provisional_hash text;
  v_secret text;
  v_expected_signature text;
  v_expected_task text;
  v_provisional_id uuid;
begin
  if p_grader_version <> 'evidence-adjudicated-v1'
     or p_corpus_version < 1
     or p_run_kind not in ('primary', 'repeat')
     or p_pipeline_stage not in ('provisional', 'adjudicated') then
    raise exception 'Invalid locked benchmark audit identity';
  end if;
  select * into v_benchmark from public.ai_grading_benchmarks
    where id = p_benchmark_id and is_active = true for share;
  if not found then raise exception 'Active benchmark not found'; end if;
  select * into v_request from public.ai_provider_requests
    where id = p_provider_request_id for share;
  if not found then raise exception 'Benchmark provider request not found'; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets
    where name = 'ai_grading_benchmark_attestation_secret' limit 1;
  if coalesce(v_secret, '') = '' then
    raise exception 'Benchmark attestation secret unavailable';
  end if;

  v_prediction := v_request.metadata -> 'validatedOutputSnapshot';
  if jsonb_typeof(v_prediction) <> 'object' then
    raise exception 'Benchmark prediction audit is missing';
  end if;
  v_prediction_hash := encode(extensions.digest(
    convert_to(private.canonical_ai_grading_json(v_prediction), 'UTF8'),
    'sha256'
  ), 'hex');
  v_expected_task := case
    when v_benchmark.skill = 'ielts_speaking' and p_pipeline_stage = 'provisional'
      then 'ielts_speaking_score'
    when v_benchmark.skill = 'ielts_speaking'
      then 'ielts_speaking_adjudication'
    when v_benchmark.skill = 'ielts_writing' and p_pipeline_stage = 'provisional'
      then 'ielts_writing_score'
    when v_benchmark.skill = 'ielts_writing'
      then 'ielts_writing_adjudication'
    else null
  end;
  if v_expected_task is null then raise exception 'Unsupported benchmark skill'; end if;

  v_expected_signature := encode(extensions.hmac(
    convert_to(private.canonical_ai_grading_json(jsonb_build_object(
      'benchmarkKey', v_benchmark.benchmark_key,
      'graderVersion', p_grader_version,
      'corpusVersion', p_corpus_version,
      'evaluationRunKind', p_run_kind,
      'aiTask', v_expected_task,
      'provider', v_request.provider,
      'model', v_request.model,
      'benchmarkArtifactSha256', v_benchmark.protected_label #>> '{input,artifactSha256}',
      'benchmarkBaseInputSha256', v_benchmark.protected_label #>> '{input,modelInputSha256}',
      'benchmarkPipelineVersion', p_grader_version,
      'benchmarkPipelineStage', p_pipeline_stage,
      'benchmarkProvisionalRequestId',
        case when p_pipeline_stage = 'adjudicated'
          then v_request.metadata -> 'benchmarkProvisionalRequestId'
          else 'null'::jsonb end,
      'benchmarkProvisionalOutputSha256',
        case when p_pipeline_stage = 'adjudicated'
          then v_request.metadata -> 'benchmarkProvisionalOutputSha256'
          else 'null'::jsonb end,
      'benchmarkEvidenceSha256', v_request.metadata ->> 'benchmarkEvidenceSha256',
      'requestInputSha256', v_request.metadata ->> 'requestInputSha256',
      'validatedOutputSha256', v_prediction_hash
    )), 'UTF8'),
    convert_to(v_secret, 'UTF8'), 'sha256'
  ), 'hex');

  if v_request.status <> 'success'
     or coalesce(v_request.request_id, '') = ''
     or v_request.metadata ->> 'benchmarkEvaluationRun' is distinct from 'true'
     or v_request.metadata ->> 'benchmarkKey' is distinct from v_benchmark.benchmark_key
     or v_request.metadata ->> 'graderVersion' is distinct from p_grader_version
     or coalesce(v_request.metadata ->> 'corpusVersion', '') !~ '^[0-9]+$'
     or v_request.metadata ->> 'evaluationRunKind' is distinct from p_run_kind
     or v_request.metadata ->> 'benchmarkPipelineVersion' is distinct from p_grader_version
     or v_request.metadata ->> 'benchmarkPipelineStage' is distinct from p_pipeline_stage
     or v_request.metadata ->> 'benchmarkBaseInputSha256'
       is distinct from (v_benchmark.protected_label #>> '{input,modelInputSha256}')
     or v_request.metadata ->> 'benchmarkArtifactSha256'
       is distinct from (v_benchmark.protected_label #>> '{input,artifactSha256}')
     or coalesce(v_request.metadata ->> 'benchmarkEvidenceSha256', '') !~ '^[a-f0-9]{64}$'
     or coalesce(v_request.metadata ->> 'requestInputSha256', '') !~ '^[a-f0-9]{64}$'
     or v_request.metadata ->> 'validatedOutputSha256' is distinct from v_prediction_hash
     or v_request.metadata ->> 'benchmarkAttestationSignature' is distinct from v_expected_signature
     or v_request.metadata ->> 'aiTask' is distinct from v_expected_task then
    raise exception 'Benchmark provider audit HMAC verification failed';
  end if;
  -- Cast only after the lexical guard above. Keeping this separate prevents a
  -- malformed metadata value from being evaluated as an integer.
  if (v_request.metadata ->> 'corpusVersion')::integer
       is distinct from p_corpus_version then
    raise exception 'Benchmark provider audit corpus version mismatch';
  end if;

  if p_pipeline_stage = 'provisional' then
    if v_request.metadata -> 'benchmarkProvisionalRequestId' is distinct from 'null'::jsonb
       or v_request.metadata -> 'benchmarkProvisionalOutputSha256' is distinct from 'null'::jsonb then
      raise exception 'Provisional benchmark audit contains a forged parent';
    end if;
    return v_prediction;
  end if;

  begin
    v_provisional_id := (v_request.metadata ->> 'benchmarkProvisionalRequestId')::uuid;
  exception when others then
    raise exception 'Adjudication benchmark parent is invalid';
  end;
  v_provisional_prediction := private.verify_ai_grading_benchmark_audit(
    p_benchmark_id, p_grader_version, p_corpus_version, p_run_kind,
    'provisional', v_provisional_id
  );
  v_provisional_hash := encode(extensions.digest(
    convert_to(private.canonical_ai_grading_json(v_provisional_prediction), 'UTF8'),
    'sha256'
  ), 'hex');
  if v_request.metadata ->> 'benchmarkProvisionalOutputSha256'
       is distinct from v_provisional_hash then
    raise exception 'Adjudication benchmark parent output mismatch';
  end if;
  return v_prediction;
end;
$$;

revoke all on function private.verify_ai_grading_benchmark_audit(
  uuid, text, integer, text, text, uuid
) from public, anon, authenticated;

create or replace function public.verify_ai_grading_benchmark_provider_request(
  p_benchmark_id uuid,
  p_grader_version text,
  p_corpus_version integer,
  p_run_kind text,
  p_pipeline_stage text,
  p_provider_request_id uuid
)
returns table(prediction jsonb)
language sql security definer set search_path = ''
as $$
  select private.verify_ai_grading_benchmark_audit(
    p_benchmark_id, p_grader_version, p_corpus_version, p_run_kind,
    p_pipeline_stage, p_provider_request_id
  );
$$;

revoke all on function public.verify_ai_grading_benchmark_provider_request(
  uuid, text, integer, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.verify_ai_grading_benchmark_provider_request(
  uuid, text, integer, text, text, uuid
) to service_role;

-- The private importer/executor/release gate may verify a preprocessing-worker
-- attestation, but never receives the Vault key and therefore cannot mint one.
create or replace function public.verify_ai_grading_benchmark_acoustic_attestation(
  p_benchmark_key text,
  p_envelope jsonb,
  p_signature text
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_secret text;
  v_expected text;
begin
  if coalesce(p_benchmark_key, '') = ''
     or jsonb_typeof(p_envelope) <> 'object'
     or p_envelope ->> 'benchmarkKey' is distinct from p_benchmark_key
     or p_envelope ->> 'envelopeVersion' is distinct from '1'
     or coalesce(p_envelope ->> 'captureId', '')
       !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
     or p_envelope ->> 'provider' is distinct from 'azure'
     or p_envelope ->> 'model' is distinct from 'pronunciation-assessment'
     or p_envelope ->> 'apiVersion' is distinct from 'speech-sdk/1.51.0'
     or p_envelope ->> 'assessmentMode' is distinct from 'unscripted'
     or coalesce(p_envelope ->> 'audioObjectPath', '')
       not like 'ai-grading-benchmarks-private/%'
     or coalesce(p_envelope ->> 'reportObjectPath', '')
       not like 'ai-grading-benchmarks-private/%'
     or coalesce(p_envelope ->> 'audioArtifactSha256', '') !~ '^[a-f0-9]{64}$'
     or coalesce(p_envelope ->> 'transcriptSha256', '') !~ '^[a-f0-9]{64}$'
     or coalesce(p_envelope ->> 'configSha256', '') !~ '^[a-f0-9]{64}$'
     or coalesce(p_envelope ->> 'reportSha256', '') !~ '^[a-f0-9]{64}$'
     or coalesce(p_signature, '') !~ '^[a-f0-9]{64}$' then
    raise exception 'Benchmark acoustic attestation envelope is invalid';
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets
  where name = 'ai_grading_benchmark_attestation_secret' limit 1;
  if coalesce(v_secret, '') = '' then
    raise exception 'Benchmark attestation secret unavailable';
  end if;
  v_expected := encode(extensions.hmac(
    convert_to(private.canonical_ai_grading_json(p_envelope), 'UTF8'),
    convert_to(v_secret, 'UTF8'), 'sha256'
  ), 'hex');
  if p_signature is distinct from v_expected then
    raise exception 'Benchmark acoustic attestation HMAC verification failed';
  end if;
  return true;
end;
$$;

revoke all on function public.verify_ai_grading_benchmark_acoustic_attestation(
  text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.verify_ai_grading_benchmark_acoustic_attestation(
  text, jsonb, text
) to service_role;

create unique index if not exists ai_grading_benchmarks_active_report_path_uidx
  on public.ai_grading_benchmarks (
    (protected_label #>> '{input,audioPreprocessing,pronunciation,reportObjectPath}')
  ) where is_active = true and skill = 'ielts_speaking'
    and protected_label #>> '{input,audioPreprocessing,pronunciation,reportObjectPath}'
      is not null;
create unique index if not exists ai_grading_benchmarks_active_report_hash_uidx
  on public.ai_grading_benchmarks (
    (protected_label #>> '{input,audioPreprocessing,pronunciation,reportSha256}')
  ) where is_active = true and skill = 'ielts_speaking'
    and protected_label #>> '{input,audioPreprocessing,pronunciation,reportSha256}'
      is not null;
create unique index if not exists ai_grading_benchmarks_active_acoustic_envelope_uidx
  on public.ai_grading_benchmarks (
    (protected_label #> '{input,audioPreprocessing,acousticAttestation,envelope}')
  ) where is_active = true and skill = 'ielts_speaking'
    and protected_label #> '{input,audioPreprocessing,acousticAttestation,envelope}'
      is not null;

drop function if exists public.claim_ai_grading_benchmark_run(
  uuid, text, integer, text, text, integer
);
create function public.claim_ai_grading_benchmark_run(
  p_benchmark_id uuid,
  p_grader_version text,
  p_corpus_version integer,
  p_run_kind text,
  p_pipeline_stage text,
  p_lease_seconds integer default 1200
)
returns table(
  outcome text, claim_token uuid, provider_request_id uuid, claim_attempt integer
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_claim public.ai_grading_benchmark_run_claims%rowtype;
  v_token uuid := gen_random_uuid();
  v_lease integer := least(greatest(coalesce(p_lease_seconds, 1200), 60), 3600);
begin
  if p_grader_version <> 'evidence-adjudicated-v1'
     or p_corpus_version < 1 or p_run_kind not in ('primary', 'repeat')
     or p_pipeline_stage not in ('provisional', 'adjudicated')
     or not exists (select 1 from public.ai_grading_benchmarks
       where id = p_benchmark_id and is_active = true) then
    raise exception 'Invalid benchmark run claim';
  end if;
  insert into public.ai_grading_benchmark_run_claims(
    benchmark_id, grader_version, corpus_version, run_kind, pipeline_stage, status
  ) values (
    p_benchmark_id, p_grader_version, p_corpus_version, p_run_kind,
    p_pipeline_stage, 'reserved'
  ) on conflict do nothing;
  select * into v_claim from public.ai_grading_benchmark_run_claims
   where benchmark_id = p_benchmark_id
     and grader_version = p_grader_version
     and corpus_version = p_corpus_version
     and run_kind = p_run_kind and pipeline_stage = p_pipeline_stage for update;

  if v_claim.status = 'imported' then
    return query select 'imported', null::uuid, v_claim.provider_request_id,
      v_claim.claim_attempt_count;
    return;
  end if;
  if v_claim.status = 'provider_succeeded' then
    return query select 'provider_succeeded', null::uuid,
      v_claim.provider_request_id, v_claim.claim_attempt_count;
    return;
  end if;
  if v_claim.status in ('provider_started', 'outcome_unknown') then
    if v_claim.status = 'provider_started'
       and v_claim.lease_expires_at is not null
       and v_claim.lease_expires_at > now() then
      return query select 'lease_active', null::uuid, null::uuid,
        v_claim.claim_attempt_count;
    else
      update public.ai_grading_benchmark_run_claims set
        status = 'outcome_unknown', claim_token = null, lease_expires_at = null,
        last_error_code = 'PROVIDER_OUTCOME_UNKNOWN', updated_at = now()
      where benchmark_id = p_benchmark_id and grader_version = p_grader_version
        and corpus_version = p_corpus_version and run_kind = p_run_kind
        and pipeline_stage = p_pipeline_stage;
      return query select 'outcome_unknown', null::uuid,
        v_claim.provider_request_id, v_claim.claim_attempt_count;
    end if;
    return;
  end if;
  if v_claim.status = 'exhausted' or v_claim.claim_attempt_count >= 3 then
    update public.ai_grading_benchmark_run_claims set
      status = 'exhausted', claim_token = null, lease_expires_at = null,
      updated_at = now()
    where benchmark_id = p_benchmark_id and grader_version = p_grader_version
      and corpus_version = p_corpus_version and run_kind = p_run_kind
      and pipeline_stage = p_pipeline_stage;
    return query select 'exhausted', null::uuid, null::uuid,
      v_claim.claim_attempt_count;
    return;
  end if;
  if v_claim.claim_token is not null and v_claim.lease_expires_at > now() then
    return query select 'lease_active', null::uuid, null::uuid,
      v_claim.claim_attempt_count;
    return;
  end if;
  update public.ai_grading_benchmark_run_claims set
    status = 'reserved', claim_token = v_token,
    lease_expires_at = now() + make_interval(secs => v_lease),
    claim_attempt_count = claim_attempt_count + 1,
    last_error_code = null, updated_at = now()
  where benchmark_id = p_benchmark_id and grader_version = p_grader_version
    and corpus_version = p_corpus_version and run_kind = p_run_kind
    and pipeline_stage = p_pipeline_stage;
  return query select 'claimed', v_token, null::uuid,
    v_claim.claim_attempt_count + 1;
end;
$$;

revoke all on function public.claim_ai_grading_benchmark_run(
  uuid, text, integer, text, text, integer
) from public, anon, authenticated;
grant execute on function public.claim_ai_grading_benchmark_run(
  uuid, text, integer, text, text, integer
) to service_role;

create or replace function public.start_ai_grading_benchmark_provider(
  p_benchmark_id uuid, p_grader_version text, p_corpus_version integer,
  p_run_kind text, p_pipeline_stage text, p_claim_token uuid
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  update public.ai_grading_benchmark_run_claims set
    status = 'provider_started', updated_at = now()
  where benchmark_id = p_benchmark_id and grader_version = p_grader_version
    and corpus_version = p_corpus_version and run_kind = p_run_kind
    and pipeline_stage = p_pipeline_stage
    and status = 'reserved' and claim_token = p_claim_token
    and lease_expires_at > now();
  if not found then raise exception 'Benchmark provider claim lost'; end if;
  return true;
end;
$$;

revoke all on function public.start_ai_grading_benchmark_provider(
  uuid, text, integer, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.start_ai_grading_benchmark_provider(
  uuid, text, integer, text, text, uuid
) to service_role;

-- A stage may be retried only when every paid attempt has a persisted audit
-- proving that the provider definitely answered (or that returned output was
-- definitely schema-invalid). Transport loss/deadline ambiguity never calls
-- this function and therefore ages from provider_started to outcome_unknown.
create or replace function public.fail_ai_grading_benchmark_provider(
  p_benchmark_id uuid, p_grader_version text, p_corpus_version integer,
  p_run_kind text, p_pipeline_stage text, p_claim_token uuid,
  p_provider_request_ids uuid[]
)
returns table(outcome text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_claim public.ai_grading_benchmark_run_claims%rowtype;
  v_request public.ai_provider_requests%rowtype;
  v_request_id uuid;
  v_expected_task text;
  v_benchmark_key text;
  v_benchmark public.ai_grading_benchmarks%rowtype;
  v_secret text;
  v_expected_signature text;
begin
  if p_provider_request_ids is null
     or cardinality(p_provider_request_ids) < 1
     or cardinality(p_provider_request_ids) > 8
     or (select count(distinct request_id)
         from unnest(p_provider_request_ids) as ids(request_id))
        <> cardinality(p_provider_request_ids) then
    raise exception 'Definite benchmark failure audit list is invalid';
  end if;
  select * into v_claim
  from public.ai_grading_benchmark_run_claims
  where benchmark_id = p_benchmark_id
    and grader_version = p_grader_version
    and corpus_version = p_corpus_version
    and run_kind = p_run_kind
    and pipeline_stage = p_pipeline_stage
  for update;
  if not found
     or v_claim.status <> 'provider_started'
     or v_claim.claim_token is distinct from p_claim_token then
    raise exception 'Benchmark provider claim lost';
  end if;
  select * into v_benchmark from public.ai_grading_benchmarks
  where id = p_benchmark_id and is_active = true for share;
  if not found then
    raise exception 'Active benchmark scoring identity unavailable';
  end if;
  v_benchmark_key := v_benchmark.benchmark_key;
  v_expected_task := case
    when v_benchmark.skill = 'ielts_speaking' and p_pipeline_stage = 'provisional'
      then 'ielts_speaking_score'
    when v_benchmark.skill = 'ielts_speaking'
      then 'ielts_speaking_adjudication'
    when v_benchmark.skill = 'ielts_writing' and p_pipeline_stage = 'provisional'
      then 'ielts_writing_score'
    when v_benchmark.skill = 'ielts_writing'
      then 'ielts_writing_adjudication'
    else null
  end;
  if v_expected_task is null then
    raise exception 'Active benchmark scoring identity unavailable';
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets
  where name = 'ai_grading_benchmark_attestation_secret' limit 1;
  if coalesce(v_secret, '') = '' then
    raise exception 'Benchmark attestation secret unavailable';
  end if;

  foreach v_request_id in array p_provider_request_ids loop
    select * into v_request from public.ai_provider_requests
    where id = v_request_id for share;
    if not found
       or v_request.status <> 'error'
       or v_request.metadata ->> 'benchmarkEvaluationRun' is distinct from 'true'
       or v_request.metadata ->> 'benchmarkKey' is distinct from v_benchmark_key
       or v_request.metadata ->> 'graderVersion' is distinct from p_grader_version
       or coalesce(v_request.metadata ->> 'corpusVersion', '') !~ '^[0-9]+$'
       or v_request.metadata ->> 'evaluationRunKind' is distinct from p_run_kind
       or v_request.metadata ->> 'benchmarkPipelineVersion'
         is distinct from p_grader_version
       or v_request.metadata ->> 'benchmarkPipelineStage'
         is distinct from p_pipeline_stage
       or v_request.metadata ->> 'benchmarkArtifactSha256'
         is distinct from (v_benchmark.protected_label #>> '{input,artifactSha256}')
       or v_request.metadata ->> 'benchmarkBaseInputSha256'
         is distinct from (v_benchmark.protected_label #>> '{input,modelInputSha256}')
       or coalesce(v_request.metadata ->> 'benchmarkEvidenceSha256', '')
         !~ '^[a-f0-9]{64}$'
       or v_request.metadata ->> 'benchmarkClaimToken'
         is distinct from p_claim_token::text
       or v_request.metadata ->> 'benchmarkClaimAttempt'
         is distinct from v_claim.claim_attempt_count::text
       or v_request.metadata ->> 'aiTask' is distinct from v_expected_task
       or coalesce(v_request.source_route, '') not like
         'gcp:ai-grading-worker/benchmark-executor%'
       or not (
         v_request.response_status is not null
         or coalesce(v_request.error_code, '') = 'schema_invalid'
       )
       or coalesce(v_request.metadata ->> 'requestInputSha256', '')
         !~ '^[a-f0-9]{64}$' then
      raise exception 'Benchmark definite-failure audit verification failed';
    end if;
    if (v_request.metadata ->> 'corpusVersion')::integer
         is distinct from p_corpus_version then
      raise exception 'Benchmark definite-failure corpus version mismatch';
    end if;
    v_expected_signature := encode(extensions.hmac(
      convert_to(private.canonical_ai_grading_json(jsonb_build_object(
        'benchmarkKey', v_benchmark_key,
        'graderVersion', p_grader_version,
        'corpusVersion', p_corpus_version,
        'evaluationRunKind', p_run_kind,
        'aiTask', v_expected_task,
        'provider', v_request.provider,
        'model', v_request.model,
        'benchmarkArtifactSha256',
          v_benchmark.protected_label #>> '{input,artifactSha256}',
        'benchmarkBaseInputSha256',
          v_benchmark.protected_label #>> '{input,modelInputSha256}',
        'benchmarkEvidenceSha256',
          v_request.metadata ->> 'benchmarkEvidenceSha256',
        'benchmarkPipelineVersion', p_grader_version,
        'benchmarkPipelineStage', p_pipeline_stage,
        'benchmarkClaimToken', p_claim_token,
        'benchmarkClaimAttempt', v_claim.claim_attempt_count,
        'responseStatus', v_request.response_status,
        'failureKind', v_request.error_code,
        'requestInputSha256', v_request.metadata ->> 'requestInputSha256'
      )), 'UTF8'),
      convert_to(v_secret, 'UTF8'), 'sha256'
    ), 'hex');
    if v_request.metadata ->> 'benchmarkFailureAttestationSignature'
         is distinct from v_expected_signature then
      raise exception 'Benchmark failure audit HMAC verification failed';
    end if;
  end loop;

  if v_claim.claim_attempt_count >= 3 then
    update public.ai_grading_benchmark_run_claims set
      status = 'exhausted', claim_token = null, lease_expires_at = null,
      last_error_code = 'DEFINITE_PROVIDER_FAILURE_EXHAUSTED',
      updated_at = now()
    where benchmark_id = p_benchmark_id and grader_version = p_grader_version
      and corpus_version = p_corpus_version and run_kind = p_run_kind
      and pipeline_stage = p_pipeline_stage and claim_token = p_claim_token;
    return query select 'exhausted'::text;
  else
    update public.ai_grading_benchmark_run_claims set
      status = 'reserved', claim_token = null, lease_expires_at = null,
      last_error_code = 'DEFINITE_PROVIDER_FAILURE_RETRYABLE',
      updated_at = now()
    where benchmark_id = p_benchmark_id and grader_version = p_grader_version
      and corpus_version = p_corpus_version and run_kind = p_run_kind
      and pipeline_stage = p_pipeline_stage and claim_token = p_claim_token;
    return query select 'retryable'::text;
  end if;
end;
$$;

revoke all on function public.fail_ai_grading_benchmark_provider(
  uuid, text, integer, text, text, uuid, uuid[]
) from public, anon, authenticated;
grant execute on function public.fail_ai_grading_benchmark_provider(
  uuid, text, integer, text, text, uuid, uuid[]
) to service_role;

create or replace function public.complete_ai_grading_benchmark_provider(
  p_benchmark_id uuid, p_grader_version text, p_corpus_version integer,
  p_run_kind text, p_pipeline_stage text, p_claim_token uuid,
  p_provider_request_id uuid
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_provisional_id uuid;
begin
  perform private.verify_ai_grading_benchmark_audit(
    p_benchmark_id, p_grader_version, p_corpus_version, p_run_kind,
    p_pipeline_stage, p_provider_request_id
  );
  if p_pipeline_stage = 'adjudicated' then
    select (metadata ->> 'benchmarkProvisionalRequestId')::uuid
      into v_provisional_id
    from public.ai_provider_requests where id = p_provider_request_id;
    if not exists (
      select 1 from public.ai_grading_benchmark_run_claims
      where benchmark_id = p_benchmark_id and grader_version = p_grader_version
        and corpus_version = p_corpus_version and run_kind = p_run_kind
        and pipeline_stage = 'provisional'
        and status in ('provider_succeeded', 'imported')
        and provider_request_id = v_provisional_id
    ) then
      raise exception 'Verified provisional benchmark stage is not checkpointed';
    end if;
  end if;
  update public.ai_grading_benchmark_run_claims set
    status = 'provider_succeeded', provider_request_id = p_provider_request_id,
    provisional_provider_request_id = v_provisional_id,
    claim_token = null, lease_expires_at = null, updated_at = now()
  where benchmark_id = p_benchmark_id and grader_version = p_grader_version
    and corpus_version = p_corpus_version and run_kind = p_run_kind
    and pipeline_stage = p_pipeline_stage
    and status = 'provider_started' and claim_token = p_claim_token;
  if not found then raise exception 'Benchmark provider claim lost'; end if;
  return true;
end;
$$;

revoke all on function public.complete_ai_grading_benchmark_provider(
  uuid, text, integer, text, text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.complete_ai_grading_benchmark_provider(
  uuid, text, integer, text, text, uuid, uuid
) to service_role;

create or replace function public.recover_ai_grading_benchmark_provider(
  p_benchmark_id uuid, p_grader_version text, p_corpus_version integer,
  p_run_kind text, p_pipeline_stage text, p_provider_request_id uuid
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_existing public.ai_grading_benchmark_run_claims%rowtype;
  v_provisional_id uuid;
begin
  perform private.verify_ai_grading_benchmark_audit(
    p_benchmark_id, p_grader_version, p_corpus_version, p_run_kind,
    p_pipeline_stage, p_provider_request_id
  );
  if p_pipeline_stage = 'adjudicated' then
    select (metadata ->> 'benchmarkProvisionalRequestId')::uuid
      into v_provisional_id
    from public.ai_provider_requests where id = p_provider_request_id;
    perform public.recover_ai_grading_benchmark_provider(
      p_benchmark_id, p_grader_version, p_corpus_version, p_run_kind,
      'provisional', v_provisional_id
    );
  end if;
  select * into v_existing
  from public.ai_grading_benchmark_run_claims
  where benchmark_id = p_benchmark_id
    and grader_version = p_grader_version
    and corpus_version = p_corpus_version
    and run_kind = p_run_kind and pipeline_stage = p_pipeline_stage
  for update;
  if found and v_existing.provider_request_id is not null
     and v_existing.provider_request_id is distinct from p_provider_request_id then
    raise exception 'Reserved benchmark provider differs';
  end if;
  if found and v_existing.status = 'imported' then
    return true;
  end if;
  insert into public.ai_grading_benchmark_run_claims(
    benchmark_id, grader_version, corpus_version, run_kind, pipeline_stage,
    status, provider_request_id, provisional_provider_request_id,
    claim_attempt_count
  ) values (
    p_benchmark_id, p_grader_version, p_corpus_version, p_run_kind,
    p_pipeline_stage, 'provider_succeeded', p_provider_request_id,
    v_provisional_id, 1
  ) on conflict (benchmark_id, grader_version, corpus_version, run_kind, pipeline_stage)
  do update set status = 'provider_succeeded',
    provider_request_id = excluded.provider_request_id,
    provisional_provider_request_id = excluded.provisional_provider_request_id,
    claim_token = null, lease_expires_at = null, updated_at = now();
  return true;
end;
$$;

revoke all on function public.recover_ai_grading_benchmark_provider(
  uuid, text, integer, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.recover_ai_grading_benchmark_provider(
  uuid, text, integer, text, text, uuid
) to service_role;

create or replace function public.import_ai_grading_benchmark_provider(
  p_benchmark_id uuid, p_grader_version text, p_corpus_version integer,
  p_run_kind text, p_provider_request_id uuid
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  perform private.verify_ai_grading_benchmark_audit(
    p_benchmark_id, p_grader_version, p_corpus_version, p_run_kind,
    'adjudicated', p_provider_request_id
  );
  update public.ai_grading_benchmark_run_claims set
    status = 'imported', updated_at = now()
  where benchmark_id = p_benchmark_id and grader_version = p_grader_version
    and corpus_version = p_corpus_version and run_kind = p_run_kind
    and pipeline_stage = 'adjudicated'
    and status in ('provider_succeeded', 'imported')
    and provider_request_id = p_provider_request_id;
  if not found then raise exception 'Benchmark provider result was not reserved'; end if;
  update public.ai_grading_benchmark_run_claims provisional set
    status = 'imported', updated_at = now()
  from public.ai_grading_benchmark_run_claims final
  where final.benchmark_id = p_benchmark_id
    and final.grader_version = p_grader_version
    and final.corpus_version = p_corpus_version
    and final.run_kind = p_run_kind
    and final.pipeline_stage = 'adjudicated'
    and final.provider_request_id = p_provider_request_id
    and provisional.benchmark_id = final.benchmark_id
    and provisional.grader_version = final.grader_version
    and provisional.corpus_version = final.corpus_version
    and provisional.run_kind = final.run_kind
    and provisional.pipeline_stage = 'provisional'
    and provisional.provider_request_id = final.provisional_provider_request_id
    and provisional.status in ('provider_succeeded', 'imported');
  if not found then raise exception 'Provisional benchmark link was not reserved'; end if;
  return true;
end;
$$;

revoke all on function public.import_ai_grading_benchmark_provider(
  uuid, text, integer, text, uuid
) from public, anon, authenticated;
grant execute on function public.import_ai_grading_benchmark_provider(
  uuid, text, integer, text, uuid
) to service_role;

create or replace function private.prevent_benchmark_claim_link_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.provider_request_id is not null then
      raise exception 'Linked benchmark stage claim is immutable';
    end if;
    return old;
  end if;
  if old.provider_request_id is not null and (
    new.provider_request_id is distinct from old.provider_request_id
    or new.provisional_provider_request_id
      is distinct from old.provisional_provider_request_id
    or new.benchmark_id is distinct from old.benchmark_id
    or new.grader_version is distinct from old.grader_version
    or new.corpus_version is distinct from old.corpus_version
    or new.run_kind is distinct from old.run_kind
    or new.pipeline_stage is distinct from old.pipeline_stage
  ) then
    raise exception 'Linked benchmark stage claim is immutable';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_benchmark_claim_link_mutation()
  from public, anon, authenticated;
drop trigger if exists benchmark_claim_links_immutable
  on public.ai_grading_benchmark_run_claims;
create trigger benchmark_claim_links_immutable
  before update or delete on public.ai_grading_benchmark_run_claims
  for each row execute function private.prevent_benchmark_claim_link_mutation();

-- Extend the existing release-proof trigger to the provisional audit linked
-- through stage claims, not only the final audit linked by evaluation_runs.
create or replace function private.prevent_benchmark_provider_request_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if exists (
    select 1 from public.ai_grading_evaluation_runs run
    where run.provider_request_id = old.id
  ) or exists (
    select 1 from public.ai_grading_benchmark_run_claims claim
    where claim.provider_request_id = old.id
       or claim.provisional_provider_request_id = old.id
  ) then
    raise exception 'Benchmark provider request audit is immutable';
  end if;
  return old;
end;
$$;
revoke all on function private.prevent_benchmark_provider_request_mutation()
  from public, anon, authenticated;

-- Only a verified final adjudication audit can become immutable evaluation
-- evidence. Arbitrary grader versions and provisional scorer outputs fail.
create or replace function public.record_ai_grading_evaluation_run(
  p_evaluation_id uuid,
  p_run_kind text,
  p_prediction jsonb,
  p_provider_request_id uuid
)
returns public.ai_grading_evaluation_runs
language plpgsql security definer set search_path = ''
as $$
declare
  v_evaluation public.ai_grading_evaluations%rowtype;
  v_request public.ai_provider_requests%rowtype;
  v_verified jsonb;
  v_result public.ai_grading_evaluation_runs%rowtype;
begin
  select * into v_evaluation from public.ai_grading_evaluations
    where id = p_evaluation_id for share;
  if not found or v_evaluation.grader_version <> 'evidence-adjudicated-v1' then
    raise exception 'Locked benchmark evaluation not found';
  end if;
  v_verified := private.verify_ai_grading_benchmark_audit(
    v_evaluation.benchmark_id, v_evaluation.grader_version,
    v_evaluation.corpus_version, p_run_kind, 'adjudicated',
    p_provider_request_id
  );
  if v_verified is distinct from p_prediction then
    raise exception 'Verified benchmark prediction differs';
  end if;
  if not exists (
    select 1
    from public.ai_grading_benchmark_run_claims final
    join public.ai_grading_benchmark_run_claims provisional
      on provisional.benchmark_id = final.benchmark_id
     and provisional.grader_version = final.grader_version
     and provisional.corpus_version = final.corpus_version
     and provisional.run_kind = final.run_kind
     and provisional.pipeline_stage = 'provisional'
     and provisional.provider_request_id = final.provisional_provider_request_id
    where final.benchmark_id = v_evaluation.benchmark_id
      and final.grader_version = v_evaluation.grader_version
      and final.corpus_version = v_evaluation.corpus_version
      and final.run_kind = p_run_kind
      and final.pipeline_stage = 'adjudicated'
      and final.provider_request_id = p_provider_request_id
      and final.status in ('provider_succeeded', 'imported')
      and provisional.status in ('provider_succeeded', 'imported')
  ) then
    raise exception 'Benchmark provisional/final release proof is incomplete';
  end if;
  select * into v_request from public.ai_provider_requests
    where id = p_provider_request_id for share;
  insert into public.ai_grading_evaluation_runs(
    evaluation_id, run_kind, prediction, provider, model,
    provider_request_id, trace_id, started_at, completed_at
  ) values (
    p_evaluation_id, p_run_kind, p_prediction, v_request.provider,
    v_request.model, v_request.id, v_request.request_id,
    v_request.created_at - greatest(coalesce(v_request.latency_ms, 0), 1)
      * interval '1 millisecond',
    v_request.created_at
  ) on conflict (evaluation_id, run_kind) do nothing
  returning * into v_result;
  if not found then
    select * into v_result from public.ai_grading_evaluation_runs
      where evaluation_id = p_evaluation_id and run_kind = p_run_kind;
    if v_result.provider_request_id <> p_provider_request_id
       or v_result.prediction <> p_prediction then
      raise exception 'Immutable benchmark run differs';
    end if;
  end if;
  return v_result;
end;
$$;

revoke all on function public.record_ai_grading_evaluation_run(
  uuid, text, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.record_ai_grading_evaluation_run(
  uuid, text, jsonb, uuid
) to service_role;

commit;
