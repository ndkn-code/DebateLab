import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/20260829020000_ielts_teacher_reviews.sql"),
  "utf8",
);
const gradebook = readFileSync(
  resolve(process.cwd(), "src/lib/api/ielts/gradebook-repository.ts"),
  "utf8",
);

assert.match(migration, /p_expected_revision integer/);
assert.match(migration, /if p_expected_revision is null or v_revision <> p_expected_revision then raise exception 'IELTS_RESPONSE_REVISION_STALE'/);
assert.match(migration, /for update;/);
assert.match(migration, /p_task_response numeric/);
assert.doesNotMatch(migration, /p_bands\s+jsonb/);
assert.match(migration, /drop constraint if exists ielts_teacher_reviews_check3/);
assert.match(migration, /v\.reviewer_id <> p_actor_id/);
assert.match(migration, /status <> 'draft'/);
assert.match(gradebook, /assignment_type\.eq\.ielts_mock,ielts_test_id\.not\.is\.null/);

console.log("IELTS teacher review migration contract tests passed");
