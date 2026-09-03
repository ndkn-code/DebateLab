import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "../../supabase/migrations/20260903123000_practice_analysis_transactional.sql",
  ),
  "utf8",
);

test("practice creation is service-role-only and server-idempotent", () => {
  assert.match(migration, /grant execute on function public\.begin_practice_analysis[\s\S]+to service_role/);
  assert.match(migration, /from public, anon, authenticated/);
  assert.match(migration, /practice_attempts_user_client_alias_key/);
  assert.match(migration, /client_attempt_alias/);
  assert.match(migration, /p_attempt->>'id' is distinct from p_attempt_id::text/);
  assert.match(migration, /p_job->>'attempt_id' is distinct from p_attempt_id::text/);
  assert.match(migration, /practice_session_drafts_server_clock/);
  assert.match(migration, /new\.session_started_at := now\(\)/);
  assert.match(migration, /new\.session_started_at := old\.session_started_at/);
});

test("credit charge and refund are unique and transaction-bound", () => {
  assert.match(migration, /idx_orb_transactions_practice_charge_reference/);
  assert.match(migration, /orb_balance = orb_balance - p_cost/);
  assert.match(migration, /orb_balance >= p_cost/);
  assert.match(migration, /type = 'practice_refund'/);
  assert.match(migration, /auth\.role\(\) is distinct from 'service_role'/);
});
