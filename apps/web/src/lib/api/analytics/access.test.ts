import assert from "node:assert/strict";
import test from "node:test";
import {
  requireAnalyticsClass,
  requireAnalyticsCentre,
  AnalyticsForbidden,
} from "./access";
import { fixtureClient } from "./rest-fixture";
import { TEACHER_WORKSPACE_COMPATIBLE_FEATURE_KEYS } from "@/lib/api/class-lms/teacher-workspace-capability";
import {
  analyticsAction,
  ClassAnalyticsSchema,
  PostMockExportSchema,
} from "./action-contract";
function context(role: string, assigned = false, centre = "centre") {
  return fixtureClient({
    profiles: [
      {
        id: "actor",
        role:
          role === "platform"
            ? "admin"
            : role === "teacher"
              ? "teacher"
              : "student",
      },
    ],
    classes: [{ id: "class", club_id: "centre", program_type: "ielts" }],
    club_memberships: [
      {
        id: "membership",
        club_id: centre,
        user_id: "actor",
        role,
        status: "active",
      },
    ],
    class_memberships: assigned
      ? [
          {
            id: "assigned",
            class_id: "class",
            user_id: "actor",
            member_role: "teacher",
            status: "active",
          },
        ]
      : [],
    lms_pilot_flags: [
      {
        id: "flag",
        club_id: "centre",
        class_id: "class",
        feature_key: TEACHER_WORKSPACE_COMPATIBLE_FEATURE_KEYS[0],
        enabled: true,
      },
    ],
  });
}
test("class analytics accepts platform/org managers and only assigned teachers", async () => {
  for (const role of ["platform", "owner", "admin", "head_teacher"])
    assert.equal(
      (
        await requireAnalyticsClass(
          context(role).client,
          "class",
          async () => true,
        )
      ).classId,
      "class",
    );
  assert.equal(
    (
      await requireAnalyticsClass(
        context("teacher", true).client,
        "class",
        async () => true,
      )
    ).role,
    "teacher",
  );
  for (const fixture of [
    context("student"),
    context("teacher"),
    context("owner", false, "other-centre"),
  ])
    await assert.rejects(
      requireAnalyticsClass(fixture.client, "class", async () => true),
      AnalyticsForbidden,
    );
});
test("centre analytics excludes ordinary teachers and students, including assigned teachers", async () => {
  for (const role of ["platform", "owner", "admin", "head_teacher"])
    assert.equal(
      await requireAnalyticsCentre(context(role).client, "centre", true),
      "actor",
    );
  for (const role of ["teacher", "student"])
    await assert.rejects(
      requireAnalyticsCentre(context(role, true).client, "centre", true),
      AnalyticsForbidden,
    );
  await assert.rejects(
    requireAnalyticsCentre(
      context("owner", false, "other-centre").client,
      "centre",
      true,
    ),
    AnalyticsForbidden,
  );
});
test("feature gates deny before analytics rows or privileged evidence are read", async () => {
  const fixture = context("owner");
  await assert.rejects(
    requireAnalyticsClass(fixture.client, "class", async () => false),
    AnalyticsForbidden,
  );
  await assert.rejects(
    requireAnalyticsCentre(fixture.client, "centre", false),
    AnalyticsForbidden,
  );
  assert.ok(
    !fixture.requests.some((url) =>
      /criterion_evidence|writing_responses|ielts_attempts/.test(url.pathname),
    ),
  );
});
test("invalid action boundaries and unavailable sources return safe explicit failures", async () => {
  assert.throws(() =>
    ClassAnalyticsSchema.parse({ classId: "bad", days: 365 }),
  );
  assert.throws(() =>
    PostMockExportSchema.parse({ classId: "bad", assignmentId: "other" }),
  );
  assert.deepEqual(
    await analyticsAction(async () => {
      throw new Error("private database detail");
    }),
    { ok: false, error: "unavailable" },
  );
  assert.deepEqual(
    await analyticsAction(async () => {
      throw new AnalyticsForbidden();
    }),
    { ok: false, error: "forbidden" },
  );
});
