import assert from "node:assert/strict";
import test from "node:test";
import { currentResponseRows, latestByKey } from "./deterministic-selection";

test("current response selects revision, then updated time, then id", () => {
  const candidates = [
    { id: "z", task_number: 1, revision: 1, updated_at: "2026-08-29T10:00:00Z" },
    { id: "a", task_number: 1, revision: 2, updated_at: "2026-08-28T10:00:00Z" },
    { id: "b", task_number: 1, revision: 2, updated_at: "2026-08-29T10:00:00Z" },
    { id: "c", task_number: 1, revision: 2, updated_at: "2026-08-29T10:00:00Z" },
  ];
  const selected = currentResponseRows(candidates, "task_number");
  assert.equal(selected[0]?.id, "c");
  assert.equal(currentResponseRows(candidates.toReversed(), "task_number")[0]?.id, "c");
});

test("latest keyed row is deterministic when timestamps tie", () => {
  const selected = latestByKey([
    { id: "0001", user_id: "u", assignment_id: "a", created_at: "2026-08-29T10:00:00Z" },
    { id: "0002", user_id: "u", assignment_id: "a", created_at: "2026-08-29T10:00:00Z" },
  ], ["user_id", "assignment_id"]);
  assert.equal(selected.get("u:a")?.id, "0002");
});
