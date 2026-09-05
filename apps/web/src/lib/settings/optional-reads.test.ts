import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  readOptional,
  readSettingsOptionalData,
} from "@/lib/settings/optional-reads";

function fakeQuery(result: unknown, calls: string[], table: string) {
  const query = {
    select(value: string) {
      calls.push(`${table}.select:${value}`);
      return query;
    },
    eq(column: string, value: string) {
      calls.push(`${table}.eq:${column}=${value}`);
      return query;
    },
    order(column: string) {
      calls.push(`${table}.order:${column}`);
      return query;
    },
    limit(value: number) {
      calls.push(`${table}.limit:${value}`);
      return query;
    },
    abortSignal() {
      calls.push(`${table}.abortSignal`);
      return query;
    },
    maybeSingle() {
      return query;
    },
    then(
      resolve: (value: unknown) => unknown,
      reject: (error: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return query;
}

function fakeSupabase(input: {
  calls: string[];
  membership?: unknown;
  club?: unknown;
  leaderboard?: unknown;
}) {
  return {
    from(table: string) {
      return fakeQuery(
        table === "club_memberships" ? input.membership : input.club,
        input.calls,
        table,
      );
    },
    rpc(name: string) {
      input.calls.push(`rpc:${name}`);
      return fakeQuery(input.leaderboard, input.calls, "rpc");
    },
  } as unknown as SupabaseClient;
}

test("optional reads distinguish an absent row from an available value", async () => {
  assert.deepEqual(await readOptional(async () => null), {
    status: "absent",
    data: null,
  });

  assert.deepEqual(await readOptional(async () => ({ enabled: true })), {
    status: "ready",
    data: { enabled: true },
  });
});

test("optional read failures are unavailable and do not escape", async () => {
  const result = await readOptional(async () => {
    throw new Error("database unavailable");
  });

  assert.equal(result.status, "unavailable");
  assert.equal(result.data, null);
  assert.equal(result.error.message, "database unavailable");
});

test("optional reads abort and report timeout", async () => {
  let aborted = false;
  const result = await readOptional(
    (signal) =>
      new Promise<null>(() => {
        signal.addEventListener("abort", () => {
          aborted = true;
        });
      }),
    5,
  );

  assert.equal(result.status, "unavailable");
  assert.equal(result.data, null);
  assert.equal(result.error.name, "OptionalReadTimeoutError");
  assert.equal(aborted, true);
});

test("disabled optional settings reads do not touch the database", async () => {
  const calls: string[] = [];
  const result = await readSettingsOptionalData({
    supabase: fakeSupabase({ calls }),
    userId: "user-1",
    includeOrganization: false,
    includeLeaderboard: false,
  });

  assert.deepEqual(result.organizationAffiliation, {
    status: "absent",
    data: null,
  });
  assert.deepEqual(result.leaderboardPrivacySettings, {
    status: "absent",
    data: null,
  });
  assert.deepEqual(calls, []);
});

test("organization read preserves ownership filters and distinguishes absent membership", async () => {
  const calls: string[] = [];
  const result = await readSettingsOptionalData({
    supabase: fakeSupabase({ calls, membership: { data: null, error: null } }),
    userId: "user-1",
    includeOrganization: true,
    includeLeaderboard: false,
  });

  assert.equal(result.organizationAffiliation.status, "absent");
  assert.ok(calls.includes("club_memberships.eq:user_id=user-1"));
  assert.ok(calls.includes("club_memberships.eq:role=student"));
  assert.ok(calls.includes("club_memberships.eq:status=active"));
});

test("organization database errors and missing clubs are unavailable", async () => {
  const membershipError = await readSettingsOptionalData({
    supabase: fakeSupabase({
      calls: [],
      membership: { data: null, error: new Error("membership unavailable") },
    }),
    userId: "user-1",
    includeOrganization: true,
    includeLeaderboard: false,
  });
  assert.equal(membershipError.organizationAffiliation.status, "unavailable");

  const missingClub = await readSettingsOptionalData({
    supabase: fakeSupabase({
      calls: [],
      membership: {
        data: { club_id: "club-1", joined_at: "2026-01-01", metadata: {} },
        error: null,
      },
      club: { data: null, error: null },
    }),
    userId: "user-1",
    includeOrganization: true,
    includeLeaderboard: false,
  });
  assert.equal(missingClub.organizationAffiliation.status, "unavailable");
});

test("leaderboard RPC errors are unavailable and valid data is normalized", async () => {
  const unavailable = await readSettingsOptionalData({
    supabase: fakeSupabase({
      calls: [],
      leaderboard: { data: null, error: new Error("function missing") },
    }),
    userId: "user-1",
    includeOrganization: false,
    includeLeaderboard: true,
  });
  assert.equal(unavailable.leaderboardPrivacySettings.status, "unavailable");

  const ready = await readSettingsOptionalData({
    supabase: fakeSupabase({
      calls: [],
      leaderboard: {
        data: {
          userId: "user-1",
          displayMode: "initials_only",
          allowKudos: false,
          showOrganization: true,
          participateInLeaderboards: true,
          updatedAt: "2026-01-01T00:00:00Z",
        },
        error: null,
      },
    }),
    userId: "user-1",
    includeOrganization: false,
    includeLeaderboard: true,
  });
  assert.equal(ready.leaderboardPrivacySettings.status, "ready");
  if (ready.leaderboardPrivacySettings.status === "ready") {
    assert.equal(
      ready.leaderboardPrivacySettings.data.displayMode,
      "initials_only",
    );
    assert.equal(ready.leaderboardPrivacySettings.data.allowKudos, false);
  }
});
