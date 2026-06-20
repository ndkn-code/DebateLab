import assert from "node:assert/strict";
import {
  TERMINAL_SPEAKING_STATUSES,
  claimableSpeakingStatuses,
  decideSpeakingScoringAction,
  isTerminalSpeakingStatus,
  mapSpeakingStatusToJobStatus,
} from "./status";
import { IELTS_SPEAKING_STALE_SCORING_MS } from "./constants";

// --- status mapping ---------------------------------------------------------
assert.equal(mapSpeakingStatusToJobStatus("pending"), "queued");
assert.equal(mapSpeakingStatusToJobStatus("failed"), "queued");
assert.equal(mapSpeakingStatusToJobStatus("scoring"), "processing");
assert.equal(mapSpeakingStatusToJobStatus("scored"), "completed");
assert.equal(mapSpeakingStatusToJobStatus("overridden"), "completed");

// --- terminal ---------------------------------------------------------------
assert.deepEqual(TERMINAL_SPEAKING_STATUSES, ["scored", "overridden"]);
assert.equal(isTerminalSpeakingStatus("scored"), true);
assert.equal(isTerminalSpeakingStatus("overridden"), true);
assert.equal(isTerminalSpeakingStatus("pending"), false);
assert.equal(isTerminalSpeakingStatus("scoring"), false);

// --- claimable statuses -----------------------------------------------------
assert.deepEqual(claimableSpeakingStatuses(["queued"]), ["pending", "failed"]);
assert.deepEqual(claimableSpeakingStatuses(["processing"]), ["scoring"]);
assert.deepEqual(claimableSpeakingStatuses(["queued", "processing"]), [
  "pending",
  "failed",
  "scoring",
]);
assert.deepEqual(claimableSpeakingStatuses([]), []);

// --- scoring action decision ------------------------------------------------
const now = 1_700_000_000_000;

// pending -> process from a queued claim
const pending = decideSpeakingScoringAction({
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
const failed = decideSpeakingScoringAction({
  status: "failed",
  updatedAt: null,
  queueDeliveryCount: 2,
  nowMs: now,
});
assert.equal(failed.action, "process");

// fresh scoring -> skip (another worker is mid-flight)
const fresh = decideSpeakingScoringAction({
  status: "scoring",
  updatedAt: new Date(now - 60_000).toISOString(),
  queueDeliveryCount: 1,
  nowMs: now,
});
assert.equal(fresh.action, "skip");

// stale scoring -> reclaim via a processing claim
const stale = decideSpeakingScoringAction({
  status: "scoring",
  updatedAt: new Date(
    now - IELTS_SPEAKING_STALE_SCORING_MS - 1_000,
  ).toISOString(),
  queueDeliveryCount: 1,
  nowMs: now,
});
assert.equal(stale.action, "process");
assert.deepEqual(
  stale.action === "process" ? stale.allowedStatuses : null,
  ["processing"],
);

// exhausted queue deliveries -> fail (max attempts = 3)
const exhausted = decideSpeakingScoringAction({
  status: "pending",
  updatedAt: null,
  queueDeliveryCount: 4,
  nowMs: now,
});
assert.equal(exhausted.action, "fail");

console.log("ielts/speaking-scorer/status tests passed");
