import assert from "node:assert/strict";
import {
  IELTS_SCORING_MAX_AUTOMATIC_ATTEMPTS,
  toIeltsScoringRunStatus,
  type IeltsScoringRunLike,
} from "./scoring-run-status";

function run(overrides: Partial<IeltsScoringRunLike> = {}): IeltsScoringRunLike {
  return {
    id: "run-1",
    workflow_run_id: "provider-run-1",
    status: "running",
    phase: "writing_scoring",
    progress: { percent: 37.6 },
    workflow_attempt_count: 1,
    provider_attempt_count: 2,
    last_error_code: null,
    updated_at: "2026-08-29T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

const absent = toIeltsScoringRunStatus(null);
assert.equal(absent.state, "not_scheduled");
assert.equal(
  absent.automaticAttemptsRemaining,
  IELTS_SCORING_MAX_AUTOMATIC_ATTEMPTS,
);

const active = toIeltsScoringRunStatus(run());
assert.equal(active.state, "processing");
assert.equal(active.progress, 38);
assert.equal(active.recommendedAction, "wait");
assert.equal(active.providerAttemptsUsed, 2);

const retry = toIeltsScoringRunStatus(
  run({
    status: "failed",
    last_error_code: "RETRYABLE_WORKFLOW_FAILED",
    workflow_attempt_count: 2,
  }),
);
assert.equal(retry.state, "retry_scheduled");
assert.equal(retry.retryable, true);
assert.equal(retry.automaticAttemptsRemaining, 1);
assert.equal(retry.manualRetryAvailable, false);

const exhausted = toIeltsScoringRunStatus(
  run({
    status: "failed",
    last_error_code: "WORKFLOW_RETRY_EXHAUSTED",
    workflow_attempt_count: 3,
  }),
);
assert.equal(exhausted.state, "failed_terminal");
assert.equal(exhausted.retryable, false);
assert.equal(exhausted.manualRetryAvailable, true);
assert.equal(exhausted.recommendedAction, "request_manual_retry");
assert.equal(exhausted.failureCode, "retry_exhausted");

const fatal = toIeltsScoringRunStatus(
  run({ status: "failed", last_error_code: "FATAL_WORKFLOW_FAILED" }),
);
assert.equal(fatal.state, "failed_terminal");
assert.equal(fatal.manualRetryAvailable, false);
assert.equal(fatal.recommendedAction, "manual_review");
assert.equal(fatal.failureCode, "unavailable");

const completed = toIeltsScoringRunStatus(
  run({ status: "completed", completed_at: "2026-08-29T00:01:00.000Z" }),
);
assert.equal(completed.state, "provisional_ready");
assert.equal(completed.recommendedAction, "none");

console.log("IELTS scoring run status tests passed");
