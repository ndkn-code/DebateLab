import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const migrationPaths = [
  "supabase/migrations/20260901200000_external_benchmark_withdrawal_verification.sql",
  "supabase/migrations/20260901201000_external_benchmark_withdrawal_backfill.sql",
  "supabase/migrations/20260901202000_external_benchmark_withdrawal_verification_finalize.sql",
];
const migrations = migrationPaths.map((path) =>
  readFileSync(resolve(root, path), "utf8"),
);
const [preparationMigration, backfillMigration, finalizeMigration] = migrations;
const migration = migrations.join("\n");
const runbook = readFileSync(
  resolve(root, "docs/ielts/benchmark-withdrawal-operator-runbook.md"),
  "utf8",
);
const refreshScript = readFileSync(
  resolve(
    root,
    "apps/web/src/scripts/ai-grading-benchmark-attestations-refresh.ts",
  ),
  "utf8",
);

test("external withdrawal actors are pseudonymous and not profile-bound", () => {
  assert.match(migration, /study_actor_key text/);
  assert.match(migration, /actor_kind in \('participant', 'guardian'/);
  assert.match(migration, /drop column withdrawn_by/);
  assert.match(
    migration,
    /drop constraint if exists ai_grading_verified_withdrawal_receipts_withdrawn_by_fkey/,
  );
  assert.doesNotMatch(
    migration,
    /study_actor_key[^;]*references public\.profiles/is,
  );
  assert.doesNotMatch(migration, /auth\.uid\(\)/);
});

test("withdrawal upgrade separates DDL, backfill DML, and finalization", () => {
  assert.doesNotMatch(preparationMigration, /^\s*update\s+public\./im);
  assert.match(
    preparationMigration,
    /revoke execute on function public\.withdraw_ai_grading_benchmark\(uuid, uuid\)\s+from service_role/,
  );
  assert.match(
    backfillMigration,
    /update public\.ai_grading_verified_withdrawal_receipts/,
  );
  assert.match(
    backfillMigration,
    /update public\.ai_grading_benchmark_withdrawals withdrawal/,
  );
  assert.doesNotMatch(backfillMigration, /^\s*alter\s+table\b/im);
  assert.doesNotMatch(backfillMigration, /^\s*create\s+/im);
  assert.doesNotMatch(backfillMigration, /^\s*(?:grant|revoke)\s+/im);
  assert.match(
    finalizeMigration,
    /alter table public\.ai_grading_verified_withdrawal_receipts[\s\S]*drop column withdrawn_by/,
  );
  assert.match(
    finalizeMigration,
    /alter table public\.ai_grading_benchmark_withdrawals[\s\S]*drop column withdrawn_by/,
  );
  assert.doesNotMatch(finalizeMigration, /legacy\.request\./);
  for (const phase of migrations) {
    assert.match(phase, /^begin;/);
    assert.match(phase, /commit;\s*$/);
  }
});

test("receipt verification is independently keyed, immutable, and operator-only", () => {
  assert.match(migration, /ai_grading_withdrawal_operator_keys/);
  assert.match(
    migration,
    /operator_profile_id <> credential_verified_by_profile_id/,
  );
  assert.match(migration, /signature_algorithm = 'ed25519'/);
  assert.match(migration, /signed_payload_sha256/);
  assert.match(migration, /operator_signature_base64/);
  assert.match(migration, /extensions\.digest\(/);
  assert.match(migration, /Verified withdrawal registry rows are immutable/);
  assert.match(
    migration,
    /revoke all on public\.ai_grading_verified_withdrawal_receipts\s+from public, anon, authenticated, service_role/,
  );
  assert.match(
    migration,
    /revoke all on public\.ai_grading_withdrawal_operator_keys\s+from public, anon, authenticated, service_role/,
  );
  assert.doesNotMatch(
    migration,
    /grant (?:insert|all)[^;]*(?:ai_grading_verified_withdrawal_receipts|ai_grading_withdrawal_operator_keys)[^;]*service_role/is,
  );
});

test("withdrawal consumption is bounded and exactly idempotent", () => {
  assert.match(migration, /expires_at <= verified_at \+ interval '7 days'/);
  assert.match(
    migration,
    /drop constraint if exists ai_grading_verified_withdrawal_receipts_benchmark_id_key/,
  );
  assert.match(
    migration,
    /ai_grading_verified_withdrawal_receipts_benchmark_idx/,
  );
  assert.match(migration, /ai-benchmark-withdrawal:/);
  assert.match(migration, /v_existing\.verified_receipt_id = p_verified_receipt_id/);
  assert.match(migration, /v_verified\.expires_at <= pg_catalog\.now\(\)/);
  assert.match(
    migration,
    /add constraint ai_grading_benchmark_withdrawal_verified_receipt_unique unique \(verified_receipt_id\)/,
  );
  assert.match(
    migration,
    /grant execute on function public\.withdraw_ai_grading_benchmark\(uuid, uuid\)\s+to service_role/,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.withdraw_ai_grading_benchmark\(uuid, uuid\)\s+to (?:anon|authenticated)/,
  );
});

test("operator runbook keeps verification outside the service-role boundary", () => {
  assert.match(runbook, /database-owner connection/i);
  assert.match(runbook, /Never use the Supabase service-role key/i);
  assert.match(runbook, /Ed25519 signature/i);
  assert.match(runbook, /seven days/i);
  assert.match(
    runbook,
    /participant or guardian never needs\s+a DebateLab account/i,
  );
  assert.match(runbook, /cannot\s+cryptographically verify Ed25519/i);
});

test("release-attestation refresh is atomic, monotonic, and service-role only", () => {
  assert.match(
    migration,
    /refresh_ai_grading_benchmark_release_attestations\(\s*p_attestations jsonb/,
  );
  assert.match(migration, /for update of current_attestation/);
  assert.match(
    migration,
    /withdrawalCheckedAt'\)::timestamptz <[\s\S]*current_attestation\.envelope/,
  );
  assert.match(
    migration,
    /incoming\.verified_at < current_attestation\.verified_at/,
  );
  assert.match(
    migration,
    /incoming\.verified_at = current_attestation\.verified_at[\s\S]*incoming\.signature_base64 <> current_attestation\.signature_base64/,
  );
  assert.match(
    migration,
    /withdrawalCheckedAt'\)::timestamptz =[\s\S]*withdrawalRegistryReceiptSha256' <>/,
  );
  assert.match(
    migration,
    /incoming\.envelope[\s\S]*- 'withdrawalRegistryReceiptSha256'[\s\S]*<> current_attestation\.envelope/,
  );
  assert.match(
    migration,
    /grant execute on function public\.refresh_ai_grading_benchmark_release_attestations\(jsonb\)\s+to service_role/,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.refresh_ai_grading_benchmark_release_attestations\(jsonb\)\s+to (?:anon|authenticated)/,
  );
  assert.match(
    refreshScript,
    /rpc\(\s*"refresh_ai_grading_benchmark_release_attestations"/,
  );
  assert.doesNotMatch(refreshScript, /\.upsert\(/);
});
