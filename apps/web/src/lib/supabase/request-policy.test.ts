import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  classifyAuthError,
  hasAuthorizationHeader,
  hasSupabaseAuthCookie,
  isPublicRequest,
  recoveryPath,
} from "./request-policy";

function request(
  path: string,
  init?: { headers?: HeadersInit; method?: string; body?: BodyInit },
) {
  return new NextRequest(`http://localhost${path}`, init);
}

test("public and telemetry routes do not require a middleware session refresh", () => {
  assert.equal(isPublicRequest(request("/fonts/inter.woff2")), true);
  assert.equal(isPublicRequest(request("/vi/auth/login")), true);
  assert.equal(isPublicRequest(request("/vi/auth/recovery?next=%2Fvi%2Fchat")), true);
  assert.equal(isPublicRequest(request("/vi/guides/intro")), true);
  assert.equal(isPublicRequest(request("/api/public/maintenance")), true);
  assert.equal(isPublicRequest(request("/api/analytics/events")), true);
  assert.equal(isPublicRequest(request("/vi/ielts/home")), false);
  assert.equal(isPublicRequest(request("/api/sessions")), false);
});

test("cookie and bearer credentials are detected independently", () => {
  assert.equal(
    hasSupabaseAuthCookie(
      request("/en/dashboard", {
        headers: { cookie: "sb-fixture-auth-token.0=opaque" },
      }),
    ),
    true,
  );
  assert.equal(
    hasAuthorizationHeader(
      request("/api/dashboard", { headers: { authorization: "Bearer opaque" } }),
    ),
    true,
  );
});

test("auth errors separate invalid credentials from provider outages", () => {
  assert.equal(classifyAuthError({ status: 401 }), "invalid");
  assert.equal(classifyAuthError({ status: 504, message: "invalid jwt" }), "unavailable");
  assert.equal(classifyAuthError(new DOMException("deadline", "AbortError")), "unavailable");
  assert.equal(classifyAuthError(new Error("unexpected provider failure")), "unavailable");
});

test("recovery keeps locale and the complete intended URL", () => {
  assert.equal(
    recoveryPath(request("/vi/ielts/home?tab=today")),
    "/vi/auth/recovery?next=%2Fvi%2Fielts%2Fhome%3Ftab%3Dtoday",
  );
  assert.match(recoveryPath(request("/dashboard", { headers: { cookie: "NEXT_LOCALE=vi" } })), /^\/vi\/auth\/recovery/);
});
