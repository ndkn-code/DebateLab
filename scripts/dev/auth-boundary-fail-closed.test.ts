import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("development bypass entrypoints are removed", () => {
  assert.equal(
    existsSync(path.join(repoRoot, "apps/web/src/lib/dev-auth-bypass.ts")),
    false,
  );
  assert.equal(
    existsSync(path.join(repoRoot, "apps/web/src/lib/dev-admin-bypass.ts")),
    false,
  );
  assert.equal(
    existsSync(path.join(repoRoot, "apps/web/src/app/api/dev/auth-bypass/route.ts")),
    false,
  );
});

test("request authentication no longer recognizes a synthetic source", () => {
  const requestAuth = readFileSync(
    path.join(repoRoot, "apps/web/src/lib/api/request-auth.ts"),
    "utf8",
  );
  assert.doesNotMatch(requestAuth, /synthetic|bypass/);
  assert.match(requestAuth, /authSource: "cookie"/);
  assert.match(requestAuth, /authSource: null/);
});

test("admin checks use persisted profile roles", () => {
  const adminAuth = readFileSync(
    path.join(repoRoot, "apps/web/src/lib/auth/admin.ts"),
    "utf8",
  );
  assert.doesNotMatch(adminAuth, /synthetic|bypass/);
  assert.match(adminAuth, /profile\?\.role === "admin"/);
});
