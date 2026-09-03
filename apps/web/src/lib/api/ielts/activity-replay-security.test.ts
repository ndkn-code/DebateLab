import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "../../supabase/migrations/20260903122000_activity_ielts_replay_guards.sql",
  ),
  "utf8",
);

test("only one in-progress activity attempt can exist", () => {
  assert.match(migration, /activity_attempts_one_active_uidx/);
  assert.match(migration, /where completed_at is null/);
});

test("adaptive evidence is unique per immutable source atom", () => {
  assert.match(migration, /ielts_adaptive_evidence_source_atom_uidx/);
  assert.match(
    migration,
    /user_id, source_table, source_id, evidence_type, subskill_key/,
  );
});

test("assigned IELTS attempts permit only expired or abandoned retries", () => {
  assert.match(migration, /ielts_attempts_one_live_assignment_uidx/);
  assert.match(migration, /status not in \('expired', 'abandoned'\)/);
});
