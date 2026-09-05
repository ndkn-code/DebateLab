import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attentionDays,
  attentionReturnHref,
  followupQuery,
  learnerReportHref,
  parseFollowupContext,
} from "./learner-followup-navigation";
import { learnerWorkStatus } from "./learner-work-status";
import { classFixture } from "./__fixtures__/analytics";

test("direct learner links carry class, learner, period and only supported reasons", () => {
  const context = parseFollowupContext({
    attention: "1",
    days: "90",
    reasons: "critical_weakness,unknown,repeated_absence",
  })!;
  assert.deepEqual(context, {
    days: 90,
    reasons: ["critical_weakness", "repeated_absence"],
  });
  assert.equal(
    learnerReportHref("class-a", "learner-b", context),
    "/dashboard/teacher/classes/class-a/reports/learner-b?attention=1&days=90&reasons=critical_weakness%2Crepeated_absence",
  );
  for (const locale of ["en", "vi"]) {
    const url = new URL(
      `https://fixture.invalid/${locale}${learnerReportHref("class-a", "learner-b", context)}`,
    );
    assert.equal(
      url.pathname,
      `/${locale}/dashboard/teacher/classes/class-a/reports/learner-b`,
    );
    assert.deepEqual(
      parseFollowupContext(Object.fromEntries(url.searchParams)),
      context,
    );
  }
  assert.equal(
    attentionReturnHref("class-a", "learner-b", 90),
    "/dashboard/teacher/classes/class-a?classTab=analytics&attentionDays=90#learner-attention-learner-b",
  );
  assert.equal(attentionDays("-1"), 30);
  assert.deepEqual(
    parseFollowupContext({
      attention: ["1", "0"],
      days: ["7", "90"],
      reasons: ["overdue_assignment", "unknown"],
    }),
    { days: 7, reasons: ["overdue_assignment"] },
  );
  assert.equal(parseFollowupContext({ days: "90" }), undefined);
  assert.deepEqual(
    parseFollowupContext(
      Object.fromEntries(
        new URLSearchParams(followupQuery({ days: 7, reasons: [] })),
      ),
    )?.reasons,
    [],
  );
});

test("work states distinguish no work, overdue, pending, completed and returned", () => {
  const work = structuredClone(classFixture(1).rows[0].assignments[0]);
  work.status = "active";
  work.dueAt = "2026-09-01T00:00:00Z";
  work.submittedAt = null;
  work.attemptId = null;
  work.reviewTargets = [];
  work.homework.submitted = false;
  const now = "2026-09-05T00:00:00Z";
  assert.equal(learnerWorkStatus(work, now), "overdue");
  work.dueAt = null;
  assert.equal(learnerWorkStatus(work, now), "notStarted");
  work.attemptId = "attempt";
  assert.equal(learnerWorkStatus(work, now), "inProgress");
  work.submittedAt = now;
  work.needsTeacherReview = true;
  assert.equal(learnerWorkStatus(work, now), "pending");
  work.needsTeacherReview = false;
  assert.equal(learnerWorkStatus(work, now), "completed");
  work.homework.submitted = true;
  work.homework.gradeStatus = "graded";
  assert.equal(learnerWorkStatus(work, now), "graded");
  work.homework.gradeStatus = "submitted";
  assert.equal(learnerWorkStatus(work, now), "pending");
  work.homework.gradeStatus = "resubmit_requested";
  assert.equal(learnerWorkStatus(work, now), "resubmit");
  work.homework.gradeStatus = "returned";
  assert.equal(learnerWorkStatus(work, now), "returned");
  work.status = "draft";
  assert.equal(learnerWorkStatus(work, now), "inactive");
});
