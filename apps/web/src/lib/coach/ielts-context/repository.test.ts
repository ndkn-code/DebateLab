import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import { loadIeltsCoachContext } from "./build";
import { createIeltsCoachEvidenceRepository } from "./repository";

const LEARNER_ID = "00000000-0000-4000-8000-000000000001";
const CLASS_ID = "00000000-0000-4000-8000-000000000002";

function preparedPayload(learnerId = LEARNER_ID) {
  return {
    learnerId,
    activeIeltsClassIds: [CLASS_ID],
    goal: {
      userId: LEARNER_ID,
      targetOverallBand: 7,
      targetWritingBand: 7.5,
      targetTestDate: "2026-12-01",
    },
    attempts: [
      {
        attemptId: "00000000-0000-4000-8000-000000000003",
        occurredAt: "2026-08-31T12:00:00.000Z",
      },
    ],
    skillStates: [],
    bandScores: [],
    writingResponses: [
      {
        id: "00000000-0000-4000-8000-000000000004",
        attemptId: "00000000-0000-4000-8000-000000000003",
        userId: LEARNER_ID,
        revision: 2,
        taskNumber: 2,
        taskBand: 6.5,
        taskResponseBand: 6,
        coherenceCohesionBand: 6.5,
        lexicalResourceBand: 6.5,
        grammarBand: 6,
        gradingMetadata: { confidence: 0.72, gradingVersion: "grader-v1" },
        scoredAt: "2026-08-31T12:00:00.000Z",
        updatedAt: "2026-08-31T12:00:00.000Z",
      },
    ],
    speakingResponses: [],
    publishedTeacherFeedback: [
      {
        id: "00000000-0000-4000-8000-000000000005",
        userId: LEARNER_ID,
        classId: CLASS_ID,
        attemptId: "00000000-0000-4000-8000-000000000003",
        writingResponseId: "00000000-0000-4000-8000-000000000004",
        speakingResponseId: null,
        reviewKind: "writing",
        revision: 2,
        publishedAt: "2026-08-31T13:00:00.000Z",
        taskBand: 7,
        taskResponseBand: 6.5,
        criterionFeedback: {
          taskResponse: "Keep one position throughout.",
        },
      },
    ],
    assignedWork: [],
  };
}

test("default repository loads one prepared snapshot and preserves teacher precedence", async () => {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      return { data: preparedPayload(), error: null };
    },
  } as unknown as SupabaseClient<Database>;

  const result = await loadIeltsCoachContext({
    request: {
      product: "ielts",
      subject: "ielts",
      learnerId: LEARNER_ID,
      sessionUserId: LEARNER_ID,
      conversationId: "00000000-0000-4000-8000-000000000006",
      locale: "en",
      classId: CLASS_ID,
    },
    repository: createIeltsCoachEvidenceRepository(client),
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected context");
  assert.deepEqual(rpcCalls, [
    {
      name: "load_ielts_coach_prepared_context",
      args: { p_learner_id: LEARNER_ID, p_max_recent_attempts: 12 },
    },
  ]);
  assert.equal(result.context.recentAttempts[0]?.band, 7);
  assert.equal(
    result.context.recentAttempts[0]?.authority,
    "teacher_confirmed",
  );
  assert.equal(
    result.context.recentAttempts[0]?.criteria[0]?.authority,
    "teacher_confirmed",
  );
});

test("prepared snapshot learner mismatch fails closed", async () => {
  const client = {
    async rpc() {
      return { data: preparedPayload("another-learner"), error: null };
    },
  } as unknown as SupabaseClient<Database>;
  const result = await loadIeltsCoachContext({
    request: {
      product: "ielts",
      subject: "ielts",
      learnerId: LEARNER_ID,
      sessionUserId: LEARNER_ID,
      conversationId: "00000000-0000-4000-8000-000000000006",
      locale: "en",
    },
    repository: createIeltsCoachEvidenceRepository(client),
  });
  assert.deepEqual(result, {
    ok: false,
    reason: "evidence_unavailable",
    retryable: true,
  });
});
