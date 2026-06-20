import assert from "node:assert/strict";
import {
  formatBand,
  isAttemptComplete,
  latestOverallBand,
  summarizeAttempts,
  type AttemptBandRow,
  type AttemptRow,
  type AttemptTestRow,
} from "./summary";

const attempt = (over: Partial<AttemptRow> & Pick<AttemptRow, "id">): AttemptRow => ({
  test_id: "t1",
  module: "academic",
  status: "completed",
  attempt_number: 1,
  started_at: "2026-06-01T10:00:00.000Z",
  submitted_at: "2026-06-01T11:00:00.000Z",
  ...over,
});

const tests: AttemptTestRow[] = [
  { id: "t1", title: "Cambridge 19 Test 1", slug: "cam19-1" },
  { id: "t2", title: "Listening Drill A", slug: "ld-a" },
];

const band = (over: Partial<AttemptBandRow> & Pick<AttemptBandRow, "attempt_id">): AttemptBandRow => ({
  overall_band: 6.5,
  listening_band: 7,
  reading_band: 6.5,
  writing_band: 6,
  speaking_band: 6.5,
  ...over,
});

// ── formatBand ──────────────────────────────────────────────────────────────
assert.equal(formatBand(6.5), "6.5");
assert.equal(formatBand(7), "7.0");
assert.equal(formatBand(null), "—");
assert.equal(formatBand(undefined), "—");

// ── isAttemptComplete ───────────────────────────────────────────────────────
assert.equal(isAttemptComplete("in_progress"), false);
assert.equal(isAttemptComplete("submitted"), true);
assert.equal(isAttemptComplete("completed"), true);

// ── summarizeAttempts: stitches test + band, newest first ───────────────────
{
  const summaries = summarizeAttempts(
    [
      attempt({ id: "a1", test_id: "t1", started_at: "2026-06-01T10:00:00.000Z" }),
      attempt({ id: "a2", test_id: "t2", started_at: "2026-06-03T10:00:00.000Z" }),
    ],
    tests,
    [band({ attempt_id: "a1", overall_band: 6.5 })],
  );
  // newest sitting (a2) first
  assert.equal(summaries[0].attemptId, "a2");
  assert.equal(summaries[0].testTitle, "Listening Drill A");
  assert.equal(summaries[0].overallBand, null); // a2 has no band row
  assert.deepEqual(summaries[0].skillBands, {
    listening: null,
    reading: null,
    writing: null,
    speaking: null,
  });
  assert.equal(summaries[1].attemptId, "a1");
  assert.equal(summaries[1].overallBand, 6.5);
  assert.equal(summaries[1].skillBands.listening, 7);
  assert.equal(summaries[1].resultsHref, "/ielts/attempts/a1/results");
}

// ── missing test row degrades gracefully ────────────────────────────────────
{
  const [summary] = summarizeAttempts([attempt({ id: "a9", test_id: "gone" })], tests, []);
  assert.equal(summary.testTitle, "IELTS mock");
  assert.equal(summary.testSlug, "");
}

// ── same start time → higher attempt_number wins the tiebreak ───────────────
{
  const summaries = summarizeAttempts(
    [
      attempt({ id: "a1", attempt_number: 1 }),
      attempt({ id: "a2", attempt_number: 2 }),
    ],
    tests,
    [],
  );
  assert.equal(summaries[0].attemptId, "a2");
}

// ── latestOverallBand: first completed attempt with a band ──────────────────
{
  const summaries = summarizeAttempts(
    [
      attempt({ id: "a1", started_at: "2026-06-05T10:00:00.000Z", status: "in_progress" }),
      attempt({ id: "a2", started_at: "2026-06-04T10:00:00.000Z" }),
      attempt({ id: "a3", started_at: "2026-06-03T10:00:00.000Z" }),
    ],
    tests,
    [band({ attempt_id: "a2", overall_band: 7 }), band({ attempt_id: "a3", overall_band: 6 })],
  );
  // a1 is newest but in-progress (no band); a2 is the latest completed band
  assert.equal(latestOverallBand(summaries), 7);
  assert.equal(latestOverallBand([]), null);
}

console.log("ielts/learner/summary.test.ts passed");
