import assert from "node:assert/strict";
import { test } from "node:test";
import {
  runClassJoin,
  manageInvitation,
  type ClassJoinDependencies,
} from "./service";
import {
  classJoinPath,
  isClassJoinCode,
  normalizeClassJoinCode,
} from "./contracts";
import { isAllowedAuthRedirect, resolveAuthRedirect } from "../auth/redirects";

const code = "0123456789abcdef0123456789abcdef";
const classId = "00000000-0000-4000-8000-000000000001";
function fixture(overrides: Partial<ClassJoinDependencies> = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const deps: ClassJoinDependencies = {
    userId: async () => "self",
    ieltsAccessible: async () => true,
    rpc: async (name, args) => {
      calls.push({ name, args });
      return {
        data: {
          status: name.startsWith("claim") ? "joined" : "ready",
          classId,
          classTitle: "QA only",
          programType: "debate",
        },
        error: null,
      };
    },
    ...overrides,
  };
  return { deps, calls };
}
test("only own session is claimable; unexpected target identity rejected", async () => {
  const { deps, calls } = fixture();
  assert.deepEqual(await runClassJoin({ code, userId: "other" }, true, deps), {
    status: "invalid",
  });
  assert.equal(calls.length, 0);
  assert.equal((await runClassJoin({ code }, true, deps)).status, "joined");
  assert.deepEqual(
    calls.map((c) => c.args),
    [{ p_code: code }, { p_code: code }],
  );
});
test("anonymous never resolves metadata or claims", async () => {
  const { deps, calls } = fixture({ userId: async () => null });
  assert.equal(
    (await runClassJoin({ code }, true, deps)).status,
    "sign_in_required",
  );
  assert.equal(calls.length, 0);
});
test("IELTS gate suppresses metadata and mutation", async () => {
  let claims = 0;
  const { deps } = fixture({
    ieltsAccessible: async () => false,
    rpc: async (name) => {
      if (name.startsWith("claim")) claims++;
      return {
        data: { status: "ready", programType: "ielts", classTitle: "private" },
        error: null,
      };
    },
  });
  assert.deepEqual(await runClassJoin({ code }, true, deps), {
    status: "ineligible",
  });
  assert.equal(claims, 0);
});
test("non-ready states do not claim; transient errors are recoverable", async () => {
  for (const status of [
    "expired",
    "revoked",
    "exhausted",
    "archived",
    "full",
    "ineligible",
    "organization_required",
    "already_joined",
  ] as const) {
    let calls = 0;
    const { deps } = fixture({
      rpc: async () => {
        calls++;
        return { data: { status }, error: null };
      },
    });
    assert.equal((await runClassJoin({ code }, true, deps)).status, status);
    assert.equal(calls, 1);
  }
  const { deps } = fixture({
    rpc: async () => {
      throw Error("transport");
    },
  });
  assert.deepEqual(await runClassJoin({ code }, true, deps), {
    status: "unavailable",
  });
});
test("manager input cannot override policy or identity", async () => {
  const { deps, calls } = fixture();
  assert.equal(
    (await manageInvitation({ classId, action: "create", maxUses: 999 }, deps))
      .status,
    "invalid",
  );
  assert.equal(calls.length, 0);
});
test("localized code survives auth allowlist without opening redirect bypasses", () => {
  for (const locale of ["en", "vi"]) {
    const path = classJoinPath(code, locale);
    assert.equal(resolveAuthRedirect(path), path);
    assert.equal(
      new URL(path, "https://thinkfy.net").searchParams.get("code"),
      code,
    );
  }
  for (const path of [
    "//evil.example",
    "/en/join-class-evil",
    "/vi/join-class/../../evil",
    "/en/join-class\\evil",
    "https://evil.example",
  ]) {
    assert.equal(isAllowedAuthRedirect(path), false);
  }
  assert.equal(
    normalizeClassJoinCode(" 01234567-89ABCDEF-01234567-89ABCDEF "),
    code,
  );
  assert.equal(isClassJoinCode("short"), false);
});
