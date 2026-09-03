import assert from "node:assert/strict";
import test from "node:test";
import { assertLoopbackSupabaseUrl } from "./seed-local-admin";

test("accepts loopback Supabase URLs", () => {
  assert.equal(assertLoopbackSupabaseUrl("http://127.0.0.1:54321").hostname, "127.0.0.1");
  assert.equal(assertLoopbackSupabaseUrl("http://localhost:54321").hostname, "localhost");
  assert.equal(assertLoopbackSupabaseUrl("http://[::1]:54321").hostname, "[::1]");
});

test("refuses malformed and non-loopback Supabase URLs", () => {
  assert.throws(() => assertLoopbackSupabaseUrl(undefined), /required/);
  assert.throws(() => assertLoopbackSupabaseUrl("not-a-url"), /valid URL/);
  assert.throws(() => assertLoopbackSupabaseUrl("https://project.supabase.co"), /non-loopback/);
});
