import { NextRequest, NextResponse } from "next/server";
import type { DebateRound, DebateScore } from "@thinkfy/shared/practice";
import type {
  MobilePracticeHistoryDetail,
  MobilePracticeHistoryDetailResponse,
} from "@thinkfy/shared/practice-analysis";

import { requireRequestAuth } from "@/lib/api/request-auth";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

type DebateSessionDetailRow = {
  id: string;
  topic_title: string;
  topic_category: string;
  topic_difficulty: "beginner" | "intermediate" | "advanced" | null;
  side: "proposition" | "opposition";
  practice_track: "speaking" | "debate" | null;
  practice_language: "en" | "vi" | null;
  mode: "quick" | "full";
  prep_time: number | null;
  speech_time: number | null;
  duration_seconds: number | null;
  transcript: string | null;
  feedback: DebateScore | null;
  total_score: number | null;
  overall_band: string | null;
  ai_difficulty: "easy" | "medium" | "hard" | null;
  rounds: DebateRound[] | null;
  created_at: string;
};

function toDetail(row: DebateSessionDetailRow): MobilePracticeHistoryDetail {
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
    prepTime: row.prep_time ?? 0,
    speechTime: row.speech_time ?? 0,
    durationSeconds: row.duration_seconds ?? 0,
    transcript: row.transcript ?? "",
    feedback: row.feedback,
    totalScore: row.total_score ?? row.feedback?.totalScore ?? null,
    overallBand: row.overall_band ?? row.feedback?.overallBand ?? null,
    summary: row.feedback?.summary ?? null,
    modelName: null,
    aiDifficulty: row.ai_difficulty,
    rounds: row.rounds,
    createdAt: row.created_at,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireRequestAuth(req);

  if (!auth.ok) {
    return auth.errorResponse;
  }

  const adminClient = tryCreateAdminClient();
  if (!adminClient && auth.authSource === "dev-bypass") {
    return NextResponse.json(
      { error: "Practice session not found.", code: "not_found" },
      { status: 404 }
    );
  }

  const readClient = adminClient ?? auth.supabase;
  const { data, error } = await readClient
    .from("debate_sessions")
    .select(
      "id, topic_title, topic_category, topic_difficulty, side, practice_track, practice_language, mode, prep_time, speech_time, duration_seconds, transcript, feedback, total_score, overall_band, ai_difficulty, rounds, created_at"
    )
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Unable to load practice history detail.", code: "history_failed" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Practice session not found.", code: "not_found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    item: toDetail(data as DebateSessionDetailRow),
  } satisfies MobilePracticeHistoryDetailResponse);
}
