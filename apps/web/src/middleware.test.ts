import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { updateSession } from "./lib/supabase/middleware";

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

test("a session provider that ignores aborts cannot stall or mutate cookies", async () => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const oldFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-only";
  globalThis.fetch = (() => new Promise<Response>(() => undefined)) as typeof fetch;
  try {
    const cookie = "base64-" + Buffer.from(JSON.stringify({ access_token: "fixture", refresh_token: "fixture", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "fixture" } })).toString("base64url");
    const request = new NextRequest("http://localhost/vi/ielts/home?tab=today", {
      headers: { cookie: `sb-fixture-auth-token.0=${cookie}` },
    });
    const response = await updateSession(request, undefined, { deadlineMs: 10 });
    assert.equal(response.status, 307);
    assert.equal(request.cookies.get("sb-fixture-auth-token.0")?.value, cookie);
    assert.match(response.headers.get("location") ?? "", /\/vi\/auth\/recovery/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  }
});
