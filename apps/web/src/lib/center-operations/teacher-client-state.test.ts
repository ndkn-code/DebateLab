import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePendingTeacherRequest,
  requestFromHistory,
  teacherErrorMessage,
  teacherStarterPrompts,
  teacherStorageKey,
} from "../../components/center-operations/teacher-assistant/client-state";
import type { CenterSnapshot, TeacherHistory } from "./contracts";

test("draft/retry storage is isolated by actor and organization", () => {
  assert.notEqual(
    teacherStorageKey("center-a", "teacher-a"),
    teacherStorageKey("center-a", "teacher-b"),
  );
  assert.notEqual(
    teacherStorageKey("center-a", "teacher-a"),
    teacherStorageKey("center-b", "teacher-a"),
  );
  assert.equal(parsePendingTeacherRequest("broken JSON"), null);
  assert.equal(
    parsePendingTeacherRequest(
      JSON.stringify({ key: "key", message: "note", startedAt: "invalid" }),
    ),
    null,
  );
});
test("failed request is recovered from durable user message with same idempotency key", () => {
  const history: TeacherHistory = {
    conversationId: "conversation",
    messages: [
      {
        id: "m1",
        role: "user",
        body: "Save a QA note",
        metadata: { requestKey: "stable-request-key" },
      },
    ],
    proposals: [],
    run: {
      requestKey: "stable-request-key",
      conversationId: "conversation",
      status: "failed",
      stage: "failed",
      startedAt: "2026-09-05T10:00:00Z",
      updatedAt: "2026-09-05T10:00:01Z",
      errorCode: "timeout",
    },
  };
  assert.equal(requestFromHistory(history)?.key, "stable-request-key");
  assert.equal(requestFromHistory(history)?.message, "Save a QA note");
});
test("teacher-facing errors hide database/provider internals in both locales", () => {
  for (const locale of ["en", "vi"] as const) {
    for (const failure of [
      "center_chat_complete SQL failed",
      "invalid JSON stack",
      "timeout",
      "Forbidden 42501",
    ]) {
      const message = teacherErrorMessage(failure, locale);
      assert.ok(message.length > 20);
      assert.doesNotMatch(message, /center_chat|SQL|JSON|42501/);
    }
  }
  assert.match(teacherErrorMessage("timeout", "vi"), /thời gian/);
});
test("starter prompts use assigned class names and never raw identifiers", () => {
  const snapshot = {
    classes: [{ id: "secret-class-id", name: "QA Debate" }],
  } as CenterSnapshot;
  for (const locale of ["en", "vi"] as const) {
    const prompts = teacherStarterPrompts(snapshot, locale, "secret-class-id");
    assert.ok(prompts[0].includes("QA Debate"));
    assert.ok(prompts.every((prompt) => !prompt.includes("secret-class-id")));
  }
});
