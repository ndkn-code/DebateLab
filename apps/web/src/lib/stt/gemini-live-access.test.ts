import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeGeminiLiveBenchmark } from "./gemini-live-access";

const USER_ID = "00000000-0000-4000-8000-000000000001";

class FakeQuery {
  constructor(
    private readonly table: string,
    private readonly options: {
      role?: string | null;
      ageBand?: string | null;
      consentStatus?: string | null;
      errorTable?: string;
    },
  ) {}
  select() {
    return this;
  }
  eq() {
    return this;
  }
  async maybeSingle() {
    if (this.options.errorTable === this.table) {
      return { data: null, error: { message: "read failed" } };
    }
    return {
      data:
        this.table === "profiles"
          ? { role: this.options.role ?? "admin" }
          : {
              age_band: this.options.ageBand ?? "adult",
              consent_status: this.options.consentStatus ?? "adult_attested",
            },
      error: null,
    };
  }
}

function client(options: ConstructorParameters<typeof FakeQuery>[1] = {}) {
  return {
    from(table: string) {
      return new FakeQuery(table, options);
    },
  } as unknown as SupabaseClient;
}

function authorize(
  options: ConstructorParameters<typeof FakeQuery>[1] = {},
  overrides: Partial<Parameters<typeof authorizeGeminiLiveBenchmark>[0]> = {},
) {
  return authorizeGeminiLiveBenchmark({
    supabase: client(options),
    userId: USER_ID,
    enabled: "true",
    allowlist: USER_ID,
    ...overrides,
  });
}

test("allows only an allowlisted, adult-attested platform admin", async () => {
  assert.deepEqual(await authorize(), { ok: true });
});

test("fails closed when disabled or the UUID allowlist is missing or malformed", async () => {
  assert.deepEqual(await authorize({}, { enabled: undefined }), {
    ok: false,
    reason: "disabled",
  });
  assert.deepEqual(await authorize({}, { allowlist: undefined }), {
    ok: false,
    reason: "allowlist_invalid",
  });
  assert.deepEqual(
    await authorize({}, { allowlist: `${USER_ID},not-a-uuid` }),
    {
      ok: false,
      reason: "allowlist_invalid",
    },
  );
  assert.deepEqual(
    await authorize({}, { allowlist: "00000000-0000-4000-8000-000000000099" }),
    { ok: false, reason: "not_allowlisted" },
  );
});

test("fails closed for non-admin, missing adult attestation, or DB errors", async () => {
  assert.deepEqual(await authorize({ role: "teacher" }), {
    ok: false,
    reason: "not_platform_admin",
  });
  assert.deepEqual(await authorize({ ageBand: "minor" }), {
    ok: false,
    reason: "age_assurance_missing",
  });
  assert.deepEqual(await authorize({ consentStatus: "pending" }), {
    ok: false,
    reason: "age_assurance_missing",
  });
  assert.deepEqual(await authorize({ errorTable: "user_age_assurance" }), {
    ok: false,
    reason: "age_assurance_missing",
  });
});
