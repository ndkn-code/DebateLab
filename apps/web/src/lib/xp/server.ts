import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeaderboardLanguage } from "@/lib/leaderboards/types";
import type { XpCategory, XpSourceType } from "./model";

export interface AwardXpInput {
  userId: string;
  sourceType: XpSourceType;
  sourceId?: string | null;
  activityType?: string | null;
  referenceType?: string | null;
  category: XpCategory;
  idempotencyKey: string;
  lifetimeXp: number;
  seasonXp?: number | null;
  occurredAt?: string | null;
  metadata?: Record<string, unknown>;
  sessions?: number;
  minutes?: number;
  score?: number | null;
  clubId?: string | null;
  classId?: string | null;
  leaderboardLanguage?: LeaderboardLanguage | null;
}

export interface AwardXpResult {
  eventId: string;
  inserted: boolean;
  lifetimeXpAwarded: number;
  seasonXpAwarded: number;
  seasonId: string;
}

type AwardXpRpcRow = {
  event_id: string;
  inserted: boolean;
  lifetime_xp_awarded: number;
  season_xp_awarded: number;
  season_id: string;
};

function normalizeXpAmount(value: number | null | undefined) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value ?? 0 : 0));
}

function mapAwardRow(row: AwardXpRpcRow): AwardXpResult {
  return {
    eventId: row.event_id,
    inserted: row.inserted,
    lifetimeXpAwarded: row.lifetime_xp_awarded,
    seasonXpAwarded: row.season_xp_awarded,
    seasonId: row.season_id,
  };
}

export async function awardXpEvent(
  input: AwardXpInput,
  supabase?: SupabaseClient
): Promise<AwardXpResult> {
  const client = supabase ?? (await import("@/lib/supabase/admin")).createAdminClient();
  const lifetimeXp = normalizeXpAmount(input.lifetimeXp);
  const seasonXp = normalizeXpAmount(input.seasonXp ?? input.lifetimeXp);

  const { data, error } = await client.rpc("award_xp_event", {
    p_user_id: input.userId,
    p_source_type: input.sourceType,
    p_xp_category: input.category,
    p_idempotency_key: input.idempotencyKey,
    p_source_id: input.sourceId ?? null,
    p_activity_type: input.activityType ?? null,
    p_reference_type: input.referenceType ?? null,
    p_lifetime_xp: lifetimeXp,
    p_season_xp: seasonXp,
    p_occurred_at: input.occurredAt ?? new Date().toISOString(),
    p_metadata: input.metadata ?? {},
    p_sessions: Math.max(0, Math.round(input.sessions ?? 0)),
    p_minutes: Math.max(0, Math.round(input.minutes ?? 0)),
    p_score: input.score ?? null,
    p_club_id: input.clubId ?? null,
    p_class_id: input.classId ?? null,
    p_leaderboard_language: input.leaderboardLanguage ?? null,
  });

  if (error) {
    throw new Error(`award XP event: ${error.message}`);
  }

  const row = Array.isArray(data) ? (data[0] as AwardXpRpcRow | undefined) : null;
  if (!row) {
    throw new Error("award XP event: RPC returned no row");
  }

  return mapAwardRow(row);
}

export async function backfillLegacyXpEvents(
  since: string,
  supabase?: SupabaseClient
) {
  const client = supabase ?? (await import("@/lib/supabase/admin")).createAdminClient();
  const { data, error } = await client.rpc("backfill_legacy_xp_events", {
    p_since: since,
  });

  if (error) {
    throw new Error(`backfill legacy XP events: ${error.message}`);
  }

  const row = Array.isArray(data)
    ? (data[0] as { inserted_count?: number } | undefined)
    : null;
  return row?.inserted_count ?? 0;
}
