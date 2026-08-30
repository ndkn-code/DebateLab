import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const action = fs.readFileSync(path.join(here, "../../../app/actions/ielts/teacher-review.ts"), "utf8");
const repository = fs.readFileSync(path.join(here, "./manual-retry-repository.ts"), "utf8");

assert.match(action, /retryIeltsScoringWorkflow/);
assert.match(action, /requireClassManager\(client, input\.classId\)/);
assert.match(action, /expectedRevision: TeacherReviewExpectedRevisionSchema/);
assert.match(action, /idempotencyKey: z\.string\(\)\.uuid\(\)/);
assert.match(action, /reserveIeltsManualRetry/);
assert.match(action, /launchIelts(?:Writing|Speaking)ScoreWorkflow/);
assert.match(repository, /retry_ielts_scoring_workflow/);
assert.match(repository, /p_expected_revision/);
assert.match(repository, /p_idempotency_key/);
assert.match(repository, /manual_retry_count/);
assert.match(repository, /IELTS_MANUAL_RETRY_LIMIT = 1/);
