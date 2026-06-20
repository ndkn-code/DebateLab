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
} as unknown as IeltsTestTree;

const snap = buildTestSnapshot(tree);
assert.equal(snap.schema, "ielts.test.v1");
assert.equal(snap.capturedVersion, 3);
assert.ok(
  JSON.stringify(snap).includes("SECRET_ANSWER"),
  "snapshot must embed answer keys (so the versions table is admin-only)",
);

console.log("IELTS snapshot tests passed");
