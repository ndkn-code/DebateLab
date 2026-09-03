import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "../../supabase/migrations/20260903120000_age_assurance_atomicity.sql",
  ),
  "utf8",
);

test("age assurance prevents a minor from self-transitioning to adult", () => {
  assert.match(
    migration,
    /v_existing\.age_band is distinct from p_age_band/,
  );
  assert.match(migration, /raise exception 'AGE_ASSURANCE_LOCKED'/);
  assert.match(migration, /v_uid uuid := auth\.uid\(\)/);
});

test("guardian token consumption is one atomic conditional update", () => {
  assert.match(migration, /where verification_token_hash = p_token_hash/);
  assert.match(migration, /consent_status = 'guardian_pending'/);
  assert.match(migration, /verification_expires_at > now\(\)/);
  assert.match(migration, /verification_token_hash = null/);
  assert.match(migration, /INVALID_OR_EXPIRED_TOKEN/);
});

test("only authenticated administrators can reset with an audit record", () => {
  assert.match(migration, /not private\.is_admin\(v_actor\)/);
  assert.match(migration, /insert into public\.age_assurance_audit_events/);
  assert.match(migration, /previous_state/);
});
