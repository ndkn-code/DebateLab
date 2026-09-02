import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createProductionOperations } from "./operations";

const root = resolve(process.cwd(), "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("AI grading has no Vercel Workflow or grading trigger surface", () => {
  const webPackage = JSON.parse(read("apps/web/package.json")) as {
    dependencies: Record<string, string>;
  };
  const vercel = read("apps/web/vercel.json");
  assert.equal(webPackage.dependencies.workflow, undefined);
  assert.doesNotMatch(
    vercel,
    /practice-analysis|ielts-writing-analysis|ielts-speaking-analysis|ai-workflow-reconcile/,
  );
  assert.throws(() =>
    read("apps/web/src/app/api/cron/ai-workflow-reconcile/route.ts"),
  );
  assert.throws(() =>
    read("apps/web/src/app/api/queues/practice-analysis/route.ts"),
  );
  assert.throws(() =>
    read("apps/web/src/app/api/queues/ielts-writing/route.ts"),
  );
  assert.throws(() =>
    read("apps/web/src/app/api/queues/ielts-speaking/route.ts"),
  );
});
test("the GCP migration fences claims, checkpoints, retries, and private grants", () => {
  const migration = read(
    "supabase/migrations/20260830160000_ai_grading_gcp_runtime.sql",
  );
  assert.match(migration, /worker_claim_token = v_claim/);
  assert.match(migration, /workflow_attempt_count >= 3/);
  assert.match(migration, /AI_GRADING_OUTPUT_CONFLICT/);
  assert.match(migration, /PROVIDER_OUTCOME_UNKNOWN/);
  assert.match(
    migration,
    /revoke all on public\.ai_grading_checkpoints from public, anon, authenticated/,
  );
  assert.match(migration, /to service_role/);
});

test("the retry-consistency migration distinguishes definite failures and atomically closes terminal sources", () => {
  const migration = read(
    "supabase/migrations/20260901130000_ai_grading_retry_consistency.sql",
  );
  assert.match(
    migration,
    /checkpoint_ai_grading_provider_failure\(\s*p_run_id uuid,/,
  );
  assert.match(migration, /last_provider_failure_claim_token = p_claim_token/);
  assert.match(
    migration,
    /when v_requested_retryable and v_run\.workflow_attempt_count >= 3\s+then 'RETRYABLE_WORKFLOW_FAILED'/,
  );
  assert.match(
    migration,
    /run\.status in \('starting', 'running', 'core_completed'\)/,
  );
  assert.match(
    migration,
    /run\.lease_expires_at is null or run\.lease_expires_at <= now\(\)/,
  );
  assert.match(
    migration,
    /update public\.speaking_responses set\s+status = \(\s*case when v_retryable then 'pending' else 'failed' end\s*\)::public\.ielts_response_status/,
  );
  assert.match(
    migration,
    /update public\.writing_responses set\s+status = \(\s*case when v_retryable then 'pending' else 'failed' end\s*\)::public\.ielts_response_status/,
  );
  assert.match(
    migration,
    /revoke all on function public\.checkpoint_ai_grading_provider_failure\(uuid, uuid, text\)\s+from public, anon, authenticated/,
  );
});

test("benchmark labels and release slices remain immutable", () => {
  const migration = read(
    "supabase/migrations/20260901140000_lock_ai_grading_benchmark_metadata.sql",
  );
  assert.match(
    migration,
    /new\.protected_label is distinct from old\.protected_label/,
  );
  assert.match(migration, /new\.metadata is distinct from old\.metadata/);
  assert.match(
    migration,
    /new\.accent_group is distinct from old\.accent_group/,
  );
  assert.match(migration, /create a new benchmark_key/);
  assert.match(migration, /prevent_active_benchmark_source_mutation/);
  assert.match(migration, /benchmark\.is_active = true/);
});

test("the third automatic attempt is recovered or terminalized without another provider call", () => {
  const migration = read(
    "supabase/migrations/20260901150000_ai_grading_third_attempt_recovery.sql",
  );
  assert.match(migration, /phase = 'checkpoint_recovery'/);
  assert.match(migration, /v_checkpoint\.output_payload is not null/);
  assert.match(
    migration,
    /return query select 'claimed', v_claim, v_run\.workflow_attempt_count/,
  );
  assert.match(migration, /phase = 'exhaustion_recovery'/);
  assert.match(migration, /perform public\.fail_ai_grading_delivery/);
  assert.match(migration, /run\.workflow_attempt_count = 3/);
  assert.match(migration, /run\.status in \('running', 'core_completed'\)/);
});

test("completed redelivery is observed before returning without a new claim", () => {
  const migration = read(
    "supabase/migrations/20260902090000_ai_grading_completed_redelivery_observation.sql",
  );
  const completedBranch = migration.match(
    /if v_run\.status = 'completed' then([\s\S]*?)end if;/,
  )?.[1];
  assert.ok(completedBranch);
  assert.match(
    completedBranch,
    /update public\.ai_workflow_runs set[\s\S]*last_delivery_id = p_delivery_id,[\s\S]*last_delivery_attempt = p_delivery_attempt,[\s\S]*updated_at = now\(\)/,
  );
  assert.match(completedBranch, /and status = 'completed'/);
  assert.match(
    completedBranch,
    /p_delivery_attempt > coalesce\(last_delivery_attempt, 0\)/,
  );
  assert.ok(
    completedBranch.indexOf("update public.ai_workflow_runs") <
      completedBranch.indexOf("return query select 'completed'"),
  );
  assert.doesNotMatch(
    completedBranch,
    /worker_claim_token\s*=|reserve_ai_grading_provider|provider_attempt_count\s*=/,
  );
  assert.doesNotMatch(completedBranch, /workflow_attempt_count\s*=/);
});

test("operational simulation is bound to an immutable DB marker and counts only fenced boundaries", () => {
  const migration = read(
    "supabase/migrations/20260902090000_ai_grading_completed_redelivery_observation.sql",
  );
  assert.match(migration, /private\.ai_grading_environment_marker/);
  assert.match(migration, /before update or delete on private\.ai_grading_environment_marker/);
  assert.match(migration, /ai_grading_environment_bootstrap_secret/);
  assert.match(migration, /get_ai_grading_environment_marker/);
  assert.match(migration, /record_ai_grading_operational_boundary_attempt/);
  assert.match(migration, /v_marker\.environment not in \('preview', 'staging'\)/);
  assert.match(migration, /v_run\.worker_claim_token is distinct from p_claim_token/);
  assert.match(migration, /injection_token = p_injection_token/);
  assert.match(migration, /v_claim\.scenario not in \('provider_timeout', 'retry_exhaustion'\)/);
  assert.match(migration, /v_checkpoint\.provider_claim_token is distinct from p_claim_token/);
  assert.match(migration, /unique \(workflow_run_id, worker_claim_token\)/);
  const insertAt = migration.indexOf(
    "insert into private.ai_grading_operational_boundary_attempts",
  );
  const incrementAt = migration.indexOf(
    "provider_attempt_count = provider_attempt_count + 1",
  );
  assert.ok(insertAt >= 0 && incrementAt > insertAt);
  assert.match(
    migration,
    /revoke all on private\.ai_grading_operational_boundary_attempts[\s\S]*service_role/,
  );
});

test("the operations CLI re-reads protected state after RPC success", () => {
  const cli = read(
    "services/ai-grading-worker/src/operational-evidence-cli.ts",
  );
  assert.match(cli, /get_ai_grading_environment_marker/);
  assert.match(cli, /recover operational evidence/);
  assert.match(cli, /recover operational scenario declaration/);
  assert.match(cli, /recover finalized operational scenario/);
  assert.match(cli, /recover sealed operational evidence/);
  assert.doesNotMatch(cli, /delete\(|\.delete\(|remove\(/);
});

test("release safety evidence is immutable and linked to real workflow runs", () => {
  const migration = read(
    "supabase/migrations/20260901160000_ai_grading_operational_evidence.sql",
  );
  assert.match(
    migration,
    /workflow_run_id uuid not null references public\.ai_workflow_runs\(id\)/,
  );
  assert.match(migration, /'duplicate_delivery'/);
  assert.match(migration, /'provider_timeout'/);
  assert.match(migration, /'retry_exhaustion'/);
  assert.match(migration, /before update or delete/);
  assert.match(migration, /v_run\.provider_attempt_count/);
  assert.match(migration, /begin_ai_grading_operational_evidence/);
  assert.match(migration, /declare_ai_grading_operational_scenario/);
  assert.match(migration, /finalize_ai_grading_operational_scenario/);
  assert.match(migration, /operationalCalibration/);
  assert.match(migration, /v_checkpoint\.provider_failure_count = 3/);
  assert.match(
    migration,
    /grant select on public\.ai_grading_operational_scenarios to service_role/,
  );
  assert.match(
    migration,
    /revoke all on public\.ai_grading_operational_evidence from public, anon, authenticated/,
  );
});

test("release proof uses worker-authored runtime transitions and immutable reruns", () => {
  const migration = read(
    "supabase/migrations/20260901170000_ai_grading_release_attestation.sql",
  );
  assert.match(migration, /attest_ai_grading_runtime/);
  assert.match(migration, /runtime_revision/);
  assert.match(migration, /image_digest/);
  assert.match(migration, /record_ai_grading_operational_transition/);
  assert.match(migration, /v_first_output_at < v_second_claim_at/);
  assert.match(migration, /ai_grading_evaluation_runs/);
  assert.match(migration, /provider_request_id uuid not null unique/);
  assert.match(migration, /references public\.ai_provider_requests/);
  assert.match(migration, /record_ai_grading_evaluation_run/);
  assert.match(migration, /validatedOutputSnapshot/);
  assert.match(migration, /requestInputSha256/);
  assert.match(migration, /canonical_ai_grading_json/);
  assert.match(migration, /is distinct from/);
  assert.match(migration, /evidence-adjudicated-v1' then 2/);
  assert.match(migration, /Benchmark provider request audit is immutable/);
  assert.match(migration, /benchmarkAttestationSignature/);
  assert.match(migration, /ai_grading_benchmark_attestation_secret/);
  assert.match(migration, /Linked AI grading evaluation identity is immutable/);
  assert.match(migration, /before update or delete/);
});

test("operational runtime identity fails closed without a real revision and digest", () => {
  const previousRevision = process.env.K_REVISION;
  const previousDigest = process.env.AI_GRADING_IMAGE_DIGEST;
  const operations = createProductionOperations();
  const job = {
    schemaVersion: 1 as const,
    kind: "ielts_writing_score" as const,
    sourceId: "00000000-0000-4000-8000-000000000001",
    workflowRunId: "00000000-0000-4000-8000-000000000002",
  };
  try {
    delete process.env.K_REVISION;
    delete process.env.AI_GRADING_IMAGE_DIGEST;
    assert.throws(
      () => operations.runtimeIdentity?.(job, { baseCorpusVersion: 1 }),
      /K_REVISION/,
    );
    process.env.K_REVISION = "ai-grading-worker-00001-abc";
    process.env.AI_GRADING_IMAGE_DIGEST = "unknown";
    assert.throws(
      () => operations.runtimeIdentity?.(job, { baseCorpusVersion: 1 }),
      /SHA-256 digest/,
    );
    process.env.AI_GRADING_IMAGE_DIGEST = `sha256:${"a".repeat(64)}`;
    assert.equal(
      operations.runtimeIdentity?.(job, { baseCorpusVersion: 1 }).imageDigest,
      process.env.AI_GRADING_IMAGE_DIGEST,
    );
  } finally {
    if (previousRevision === undefined) delete process.env.K_REVISION;
    else process.env.K_REVISION = previousRevision;
    if (previousDigest === undefined)
      delete process.env.AI_GRADING_IMAGE_DIGEST;
    else process.env.AI_GRADING_IMAGE_DIGEST = previousDigest;
  }
});

test("the offline benchmark uses a Vault-verified atomic spend fence", () => {
  const migration = read(
    "supabase/migrations/20260901180000_ai_grading_benchmark_executor_claims.sql",
  );
  const executor = read("services/ai-grading-worker/src/benchmark-executor.ts");
  const coreExecute = read("apps/web/src/lib/ai/core/execute.ts");
  const workerPackage = JSON.parse(
    read("services/ai-grading-worker/package.json"),
  ) as { scripts: Record<string, string> };
  assert.match(migration, /ai_grading_benchmark_run_claims/);
  assert.match(
    migration,
    /'ai-grading-benchmarks-private',[\s\S]*false,[\s\S]*104857600/,
  );
  assert.match(migration, /protect_ai_grading_benchmark_bucket/);
  assert.match(migration, /Protected benchmark bucket cannot be deleted/);
  assert.match(
    migration,
    /new\.public is distinct from false/,
  );
  assert.ok(
    migration.indexOf("create trigger protect_ai_grading_benchmark_bucket") <
      migration.indexOf("insert into storage.buckets"),
    "private-bucket DDL must precede storage DML in the migration transaction",
  );
  assert.match(migration, /claim_ai_grading_benchmark_run/);
  assert.match(migration, /status = 'outcome_unknown'/);
  assert.match(migration, /PROVIDER_OUTCOME_UNKNOWN/);
  assert.match(migration, /fail_ai_grading_benchmark_provider/);
  assert.match(migration, /v_request\.response_status is not null/);
  assert.match(
    migration,
    /coalesce\(v_request\.error_code, ''\) = 'schema_invalid'/,
  );
  assert.match(migration, /v_claim\.claim_attempt_count >= 3/);
  assert.match(migration, /DEFINITE_PROVIDER_FAILURE_EXHAUSTED/);
  assert.match(migration, /benchmarkFailureAttestationSignature/);
  assert.match(
    migration,
    /benchmarkClaimToken'[\s\S]*p_claim_token/,
  );
  assert.match(
    migration,
    /benchmarkClaimAttempt'[\s\S]*v_claim\.claim_attempt_count/,
  );
  assert.match(migration, /Benchmark failure audit HMAC verification failed/);
  assert.doesNotMatch(
    migration,
    /grant select on public\.ai_grading_benchmark_run_claims to service_role/,
  );
  assert.match(
    migration,
    /verify_ai_grading_benchmark_acoustic_attestation/,
  );
  assert.match(migration, /Benchmark acoustic attestation HMAC verification failed/);
  assert.match(migration, /active_report_path_uidx/);
  assert.match(migration, /active_report_hash_uidx/);
  assert.match(migration, /active_acoustic_envelope_uidx/);
  assert.match(migration, /vault\.decrypted_secrets/);
  assert.match(migration, /extensions\.hmac/);
  assert.match(migration, /benchmarkPipelineStage/);
  assert.match(migration, /'adjudicated'/);
  assert.match(migration, /pipeline_stage text not null/);
  assert.match(migration, /provisional_provider_request_id uuid references/);
  assert.match(migration, /scrub_benchmark_knowledge_query_preview/);
  assert.match(migration, /new\.query_preview := null/);
  assert.match(migration, /prevent_benchmark_claim_link_mutation/);
  assert.match(migration, /claim\.provisional_provider_request_id = old\.id/);
  assert.match(
    migration,
    /Benchmark provisional\/final release proof is incomplete/,
  );
  assert.doesNotMatch(
    executor,
    /benchmarkAttestationSignature[\s\S]*\^\[a-f0-9\]/,
  );
  assert.match(executor, /verify_ai_grading_benchmark_provider_request/);
  assert.match(executor, /buildWritingAdjudicationPrompt/);
  assert.match(executor, /buildSpeakingAdjudicationPrompt/);
  assert.match(executor, /sensitiveQuery: true/);
  assert.match(executor, /pipelineStage: "provisional"/);
  assert.match(executor, /pipelineStage: "adjudicated"/);
  assert.match(executor, /loadAudioReport/);
  assert.match(executor, /reportStorageVersion/);
  assert.match(executor, /reportEtag/);
  assert.match(executor, /audioReportBytes/);
  assert.match(executor, /\.from\("buckets"\)/);
  assert.match(executor, /privateBucket\.public !== false/);
  assert.match(executor, /assertBenchmarkProviderConfiguration/);
  assert.match(executor, /benchmarkClaimToken/);
  assert.match(executor, /benchmarkClaimAttempt/);
  assert.match(coreExecute, /benchmarkFailureAttestationSignature/);
  assert.match(coreExecute, /benchmarkClaimToken/);
  assert.match(coreExecute, /benchmarkClaimAttempt/);
  assert.match(coreExecute, /requestInputSha256/);
  assert.match(workerPackage.scripts.benchmark, /benchmark-cli\.ts/);
});

test("benchmark failure retries reject forged or replayed claim audits", () => {
  const migration = read(
    "supabase/migrations/20260901180000_ai_grading_benchmark_executor_claims.sql",
  );
  assert.match(
    migration,
    /v_claim\.claim_token is distinct from p_claim_token/,
  );
  assert.match(
    migration,
    /benchmarkClaimToken'[\s\S]*is distinct from p_claim_token::text/,
  );
  assert.match(
    migration,
    /benchmarkClaimAttempt'[\s\S]*is distinct from v_claim\.claim_attempt_count::text/,
  );
  assert.match(migration, /extensions\.hmac/);
  assert.match(migration, /benchmarkFailureAttestationSignature/);
  assert.match(migration, /claim_attempt_count >= 3/);
  assert.match(migration, /status = 'exhausted'/);
  assert.match(migration, /status = 'reserved'/);
});

test("acoustic evidence is Vault-attested and cannot be reused", () => {
  const migration = read(
    "supabase/migrations/20260901180000_ai_grading_benchmark_executor_claims.sql",
  );
  assert.match(
    migration,
    /verify_ai_grading_benchmark_acoustic_attestation/,
  );
  assert.match(migration, /p_envelope ->> 'audioArtifactSha256'/);
  assert.match(migration, /p_envelope ->> 'transcriptSha256'/);
  assert.match(migration, /p_envelope ->> 'configSha256'/);
  assert.match(migration, /p_envelope ->> 'reportSha256'/);
  assert.match(migration, /active_report_path_uidx/);
  assert.match(migration, /active_report_hash_uidx/);
  assert.match(migration, /active_acoustic_envelope_uidx/);
});
