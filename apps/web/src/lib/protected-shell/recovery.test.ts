import assert from "node:assert/strict";
import test from "node:test";
import type { User } from "@supabase/supabase-js";
import { boundedFetch, withinDeadline } from "./deadline";
import { verifyIdentity } from "./identity";
import { recoveryDestination, shellRecoveryUrl } from "./recovery";

const user = { id: "fixture-user" } as User;

test("identity requires authoritative success, never an accompanying user on error", async () => {
  assert.deepEqual(await verifyIdentity(async () => ({ data: { user }, error: null })), { status: "authenticated", user });
  for (const error of [{ status: 401 }, { code: "bad_jwt" }, { name: "AuthSessionMissingError" }]) {
    assert.deepEqual(await verifyIdentity(async () => ({ data: { user }, error })), { status: "anonymous" });
  }
  for (const error of [{ status: 504, message: "invalid JWT service upstream" }, { status: 429 }, new Error("network failed"), new Error("unknown provider fault")]) {
    assert.deepEqual(await verifyIdentity(async () => ({ data: { user }, error })), { status: "unavailable" });
  }
});

test("never-resolving identity resolves unavailable within its total deadline", async () => {
  const started = Date.now();
  assert.deepEqual(await verifyIdentity(() => new Promise(() => {}), 20), { status: "unavailable" });
  assert.ok(Date.now() - started < 500);
});

test("deadline handles rejection arriving after timeout and aborts the transport", async () => {
  let signal: AbortSignal | null | undefined;
  const transport = boundedFetch(20, async (_input, init) => {
    signal = init?.signal;
    return new Promise(() => {});
  });
  await assert.rejects(() => transport("http://fixture.invalid"), /temporarily unavailable/);
  assert.equal(signal?.aborted, true);
  await assert.rejects(() => withinDeadline(() => new Promise((_, reject) => setTimeout(() => reject(new Error("late")), 40)), 10));
  await new Promise((resolve) => setTimeout(resolve, 50));
});

test("recovery retains localized intended path and queries, never an external URL or loop", () => {
  assert.equal(recoveryDestination("/en/dashboard/teacher/classes?classId=fixture", "vi"), "/vi/dashboard/teacher/classes?classId=fixture");
  for (const unsafe of ["https://example.com", "//example.com", "/auth/recovery", "/\\example.com", "/vi//example.com"]) {
    assert.equal(recoveryDestination(unsafe, "vi"), "/vi/dashboard");
  }
  assert.equal(new URL(shellRecoveryUrl("/vi/ielts/home?view=week", "vi"), "http://fixture.invalid").searchParams.get("next"), "/vi/ielts/home?view=week");
});
