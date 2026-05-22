import { NextRequest, NextResponse } from "next/server";
import type { DebateScore } from "@thinkfy/shared/practice";
import type {
  MobilePracticeHistoryResponse,
  MobilePracticeHistoryRow,
} from "@thinkfy/shared/practice-analysis";

import { requireRequestAuth } from "@/lib/api/request-auth";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

type DebateSessionHistoryRow = {
  id: string;
  topic_title: string;
  topic_category: string;
  topic_difficulty: "beginner" | "intermediate" | "advanced" | null;
  side: "proposition" | "opposition";
  practice_track: "speaking" | "debate" | null;
  practice_language: "en" | "vi" | null;
  mode: "quick" | "full";
  duration_seconds: number | null;
  total_score: number | null;
  overall_band: string | null;
  feedback: DebateScore | null;
  created_at: string;
};

function clampLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(50, Math.floor(parsed)));
}

function toHistoryRow(row: DebateSessionHistoryRow): MobilePracticeHistoryRow {
  return {
    id: row.id,
    topicTitle: row.topic_title,
    topicCategory: row.topic_category,
    topicDifficulty: row.topic_difficulty ?? "intermediate",
    practiceTrack: row.practice_track ?? row.feedback?.practiceTrack ?? "debate",
    practiceLanguage:
      row.practice_language ?? row.feedback?.practiceLanguage ?? "en",
    side: row.side,
    mode: row.mode,
    durationSeconds: row.duration_seconds ?? 0,
    totalScore: row.total_score ?? row.feedback?.totalScore ?? null,
    overallBand: row.overall_band ?? row.feedback?.overallBand ?? null,
    summary: row.feedback?.summary ?? null,
    createdAt: row.created_at,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireRequestAuth(req);

  if (!auth.ok) {
    return auth.errorResponse;
  }

  const limit = clampLimit(req.nextUrl.searchParams.get("limit"));
  const cursor = req.nextUrl.searchParams.get("cursor");
  const adminClient = tryCreateAdminClient();
  if (!adminClient && auth.authSource === "dev-bypass") {
    return NextResponse.json({
      items: [],
      nextCursor: null,
    } satisfies MobilePracticeHistoryResponse);
  }

  const readClient = adminClient ?? auth.supabase;
  let query = readClient
    .from("debate_sessions")
    .select(
      "id, topic_title, topic_category, topic_difficulty, side, practice_track, practice_language, mode, duration_seconds, total_score, overall_band, feedback, created_at"
    )
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Unable to load practice history.", code: "history_failed" },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as DebateSessionHistoryRow[];
  const pageRows = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? pageRows.at(-1)?.created_at ?? null : null;

  return NextResponse.json({
    items: pageRows.map(toHistoryRow),
    nextCursor,
  } satisfies MobilePracticeHistoryResponse);
}
