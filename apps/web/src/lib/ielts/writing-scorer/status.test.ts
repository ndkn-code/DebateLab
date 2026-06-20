import assert from "node:assert/strict";
import {
  TERMINAL_WRITING_STATUSES,
  claimableWritingStatuses,
  decideWritingScoringAction,
  isTerminalWritingStatus,
  mapWritingStatusToJobStatus,
} from "./status";
import { IELTS_WRITING_STALE_SCORING_MS } from "./constants";

// --- status mapping ---------------------------------------------------------
assert.equal(mapWritingStatusToJobStatus("pending"), "queued");
assert.equal(mapWritingStatusToJobStatus("failed"), "queued");
assert.equal(mapWritingStatusToJobStatus("scoring"), "processing");
assert.equal(mapWritingStatusToJobStatus("scored"), "completed");
assert.equal(mapWritingStatusToJobStatus("overridden"), "completed");

// --- terminal ---------------------------------------------------------------
assert.deepEqual(TERMINAL_WRITING_STATUSES, ["scored", "overridden"]);
assert.equal(isTerminalWritingStatus("scored"), true);
assert.equal(isTerminalWritingStatus("overridden"), true);
assert.equal(isTerminalWritingStatus("pending"), false);
assert.equal(isTerminalWritingStatus("scoring"), false);

// --- claimable statuses -----------------------------------------------------
assert.deepEqual(claimableWritingStatuses(["queued"]), ["pending", "failed"]);
assert.deepEqual(claimableWritingStatuses(["processing"]), ["scoring"]);
assert.deepEqual(claimableWritingStatuses(["queued", "processing"]), [
  "pending",
  "failed",
  "scoring",
]);
assert.deepEqual(claimableWritingStatuses([]), []);

// --- scoring action decision ------------------------------------------------
const now = 1_700_000_000_000;

// pending -> process from a queued claim
const pending = decideWritingScoringAction({
  status: "pending",
  updatedAt: null,
  queueDeliveryCount: 1,
  nowMs: now,
});
assert.equal(pending.action, "process");
assert.deepEqual(
  pending.action === "process" ? pending.allowedStatuses : null,
  ["queued"],
);

// failed -> retryable, claimed from queued
const failed = decideWritingScoringAction({
  status: "failed",
  updatedAt: null,
  queueDeliveryCount: 2,
  nowMs: now,
});
assert.equal(failed.action, "process");

// fresh scoring -> skip (another worker is mid-flight)
const fresh = decideWritingScoringAction({
  status: "scoring",
  updatedAt: new Date(now - 60_000).toISOString(),
  queueDeliveryCount: 1,
  nowMs: now,
});
assert.equal(fresh.action, "skip");

// stale scoring -> reclaim via a processing claim
const stale = decideWritingScoringAction({
  status: "scoring",
  updatedAt: new Date(now - IELTS_WRITING_STALE_SCORING_MS - 1_000).toISOString(),
  queueDeliveryCount: 1,
  nowMs: now,
});
assert.equal(stale.action, "process");
assert.deepEqual(
  stale.action === "process" ? stale.allowedStatuses : null,
  ["processing"],
);

// exhausted queue deliveries -> fail
const exhausted = decideWritingScoringAction({
  status: "pending",
  updatedAt: null,
  queueDeliveryCount: 4,
  nowMs: now,
});
assert.equal(exhausted.action, "fail");

console.log("ielts/writing-scorer/status tests passed");
