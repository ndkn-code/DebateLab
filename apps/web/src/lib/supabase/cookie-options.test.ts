import assert from "node:assert/strict";
import test from "node:test";
import { getSupabaseCookieOptions } from "./cookie-options";

test("production Supabase cookies are secure and consistently scoped", () => {
  assert.deepEqual(
    getSupabaseCookieOptions({ httpOnly: false, secure: false }, "production"),
    {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/",
    },
  );
});

test("local development does not force Secure onto HTTP cookies", () => {
  assert.deepEqual(getSupabaseCookieOptions({}, "development"), {
    sameSite: "lax",
    path: "/",
  });
});
