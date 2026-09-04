import assert from "node:assert/strict";
import test from "node:test";
import { fixtureClient } from "./rest-fixture";
import { loadCentreIeltsEvents } from "./centre-scoring";
import { buildCentreAnalytics } from "@/lib/analytics/centre-rollup";
import { centreFixture } from "@/lib/analytics/__fixtures__/analytics";

test("scoped scoring reads retain revision feedback and teachers who review after AI", async () => {
  const input = centreFixture();
  const classId = input.classes[0].classId;
  const attempt = {
    id: "attempt",
    class_id: classId,
    club_id: input.clubId,
    user_id: "learner",
    assignment_id: "assignment",
    test_id: "test",
    submitted_at: "2026-09-01T00:00:00Z",
  };
  const response = {
    id: "response",
    user_id: "learner",
    attempt_id: "attempt",
    revision: 2,
    revision_consumed_at: "2026-09-03T00:00:00Z",
    task_number: 2,
    status: "scored",
    task_band: 6,
    scored_at: "2026-09-03T01:00:00Z",
  };
  const tables = {
    ielts_attempts: [
      attempt,
      { ...attempt, id: "foreign-attempt", class_id: "foreign-class" },
      { ...attempt, id: "foreign-centre", club_id: "foreign" },
    ],
    writing_responses: [
      response,
      { ...response, id: "foreign-response", attempt_id: "foreign-attempt" },
    ],
    ielts_tests: [{ id: "test", kind: "full_mock" }],
    attempt_band_scores: [
      {
        id: "score",
        attempt_id: "attempt",
        listening_band: 6,
        reading_band: 6,
        writing_band: 6,
        speaking_band: null,
        computed_at: "2026-09-03T01:00:00Z",
      },
    ],
    ielts_teacher_reviews: [
      {
        id: "review",
        user_id: "learner",
        attempt_id: "attempt",
        writing_response_id: "response",
        revision: 2,
        club_id: input.clubId,
      },
    ],
    ielts_teacher_review_events: [0, 1, 2].map((revision) => ({
      id: `review-event-${revision}`,
      review_id: "review",
      revision,
      actor_id: "recorded-teacher",
      to_status: "published",
      created_at: `2026-09-0${revision + 1}T02:00:00Z`,
    })),
    ielts_criterion_evidence: [0, 1, 2].flatMap((revision) =>
      [
        "taskResponse",
        "coherenceCohesion",
        "lexicalResource",
        "grammaticalRangeAccuracy",
      ].map((criterion) => ({
        id: `${revision}:${criterion}`,
        response_id: "response",
        user_id: "learner",
        attempt_id: "attempt",
        revision,
        source_response_revision: revision,
        run_id: `run${revision}`,
        criterion,
        stage: "provisional",
        created_at: `2026-09-0${revision + 1}T01:00:00Z`,
      })),
    ),
  };
  const db = fixtureClient(tables);
  const trusted = fixtureClient(tables);
  const events = await loadCentreIeltsEvents(
    db.client,
    trusted.client,
    input.clubId,
    [classId],
    input.period,
  );
  const report = buildCentreAnalytics({ ...input, events });
  assert.equal(report.uniqueAiResponses, 1);
  assert.equal(report.markingWorkload.qualifyingResponses, 1);
  assert.equal(report.turnedAroundRevisions.count, 3);
  assert.equal(report.turnedAroundRevisions.medianHours, 1);
  assert.equal(
    events.find((event) => event.kind === "feedback" && event.revision === 1)
      ?.turnedAroundHours,
    null,
  );
  assert.equal(
    report.teacherRows.find((row) => row.teacherId === "recorded-teacher")
      ?.publishedFeedback,
    3,
  );
  assert.equal(
    report.mocksGraded.total,
    0,
    "incomplete mock must not be counted",
  );
  assert.ok(trusted.requests.length > 0);
  assert.ok(
    trusted.requests.every(
      (request) =>
        request.pathname.endsWith("ielts_criterion_evidence") &&
        request.searchParams.get("response_id") === "in.(response)",
    ),
  );
  assert.ok(events.every((event) => event.classId === classId));
});
