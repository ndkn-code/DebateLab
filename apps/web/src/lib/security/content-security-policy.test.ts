import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildContentSecurityPolicy,
  createContentSecurityPolicyContext,
  createCspNonce,
  setContentSecurityPolicyResponseHeader,
  SONNER_STYLE_SHA256,
} from "./content-security-policy";

test("creates unique nonce-based production policy", () => {
  const first = createCspNonce();
  const second = createCspNonce();
  assert.notEqual(first, second);
  const policy = buildContentSecurityPolicy({ nonce: first });
  assert.match(
    policy,
    new RegExp(`script-src 'self' 'nonce-${first}' 'strict-dynamic'`),
  );
  assert.match(policy, /script-src-attr 'none'/);
  assert.match(policy, /style-src-elem 'self' 'nonce-/);
  assert.match(policy, new RegExp(SONNER_STYLE_SHA256.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(policy, /style-src-attr 'unsafe-inline'/);
  assert.match(policy, /upgrade-insecure-requests/);
  assert.doesNotMatch(policy, /'unsafe-eval'/);
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/);
});

test("allows eval only in development and retains configured Faro origin", () => {
  const policy = buildContentSecurityPolicy({
    nonce: "dev-nonce",
    isDevelopment: true,
    grafanaFaroCollectorUrl: "https://faro.example.test/collect",
  });
  assert.match(policy, /script-src[^;]*'unsafe-eval'/);
  assert.match(policy, /connect-src[^;]*https:\/\/faro\.example\.test/);
  assert.match(policy, /http:\/\/localhost:54321/);
  assert.doesNotMatch(policy, /upgrade-insecure-requests/);
});

test("forwards and returns the exact same policy while replacing spoofed nonce headers", () => {
  const context = createContentSecurityPolicyContext(
    new Headers({ "x-nonce": "attacker-controlled" }),
  );
  const responseHeaders = new Headers();
  setContentSecurityPolicyResponseHeader(responseHeaders, context.value);

  assert.notEqual(context.nonce, "attacker-controlled");
  assert.equal(context.requestHeaders.get("x-nonce"), context.nonce);
  assert.equal(
    context.requestHeaders.get("Content-Security-Policy"),
    context.value,
  );
  assert.equal(responseHeaders.get("Content-Security-Policy"), context.value);
});

test("Sonner's exact runtime stylesheet matches the CSP hash", () => {
  const source = readFileSync(
    new URL(
      "../../../../../node_modules/sonner/dist/index.mjs",
      import.meta.url,
    ),
    "utf8",
  );
  const injection = source
    .split("\n")
    .find((line) => line.startsWith("__insertCSS("));
  assert.ok(injection, "Sonner stylesheet injection must remain discoverable");
  const css = JSON.parse(injection.slice("__insertCSS(".length, -2)) as string;
  const hash = createHash("sha256").update(css).digest("base64");
  assert.equal(`'sha256-${hash}'`, SONNER_STYLE_SHA256);
});
