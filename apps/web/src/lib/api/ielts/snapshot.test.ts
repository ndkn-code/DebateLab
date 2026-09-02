/**
 * Unit tests for the content-version snapshot builder (WS-1.1). Asserts the
 * security-relevant property that snapshots EMBED answer keys (hence the table is
 * admin-only).
 */
import assert from "node:assert/strict";
import { buildTestSnapshot } from "./snapshot";
import type { IeltsTestTree } from "./tree";

const tree = {
  test: { id: "t1", version: 3, status: "published", slug: "mock-1", title: "Mock 1" },
  passages: [{ id: "p1", title: "Passage" }],
  listeningSections: [],
  questions: [
    {
      id: "q1",
      prompt: "A statement.",
      key: { question_id: "q1", correct_answer: "SECRET_ANSWER", model_answer: null },
    },
  ],
  questionGroups: [
    {
      id: "g1",
      group_key: "headings-1",
      bank: [{ id: "i", label: "i", text: "A heading" }],
      stimulus: null,
      any_order: false,
    },
  ],
} as unknown as IeltsTestTree;

const snap = buildTestSnapshot(tree);
assert.equal(snap.schema, "ielts.test.v1");
assert.equal(snap.capturedVersion, 3);
assert.ok(
  JSON.stringify(snap).includes("SECRET_ANSWER"),
  "snapshot must embed answer keys (so the versions table is admin-only)",
);
// Question groups ride along (shared banks / stimuli are content too).
assert.equal((snap.questionGroups as Array<{ group_key: string }>)[0]?.group_key, "headings-1");
assert.ok(JSON.stringify(snap).includes("A heading"));

// Old trees (pre-groups) still snapshot, with an empty group list.
const legacySnap = buildTestSnapshot({ ...tree, questionGroups: undefined } as unknown as IeltsTestTree);
assert.deepEqual(legacySnap.questionGroups, []);
assert.equal(legacySnap.schema, "ielts.test.v1");

console.log("IELTS snapshot tests passed");
