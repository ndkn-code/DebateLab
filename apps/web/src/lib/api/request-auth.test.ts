import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { requireRequestAuth } from "./request-auth";

test("bearer APIs preserve 401 versus dependency 503 and require authoritative identity", async () => {
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-only";
  const request = () => new NextRequest("https://fixture.invalid/api/fixture", { method: "POST", headers: { authorization: "Bearer fixture-access-token" }, body: "fixture" });
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ id: "fixture-user", aud: "authenticated", app_metadata: {}, user_metadata: {} }), { status: 200, headers: { "content-type": "application/json" } });
    const success = await requireRequestAuth(request());
    assert.equal(success.ok, true);
    if (success.ok) { assert.equal(success.user.id, "fixture-user"); assert.equal(success.authSource, "bearer"); }
    for (const [providerStatus, expected] of [[401, 401], [503, 503]]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ message: "fixture provider failure" }), { status: providerStatus, headers: { "content-type": "application/json" } });
      const result = await requireRequestAuth(request());
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.errorResponse.status, expected);
        if (expected === 503) assert.equal(result.errorResponse.headers.get("retry-after"), "30");
      }
    }
    globalThis.fetch = async () => new Promise(() => {});
    const start = Date.now();
    const unavailable = await requireRequestAuth(request());
    assert.equal(unavailable.ok, false);
    if (!unavailable.ok) assert.equal(unavailable.errorResponse.status, 503);
    assert.ok(Date.now() - start < 5_000);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  }
});
