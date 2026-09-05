import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "./middleware";

const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

function sessionCookie(session: Record<string, unknown>) {
  return `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}

function makeRequest(cookie: string, method = "GET") {
  return new NextRequest("http://localhost/vi/dashboard?tab=recent", {
    method,
    headers: { cookie: `sb-fixture-auth-token=${cookie}` },
    ...(method === "POST" ? { body: "fixture=body", headers: { "content-type": "application/x-www-form-urlencoded", cookie: `sb-fixture-auth-token=${cookie}` } } : {}),
  });
}

function liveSession(accessToken = "opaque") {
  return sessionCookie({
    access_token: accessToken,
    refresh_token: "refresh",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: "fixture-user",
      aud: "authenticated",
      role: "authenticated",
      email: "fixture@example.test",
    },
  });
}

function installFetch(handler: (input: string, init?: RequestInit) => Promise<Response>) {
  const previous = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  return () => {
    globalThis.fetch = previous;
  };
}

test("provider failure returns 503 and keeps the incoming cookie", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-only";
  const cookie = liveSession();
  const restore = installFetch(async () =>
    new Response(JSON.stringify({ error: "upstream unavailable" }), { status: 503 }),
  );
  try {
    const request = new NextRequest("http://localhost/api/sessions/end", {
      headers: { cookie: `sb-fixture-auth-token=${cookie}` },
    });
    const response = await updateSession(
      request,
      undefined,
      { deadlineMs: 50 },
    );
    assert.equal(response.status, 503);
    assert.equal(request.cookies.get("sb-fixture-auth-token")?.value, cookie);
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally {
    restore();
    restoreEnv();
  }
});

test("abort deadline reaches the provider and returns recovery without late cookie writes", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-only";
  const cookie = liveSession();
  let aborted = false;
  const restore = installFetch(async (_input, init) =>
    new Promise<Response>(() => {
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
      });
    }),
  );
  try {
    const request = makeRequest(cookie);
    const response = await updateSession(request, undefined, { deadlineMs: 20 });
    assert.equal(response.status, 307);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(aborted, true);
    assert.equal(request.cookies.get("sb-fixture-auth-token")?.value, cookie);
  } finally {
    restore();
    restoreEnv();
  }
});

test("expired sessions refresh and propagate the completed cookie set", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-only";
  const oldSession = {
    access_token: "old-access",
    refresh_token: "old-refresh",
    expires_in: 3600,
    expires_at: 1,
    token_type: "bearer",
    user: { id: "fixture-user", aud: "authenticated", role: "authenticated", email: "fixture@example.test" },
  };
  const freshSession = {
    access_token: "fresh-access",
    refresh_token: "fresh-refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "fixture-user", aud: "authenticated", role: "authenticated", email: "fixture@example.test" },
  };
  const calls: string[] = [];
  const restore = installFetch(async (input) => {
    calls.push(input);
    if (input.includes("grant_type=refresh_token")) {
      return new Response(JSON.stringify({ ...freshSession, expires_at: Math.floor(Date.now() / 1000) + 3600 }), { status: 200 });
    }
    return new Response(JSON.stringify(freshSession.user), { status: 200 });
  });
  try {
    const request = makeRequest(sessionCookie(oldSession));
    const intl = NextResponse.next({ request });
    intl.headers.set("x-middleware-rewrite", "http://localhost/vi/dashboard?tab=recent");
    intl.headers.set("x-middleware-override-headers", "x-nonce,cookie");
    intl.headers.set("x-middleware-request-x-nonce", "fixture-nonce");
    intl.cookies.set("NEXT_LOCALE", "vi");
    const response = await updateSession(request, intl);
    assert.equal(response.status, 200);
    assert.ok(calls.some((input) => input.includes("grant_type=refresh_token")));
    assert.equal(response.headers.get("x-middleware-request-x-nonce"), "fixture-nonce");
    assert.equal(response.cookies.get("NEXT_LOCALE")?.value, "vi");
    assert.equal(response.headers.get("x-middleware-request-cookie"), request.headers.get("cookie"));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const setCookie = response.headers.getSetCookie().join(";");
    assert.match(Buffer.from(setCookie.match(/base64-([^;]+)/)?.[1] ?? "", "base64url").toString(), /fresh-access/);
    assert.match(Buffer.from(request.cookies.get("sb-fixture-auth-token")?.value.slice("base64-".length) ?? "", "base64url").toString(), /fresh-access/);
  } finally {
    restore();
    restoreEnv();
  }
});

test("non-GET auth outage returns 503 while preserving the forwarded request body", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-only";
  const cookie = liveSession();
  const restore = installFetch(async () => new Response("upstream", { status: 503 }));
  try {
    const request = makeRequest(cookie, "POST");
    const response = await updateSession(request, NextResponse.next({ request }), { deadlineMs: 50 });
    assert.equal(response.status, 503);
    assert.equal(await request.text(), "fixture=body");
  } finally {
    restore();
    restoreEnv();
  }
});

function restoreEnv() {
  if (env.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = env.url;
  if (env.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.key;
}

test("a rotated refresh cookie survives a subsequent unavailable user check without granting access", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-only";
  const old = sessionCookie({ access_token: "old", refresh_token: "old-refresh", expires_at: 1, user: { id: "fixture" } });
  const restore = installFetch(async (input) => input.includes("grant_type=refresh_token")
    ? new Response(JSON.stringify({ access_token: "rotated", refresh_token: "rotated-refresh", expires_in: 3600, user: { id: "fixture" } }))
    : new Response(JSON.stringify({ message: "fixture unavailable" }), { status: 503 }));
  try {
    const request = new NextRequest("http://localhost/api/sessions/end", { method: "POST", headers: { cookie: `sb-fixture-auth-token=${old}` } });
    const response = await updateSession(request);
    assert.equal(response.status, 503);
    const value = response.cookies.get("sb-fixture-auth-token")?.value ?? "";
    assert.match(Buffer.from(value.slice("base64-".length), "base64url").toString(), /rotated-refresh/);
  } finally { restore(); restoreEnv(); }
});

test("late provider completion cannot mutate the returned recovery response or request", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-only";
  const cookie = liveSession();
  let finish: ((response: Response) => void) | undefined;
  const restore = installFetch(async () => new Promise<Response>((resolve) => { finish = resolve; }));
  try {
    const request = makeRequest(cookie);
    const response = await updateSession(request, undefined, { deadlineMs: 10 });
    const originalHeaders = [...response.headers];
    finish!(new Response(JSON.stringify({ id: "fixture-user" })));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual([...response.headers], originalHeaders);
    assert.equal(request.cookies.get("sb-fixture-auth-token")?.value, cookie);
  } finally { restore(); restoreEnv(); }
});

test("definite invalid credentials return 401 while public requests perform zero auth calls", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-only";
  let calls = 0;
  const restore = installFetch(async () => { calls++; return new Response(JSON.stringify({ code: "bad_jwt", message: "Invalid JWT" }), { status: 401 }); });
  try {
    for (const path of ["/vi/auth/recovery", "/vi/maintenance", "/api/public/maintenance", "/ingest/i/v0/e/", "/vi/guides/intro"]) {
      assert.equal((await updateSession(new NextRequest(`http://localhost${path}`, { headers: { cookie: `sb-fixture-auth-token=${liveSession()}` } }))).status, 200);
    }
    assert.equal(calls, 0);
    const response = await updateSession(new NextRequest("http://localhost/api/sessions/end", { method: "POST", headers: { cookie: `sb-fixture-auth-token=${liveSession()}` } }));
    assert.equal(response.status, 401);
  } finally { restore(); restoreEnv(); }
});
