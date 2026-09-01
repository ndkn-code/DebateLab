import assert from "node:assert/strict";
import test from "node:test";

import { resolveIeltsCoachActionDestination } from "./actions";
import { buildIeltsCoachChatRequest } from "./request";

const ASSIGNMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ATTEMPT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("IELTS Coach requests always carry an explicit isolated product context", () => {
  const request = buildIeltsCoachChatRequest({
    message: "  Help me improve coherence  ",
    conversationId: null,
    requestId: "request-1",
    locale: "en",
  });

  assert.deepEqual(request, {
    message: "Help me improve coherence",
    requestId: "request-1",
    context: "ielts-coach",
    productContext: "ielts",
    subjectContext: "ielts",
    practiceLanguage: "en",
    googleAiConsent: false,
  });
  assert.equal("conversationId" in request, false);
});

test("authorized coach actions resolve only to deterministic IELTS destinations", () => {
  const assignment = resolveIeltsCoachActionDestination({
    locale: "en",
    action: {
      kind: "start_assignment",
      resourceId: ASSIGNMENT_ID,
      skill: "writing",
      criterion: "task_response",
      label: "Start assignment",
    },
  });
  assert.equal(
    assignment?.href,
    `/en/ielts/assigned?assignment=${ASSIGNMENT_ID}`,
  );

  const feedback = resolveIeltsCoachActionDestination({
    locale: "vi",
    action: {
      kind: "review_feedback",
      resourceId: ATTEMPT_ID,
      skill: "speaking",
      criterion: "pronunciation",
      label: "Xem phản hồi",
    },
  });
  assert.equal(feedback?.href, `/vi/ielts/attempts/${ATTEMPT_ID}/results`);

  const speaking = resolveIeltsCoachActionDestination({
    locale: "en",
    action: {
      kind: "start_practice",
      resourceId: "ielts-practice:speaking:pronunciation",
      skill: "speaking",
      criterion: "pronunciation",
      label: "Start drill",
    },
  });
  assert.equal(speaking?.href, "/en/ielts/speaking-rehearsal");

  const indexedWriting = resolveIeltsCoachActionDestination({
    locale: "en",
    action: {
      kind: "start_practice",
      resourceId:
        "ielts-practice:writing:task_response:coach-writing-task-2-v1:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      skill: "writing",
      criterion: "task_response",
      label: "Start recommended drill",
    },
  });
  assert.equal(
    indexedWriting?.href,
    "/en/ielts/mock/coach-writing-task-2-v1?source=ielts-coach&focusQuestion=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );

  const deterministicSpeaking = resolveIeltsCoachActionDestination({
    locale: "en",
    action: {
      kind: "start_practice",
      resourceId:
        "ielts-practice:speaking:fluency_and_coherence:coach-speaking-v1:f9fadc68-2b59-150e-759b-e866be5f38e5",
      skill: "speaking",
      criterion: "fluency_and_coherence",
      label: "Start recommended drill",
    },
  });
  assert.equal(
    deterministicSpeaking?.href,
    "/en/ielts/mock/coach-speaking-v1?source=ielts-coach&focusQuestion=f9fadc68-2b59-150e-759b-e866be5f38e5&experience=speaking_rehearsal",
  );

  const plan = resolveIeltsCoachActionDestination({
    locale: "en",
    action: {
      kind: "open_study_plan",
      resourceId: "ielts-study-plan",
      skill: "reading",
      criterion: "reading",
      label: "Open plan",
    },
  });
  assert.equal(plan?.href, "/en/ielts/study-plan");
});

test("client action resolution fails closed on model-authored ids or URLs", () => {
  const unsafeAssignment = resolveIeltsCoachActionDestination({
    locale: "en",
    action: {
      kind: "start_assignment",
      resourceId: "https://example.com/steal",
      skill: "writing",
      label: "Unsafe",
    },
  });
  const mismatchedPractice = resolveIeltsCoachActionDestination({
    locale: "en",
    action: {
      kind: "start_practice",
      resourceId: "ielts-practice:writing:task_response",
      skill: "speaking",
      label: "Mismatch",
    },
  });
  const inventedPlan = resolveIeltsCoachActionDestination({
    locale: "en",
    action: {
      kind: "open_study_plan",
      resourceId: "another-plan",
      skill: "reading",
      label: "Invented",
    },
  });

  assert.equal(unsafeAssignment, null);
  assert.equal(mismatchedPractice, null);
  assert.equal(inventedPlan, null);
});
