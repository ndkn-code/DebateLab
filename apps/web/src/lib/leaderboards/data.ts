import type {
  LeaderboardDataSource,
  LeaderboardPageData,
} from "@/lib/leaderboards/types";
import {
  makeMockLeaderboardPageData,
  makeUnavailableLeaderboardPageData,
  type LeaderboardFixtureState,
} from "@/lib/leaderboards/fixtures";
import { LEADERBOARDS_DATA_SOURCE } from "@/lib/features";
import { createClient } from "@/lib/supabase/server";

type SupabaseLikeError = {
  code?: string;
  message?: string;
};

type SupabaseLikeSelect = {
  limit: (count: number) => Promise<{ data: unknown; error: SupabaseLikeError | null }>;
};

type SupabaseLikeFrom = {
  select: (columns: string) => SupabaseLikeSelect;
};

export type LeaderboardSupabaseLikeClient = {
  from: (table: string) => SupabaseLikeFrom;
  rpc?: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: SupabaseLikeError | null }>;
};

export interface GetLeaderboardPageDataOptions {
  dataSource?: LeaderboardDataSource;
  fixtureState?: LeaderboardFixtureState;
  supabaseClient?: LeaderboardSupabaseLikeClient;
}

const LEDGER_TABLE_CHECKS = [
  { table: "xp_seasons", column: "id" },
  { table: "xp_season_user_totals", column: "season_id" },
  { table: "xp_season_org_totals", column: "season_id" },
  { table: "leaderboard_user_leagues", column: "user_id" },
  { table: "leaderboard_season_user_cohorts", column: "season_id" },
  { table: "leaderboard_season_results", column: "season_id" },
] as const;

export function isMissingLeaderboardLedgerError(error: SupabaseLikeError | null) {
  if (!error) return false;

  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    message.includes("does not exist") ||
    message.includes("could not find the function") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

function isLeaderboardPageData(value: unknown): value is LeaderboardPageData {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<LeaderboardPageData>;
  return (
    (record.source === "mock" || record.source === "ledger") &&
    (record.status === "ready" ||
      record.status === "empty" ||
      record.status === "unavailable") &&
    Boolean(record.season) &&
    Boolean(record.personal) &&
    Boolean(record.organizations)
  );
}

async function checkLedgerTables(client: LeaderboardSupabaseLikeClient) {
  for (const check of LEDGER_TABLE_CHECKS) {
    const { error } = await client.from(check.table).select(check.column).limit(1);

    if (error) {
      return {
        ok: false,
        reason: isMissingLeaderboardLedgerError(error)
          ? `Leaderboard ledger table '${check.table}' is not available yet.`
          : error.message ?? `Could not read leaderboard ledger table '${check.table}'.`,
      };
    }
  }

  return { ok: true, reason: null };
}

async function getLedgerLeaderboardPageData(
  client: LeaderboardSupabaseLikeClient,
  viewerUserId: string
): Promise<LeaderboardPageData> {
  const readiness = await checkLedgerTables(client);

  if (!readiness.ok) {
    return makeUnavailableLeaderboardPageData(
      readiness.reason ?? "Leaderboard ledger tables are not available yet."
    );
  }

  if (!client.rpc) {
    return makeUnavailableLeaderboardPageData(
      "Leaderboard ledger tables are reachable, but the Supabase RPC client is not available."
    );
  }

  const v2Result = await client.rpc("get_leaderboard_page_data_v2", {
    p_user_id: viewerUserId,
  });

  const { data, error } =
    v2Result.error && isMissingLeaderboardLedgerError(v2Result.error)
      ? await client.rpc("get_leaderboard_page_data", {
          p_user_id: viewerUserId,
        })
      : v2Result;

  if (error) {
    return makeUnavailableLeaderboardPageData(
      isMissingLeaderboardLedgerError(error)
        ? "Leaderboard read RPC is not available yet."
        : error.message ?? "Leaderboard read RPC failed."
    );
  }

  if (!isLeaderboardPageData(data)) {
    return makeUnavailableLeaderboardPageData(
      "Leaderboard read RPC returned an unexpected payload."
    );
  }

  return data;
}

export async function getLeaderboardPageData(
  viewerUserId: string,
  options: GetLeaderboardPageDataOptions = {}
): Promise<LeaderboardPageData> {
  const source = options.dataSource ?? LEADERBOARDS_DATA_SOURCE;

  if (source === "mock") {
    return makeMockLeaderboardPageData({
      viewerUserId,
      state: options.fixtureState ?? "normal",
    });
  }

  const supabase =
    options.supabaseClient ??
    ((await createClient()) as unknown as LeaderboardSupabaseLikeClient);

  return getLedgerLeaderboardPageData(supabase, viewerUserId);
}
