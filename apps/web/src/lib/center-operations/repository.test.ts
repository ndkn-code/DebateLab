import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTeacherActions } from "./repository";
import type { CenterSnapshot } from "./contracts";

const studentId = "11111111-1111-4111-8111-111111111111";
const classId = "22222222-2222-4222-8222-222222222222";
const trialId = "33333333-3333-4333-8333-333333333333";
const snapshot: CenterSnapshot = {
  organizationId: "99999999-9999-4999-8999-999999999999",
  actorId: studentId,
  canManage: true,
  canManageFinance: true,
  classes: [{ id: classId, name: "Tuesday Debate" }],
  students: [
    {
      id: studentId,
      name: "An",
      code: null,
      linked: true,
      status: "lead",
      classIds: [],
    },
  ],
  admissions: [],
  trials: [
    {
      id: trialId,
      student_record_id: studentId,
      class_id: classId,
      starts_at: "2026-09-04T10:00:00+00:00",
      ends_at: "2026-09-04T11:00:00+00:00",
      timezone: "Asia/Ho_Chi_Minh",
      status: "booked",
      assessment: null,
      rebook_of: null,
      revision: 4,
    },
  ],
  schedules: [],
  notes: [],
  drafts: [],
  offers: [],
  invoices: [],
  connections: [],
  bindings: [],
  events: [],
};

test("normalizes validated teacher actions with confirmation semantics and revisions", () => {
  const actions = normalizeTeacherActions(
    [
      {
        kind: "trial.evaluate",
        trialId,
        assessment: {
          level: "B",
          strengths: "clear",
          weaknesses: "pace",
          recommendation: "Practice",
        },
      },
      {
        kind: "offer.create",
        studentRecordId: studentId,
        classId,
        amount: 100000,
        startDate: "2026-09-10",
        endDate: "2026-10-10",
      },
      { kind: "note.create", studentRecordId: studentId, body: "Follow up" },
    ],
    snapshot,
  );
  assert.deepEqual(actions[0], {
    kind: "trial.evaluate",
    input: {
      trialId,
      assessment: {
        level: "B",
        strengths: "clear",
        weaknesses: "pace",
        recommendation: "Practice",
      },
      expectedRevision: 4,
    },
    requiresConfirmation: false,
  });
  assert.equal(actions[1]?.requiresConfirmation, true);
  assert.equal(actions[2]?.requiresConfirmation, false);
});

test("rejects invalid or unsupported dynamic commands before any RPC boundary", () => {
  assert.throws(
    () => normalizeTeacherActions([{ kind: "database.drop" }], snapshot),
    /Invalid teacher command/,
  );
  assert.throws(
    () =>
      normalizeTeacherActions(
        [
          {
            kind: "offer.create",
            studentRecordId: studentId,
            classId,
            amount: 2_000_000_000,
            startDate: "2026-09-10",
            endDate: "2026-10-10",
          },
        ],
        snapshot,
      ),
    /Invalid teacher command/,
  );
});

test("hydrates an eligible rebook with the missed trial revision", () => {
  const noShow = {
    ...snapshot.trials[0],
    status: "no_show" as const,
    revision: 9,
  };
  const actions = normalizeTeacherActions(
    [
      {
        kind: "trial.rebook",
        priorTrialId: trialId,
        startAt: "2026-09-10T10:00:00+00:00",
        endAt: "2026-09-10T11:00:00+00:00",
      },
    ],
    { ...snapshot, trials: [noShow] },
  );
  assert.deepEqual(actions[0], {
    kind: "trial.rebook",
    input: {
      priorTrialId: trialId,
      startAt: "2026-09-10T10:00:00+00:00",
      endAt: "2026-09-10T11:00:00+00:00",
      expectedRevision: 9,
    },
    requiresConfirmation: true,
  });
});

test("rejects rebooking an attended or already replaced trial", () => {
  for (const trial of [
    { ...snapshot.trials[0], status: "attended" as const },
  ]) {
    assert.throws(
      () =>
        normalizeTeacherActions(
          [
            {
              kind: "trial.rebook",
              priorTrialId: trialId,
              startAt: "2026-09-10T10:00:00+00:00",
              endAt: "2026-09-10T11:00:00+00:00",
            },
          ],
          { ...snapshot, trials: [trial] },
        ),
      /trial|replacement/i,
    );
  }
  assert.throws(
    () =>
      normalizeTeacherActions(
        [
          {
            kind: "trial.rebook",
            priorTrialId: trialId,
            startAt: "2026-09-10T10:00:00+00:00",
            endAt: "2026-09-10T11:00:00+00:00",
          },
        ],
        {
          ...snapshot,
          trials: [
            { ...snapshot.trials[0], status: "no_show" },
            {
              ...snapshot.trials[0],
              id: classId,
              rebook_of: trialId,
              status: "no_show",
            },
          ],
        },
      ),
    /replacement/i,
  );
});

test("allows a no-show replacement only when it has no child replacement", () => {
  const replacement = {
    ...snapshot.trials[0],
    id: classId,
    rebook_of: trialId,
    status: "no_show" as const,
  };
  const actions = normalizeTeacherActions(
    [
      {
        kind: "trial.rebook",
        priorTrialId: classId,
        startAt: "2026-09-10T10:00:00+00:00",
        endAt: "2026-09-10T11:00:00+00:00",
      },
    ],
    { ...snapshot, trials: [snapshot.trials[0], replacement] },
  );
  assert.equal(actions[0]?.requiresConfirmation, true);
});
