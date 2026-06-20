import assert from "node:assert/strict";
import {
  isSectionClosed,
  remainingSeconds,
  sectionStatus,
  type SectionTimingState,
} from "./section-timing";

const NOW = Date.parse("2026-06-20T10:00:00Z");
const base: SectionTimingState = {
  startedAt: null,
  deadlineAt: null,
  submittedAt: null,
  pausedAt: null,
  timeLimitSeconds: 3600,
};

// ---- sectionStatus ---------------------------------------------------------
assert.equal(sectionStatus(base, NOW), "not_started");
assert.equal(
  sectionStatus({ ...base, startedAt: "2026-06-20T09:30:00Z", deadlineAt: "2026-06-20T10:30:00Z" }, NOW),
  "running",
);
assert.equal(
  sectionStatus({ ...base, startedAt: "2026-06-20T09:00:00Z", deadlineAt: "2026-06-20T09:59:00Z" }, NOW),
  "expired",
);
assert.equal(
  sectionStatus(
    { ...base, startedAt: "2026-06-20T09:30:00Z", deadlineAt: "2026-06-20T10:30:00Z", pausedAt: "2026-06-20T09:50:00Z" },
    NOW,
  ),
  "paused",
);
assert.equal(
  sectionStatus({ ...base, startedAt: "2026-06-20T09:30:00Z", submittedAt: "2026-06-20T09:45:00Z" }, NOW),
  "submitted",
);
// submitted wins even if also past deadline.
assert.equal(
  sectionStatus(
    { ...base, startedAt: "2026-06-20T09:00:00Z", deadlineAt: "2026-06-20T09:30:00Z", submittedAt: "2026-06-20T09:25:00Z" },
    NOW,
  ),
  "submitted",
);

// ---- remainingSeconds ------------------------------------------------------
// running: 30 min left.
assert.equal(
  remainingSeconds({ ...base, startedAt: "2026-06-20T09:30:00Z", deadlineAt: "2026-06-20T10:30:00Z" }, NOW),
  1800,
);
// past deadline clamps to 0.
assert.equal(
  remainingSeconds({ ...base, startedAt: "2026-06-20T09:00:00Z", deadlineAt: "2026-06-20T09:59:00Z" }, NOW),
  0,
);
// paused: frozen at (deadline − pausedAt) = 40 min, regardless of now.
assert.equal(
  remainingSeconds(
    { ...base, startedAt: "2026-06-20T09:30:00Z", deadlineAt: "2026-06-20T10:30:00Z", pausedAt: "2026-06-20T09:50:00Z" },
    NOW,
  ),
  2400,
);
// not started, no deadline yet → full allowance.
assert.equal(remainingSeconds(base, NOW), 3600);
// started but no deadline (untimed) → 0 countdown.
assert.equal(remainingSeconds({ ...base, startedAt: "2026-06-20T09:30:00Z", timeLimitSeconds: null }, NOW), 0);
// not started, no limit → 0.
assert.equal(remainingSeconds({ ...base, timeLimitSeconds: null }, NOW), 0);

// ---- isSectionClosed -------------------------------------------------------
assert.equal(isSectionClosed({ ...base, startedAt: "2026-06-20T09:30:00Z", submittedAt: "2026-06-20T09:45:00Z" }, NOW), true);
assert.equal(isSectionClosed({ ...base, startedAt: "2026-06-20T09:00:00Z", deadlineAt: "2026-06-20T09:59:00Z" }, NOW), true);
assert.equal(isSectionClosed({ ...base, startedAt: "2026-06-20T09:30:00Z", deadlineAt: "2026-06-20T10:30:00Z" }, NOW), false);
assert.equal(isSectionClosed(base, NOW), false);

console.log("ielts/section-timing tests passed");
