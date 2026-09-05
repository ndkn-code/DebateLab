import assert from "node:assert/strict";
import test from "node:test";
import { isEnrolledStudent, loadIeltsEnrollmentState, type IeltsEnrollmentClient } from "./enrollment";

function fixture(result: { data: unknown; error: unknown }) {
  const query = { select() { return this; }, eq() { return this; }, limit() { return Promise.resolve(result); } };
  return { from() { return query; } } as unknown as IeltsEnrollmentClient;
}

test("unavailable enrollment stays denied while shell can disclose missing navigation", async () => {
  const client = fixture({ data: null, error: { message: "fixture unavailable", status: 503 } });
  assert.equal(await isEnrolledStudent("fixture-user", client), false);
  assert.deepEqual(await loadIeltsEnrollmentState("fixture-user", client), { status: "unavailable" });
});

test("confirmed no enrollment is distinct from unavailable", async () => {
  const client = fixture({ data: [], error: null });
  assert.deepEqual(await loadIeltsEnrollmentState("fixture-user", client), { status: "available", enrolled: false });
});
