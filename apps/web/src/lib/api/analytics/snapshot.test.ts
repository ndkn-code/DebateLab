import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { fixtureClient, type FixtureRows } from "./rest-fixture";
import { classFixture } from "@/lib/analytics/__fixtures__/analytics";
import {
  loadIeltsClassGradebookSnapshot,
  projectIeltsGradebookPage,
} from "@/lib/api/ielts/gradebook-repository";
import { readChunkedPages, requireRows } from "./query-pages";
import { buildClassAnalytics } from "@/lib/analytics/class-rollup";

test("one complete 150-learner snapshot feeds all cursor pages without media requests", async () => {
  const fixture = classFixture();
  const tables: FixtureRows = {
    classes: [
      {
        id: fixture.classId,
        club_id: fixture.clubId,
        title: fixture.classTitle,
        program_type: "ielts",
      },
    ],
    class_memberships: fixture.rows.map((row) => ({
      id: `membership:${row.userId}`,
      class_id: fixture.classId,
      user_id: row.userId,
      member_role: "student",
      status: "active",
      joined_at: "2026-01-01",
      removed_at: null,
    })),
    club_assignments: [
      {
        id: fixture.rows[0].assignments[0].assignmentId,
        class_id: fixture.classId,
        club_id: fixture.clubId,
        title: "Mock",
        assignment_type: "ielts_mock",
        status: "published",
        due_at: "2026-09-02T01:00:00Z",
        created_at: "2026-09-01",
      },
    ],
    profiles: fixture.rows.map((row) => ({
      id: row.userId,
      display_name: row.displayName,
      email: row.email,
    })),
    ielts_attempts: fixture.rows.map((row) => ({
      id: row.assignments[0].attemptId,
      user_id: row.userId,
      class_id: fixture.classId,
      assignment_id: row.assignments[0].assignmentId,
      status: "submitted",
      submitted_at: "2026-09-02T01:00:00Z",
      created_at: "2026-09-02T00:00:00Z",
    })),
    writing_responses: fixture.rows.flatMap((row) =>
      row.assignments[0].reviewTargets.map((target) => ({
        id: target.responseId,
        attempt_id: target.attemptId,
        task_number: target.taskNumber,
        revision: 0,
        status: "scored",
        updated_at: "2026-09-02T02:00:00Z",
        task_response_band: 5,
        coherence_cohesion_band: 6.5,
        lexical_resource_band: 6.5,
        grammar_band: 6.5,
        task_band: 6,
        paragraph_feedback: {},
      })),
    ),
    attempt_band_scores: fixture.rows.map((row) => ({
      id: row.assignments[0].attemptId,
      attempt_id: row.assignments[0].attemptId,
      listening_band: 6.5,
      reading_band: 6,
      writing_band: 6,
      speaking_band: null,
      overall_band: null,
    })),
    ielts_criterion_evidence: fixture.criterionEvidence.map((row, index) => ({
      id: `evidence:${index}`,
      response_id: row.responseId,
      ...row,
    })),
  };
  const { client, requests, cost } = fixtureClient(tables);
  const started = performance.now();
  const snapshot = await loadIeltsClassGradebookSnapshot(
    client,
    { classId: fixture.classId, clubId: fixture.clubId },
    client,
  );
  const snapshotQueries = cost.queries;
  const first = projectIeltsGradebookPage(snapshot, { limit: 100 });
  const second = projectIeltsGradebookPage(snapshot, {
    limit: 100,
    cursor: first.nextCursor,
  });
  assert.equal(first.rows.length, 100);
  assert.equal(second.rows.length, 50);
  assert.equal(second.nextCursor, null);
  assert.equal(
    new Set([...first.rows, ...second.rows].map((row) => row.userId)).size,
    150,
  );
  assert.equal(cost.queries, snapshotQueries);
  assert.ok(!requests.some((url) => /storage/.test(url.pathname)));
  assert.throws(
    () =>
      projectIeltsGradebookPage(
        {
          ...snapshot,
          gradebook: { ...snapshot.gradebook, clubId: "another-centre" },
        },
        { cursor: first.nextCursor },
      ),
    /Invalid/,
  );
  const ids = snapshot.gradebook.rows.flatMap((row) =>
    row.assignments.flatMap((assignment) =>
      assignment.reviewTargets.map((target) => target.responseId),
    ),
  );
  const evidence = requireRows(
    await readChunkedPages([ids], (chunks, from, to) =>
      client
        .from("ielts_criterion_evidence")
        .select("*")
        .in("response_id", chunks[0])
        .order("id")
        .range(from, to),
    ),
    "evidence",
  );
  assert.equal(evidence.length, 1200);
  const report = buildClassAnalytics({
    ...fixture,
    rows: snapshot.gradebook.rows,
  });
  assert.equal(report.coverage.learnerCount, 150);
  console.log(
    JSON.stringify({
      fixture:
        "150 learners, one mock, 300 writing responses, 1200 criterion rows; no courses or attendance",
      snapshotQueries,
      totalQueriesIncludingEvidence: cost.queries,
      returnedRows: cost.rows,
      responseBytes: cost.bytes,
      elapsedMs: Math.round((performance.now() - started) * 100) / 100,
      network: "mocked PostgREST; not production latency",
    }),
  );
});
