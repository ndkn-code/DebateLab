import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

test("localized server-action POSTs retain a single request-body handoff and CSP", async () => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-only";
  try {
    const request = new NextRequest("http://localhost/en/dashboard", {
      method: "POST",
      headers: {
        "content-type": "text/plain;charset=UTF-8",
        "next-action": "fixture-action",
      },
      body: '[{"classId":"fixture"}]',
    });
    const response = await middleware(request);
    assert.equal(response.status, 200);
    assert.ok(
      response.headers.get("content-security-policy")?.includes("script-src"),
    );
    assert.equal(
      response.headers.get("x-middleware-request-x-thinkfy-pathname"),
      "/en/dashboard",
    );
    assert.equal(
      response.headers.get("x-middleware-request-next-action"),
      "fixture-action",
    );
  } finally {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  }
});
