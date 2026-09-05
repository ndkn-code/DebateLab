import assert from "node:assert/strict";

import {
  classifyTeacherWorkspaceFailure,
  newTeacherWorkspaceIdempotencyKey,
  teacherWorkspaceFailureMessage,
  teacherWorkspaceWriteFailure,
  TEACHER_WORKSPACE_FAILURES,
} from "./write-seam";

// Every raw RPC string a teacher can trigger maps to a code, never to "unknown".
const raw: Array<[string, string]> = [
  ["STALE_UPDATE", "stale"],
  ["IDEMPOTENCY_KEY_REUSED", "replayed"],
  ["IDEMPOTENCY_KEY_REQUIRED", "invalid"],
  ["UNAUTHORIZED", "unauthorized"],
  ["FORBIDDEN", "forbidden"],
  ["ATTENDANCE_OCCURRENCE_REQUIRED", "register_closed"],
  ["INVALID_GRADE", "invalid"],
  ["INVALID_ATTENDANCE_STATUS", "invalid"],
  ["Attendance user was not enrolled in this class on the session date", "invalid"],
  ["permission denied for table class_attendance_sessions", "forbidden"],
  ["teacher workspace auth: Auth session missing!", "unauthorized"],
];
for (const [message, expected] of raw) {
  assert.equal(
    classifyTeacherWorkspaceFailure(new Error(message)),
    expected,
    `expected ${message} -> ${expected}`,
  );
}

// A Zod rejection is a sentence, not a code, and must read as a field problem.
assert.equal(
  classifyTeacherWorkspaceFailure(new Error("Score cannot exceed maximum.")),
  "invalid",
);
// An unrecognised bare code must not be mislabelled as a field problem.
assert.equal(classifyTeacherWorkspaceFailure(new Error("SOME_NEW_CODE")), "unknown");
assert.equal(classifyTeacherWorkspaceFailure(undefined), "unknown");

// Both locales are populated for every failure, and they differ.
for (const failure of TEACHER_WORKSPACE_FAILURES) {
  const en = teacherWorkspaceFailureMessage(failure, "en");
  const vi = teacherWorkspaceFailureMessage(failure, "vi");
  assert.ok(en.length > 20, `${failure} EN copy is too short`);
  assert.ok(vi.length > 20, `${failure} VI copy is too short`);
  assert.notEqual(en, vi, `${failure} is not translated`);
  // A teacher mid-class must be told whether their edit landed.
  assert.match(
    `${en} ${vi}`,
    /not saved|Nothing was changed|chưa được lưu|chưa có gì được lưu|reload|Reload|tải lại|đăng nhập|cannot be corrected|chưa thể sửa/,
    `${failure} copy does not say what happened to the edit`,
  );
}

const failure = teacherWorkspaceWriteFailure(new Error("STALE_UPDATE"), "vi");
assert.equal(failure.ok, false);
assert.equal(failure.failure, "stale");
assert.equal(failure.message, teacherWorkspaceFailureMessage("stale", "vi"));

// Keys satisfy the repository schema (trimmed, 8..200 chars) and are unique.
const keys = new Set<string>();
for (let index = 0; index < 200; index += 1) {
  const key = newTeacherWorkspaceIdempotencyKey("grade");
  assert.ok(key.length >= 8 && key.length <= 200, `bad key length: ${key}`);
  assert.equal(key, key.trim());
  assert.ok(key.startsWith("tw-grade-"));
  keys.add(key);
}
assert.equal(keys.size, 200, "idempotency keys collided");

console.log("teacher workspace write seam tests passed");
