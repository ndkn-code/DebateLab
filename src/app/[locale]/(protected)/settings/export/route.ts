import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface DuelParticipantRow {
  duel_id: string;
  role: "proposition" | "opposition" | null;
  joined_at: string;
  completed_at: string | null;
}

interface DuelRow {
  id: string;
  share_code: string;
  topic_title: string;
  topic_category: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface DuelJudgmentRow {
  duel_id: string;
  winner_side: "proposition" | "opposition" | null;
  summary: string;
  confidence: number | null;
}

interface DuelSpeechRow {
  duel_id: string;
  duration_seconds: number;
}

function buildFileName() {
  const date = new Date().toISOString().slice(0, 10);
  return `debatelab-data-export-${date}.json`;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [
    profileRes,
    soloSessionsRes,
    dailyStatsRes,
    referralsRes,
    orbTransactionsRes,
    enrollmentsRes,
    lessonProgressRes,
    conversationsRes,
    duelParticipantsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("debate_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("daily_stats")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false }),
    supabase
      .from("referrals")
      .select("*")
      .or(`referrer_id.eq.${user.id},referee_id.eq.${user.id}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("orb_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("enrollments")
      .select("*")
      .eq("user_id", user.id)
      .order("enrolled_at", { ascending: false }),
    supabase
      .from("lesson_progress")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("chat_conversations")
      .select("id, user_id, title, context_type, context_id, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("debate_duel_participants")
      .select("duel_id, role, joined_at, completed_at")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false }),
  ]);

  const duelParticipants = (duelParticipantsRes.data ?? []) as DuelParticipantRow[];
  const duelIds = [...new Set(duelParticipants.map((row) => row.duel_id))];

  let duelRows: DuelRow[] = [];
  let duelJudgments: DuelJudgmentRow[] = [];
  let duelSpeeches: DuelSpeechRow[] = [];

  if (duelIds.length > 0) {
    const [duelsRes, judgmentsRes, speechesRes] = await Promise.all([
      supabase
        .from("debate_duels")
        .select("id, share_code, topic_title, topic_category, status, created_at, completed_at")
        .in("id", duelIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("debate_duel_judgments")
        .select("duel_id, winner_side, summary, confidence")
        .in("duel_id", duelIds),
      supabase
        .from("debate_duel_speeches")
        .select("duel_id, duration_seconds")
        .in("duel_id", duelIds),
    ]);

    duelRows = (duelsRes.data ?? []) as DuelRow[];
    duelJudgments = (judgmentsRes.data ?? []) as DuelJudgmentRow[];
    duelSpeeches = (speechesRes.data ?? []) as DuelSpeechRow[];
  }

  const judgmentByDuelId = new Map(
    duelJudgments.map((judgment) => [judgment.duel_id, judgment])
  );
  const durationByDuelId = duelSpeeches.reduce((map, speech) => {
    map.set(
      speech.duel_id,
      (map.get(speech.duel_id) ?? 0) + (speech.duration_seconds ?? 0)
    );
    return map;
  }, new Map<string, number>());

  const duelHistorySummary = duelParticipants
    .map((participant) => {
      const duel = duelRows.find((row) => row.id === participant.duel_id);
      if (!duel) {
        return null;
      }

      const judgment = judgmentByDuelId.get(participant.duel_id);
      return {
        duelId: duel.id,
        shareCode: duel.share_code,
        topicTitle: duel.topic_title,
        topicCategory: duel.topic_category,
        status: duel.status,
        role: participant.role,
        joinedAt: participant.joined_at,
        completedAt: duel.completed_at ?? participant.completed_at,
        winnerSide: judgment?.winner_side ?? null,
        summary: judgment?.summary ?? null,
        confidence: judgment?.confidence ?? null,
        durationSeconds: durationByDuelId.get(participant.duel_id) ?? 0,
      };
    })
    .filter(Boolean);

  const conversations = conversationsRes.data ?? [];
  const conversationIds = conversations.map((conversation) => conversation.id);
  const { data: chatMessages } =
    conversationIds.length > 0
      ? await supabase
          .from("chat_messages")
          .select("id, conversation_id, role, content, tokens_used, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true })
      : { data: [] };

  const payload = {
    exportedAt: new Date().toISOString(),
    userId: user.id,
    email: user.email ?? null,
    profile: profileRes.data ?? null,
    preferences: profileRes.data?.preferences ?? null,
    soloPracticeSessions: soloSessionsRes.data ?? [],
    duelHistorySummary,
    dailyStats: dailyStatsRes.data ?? [],
    referrals: referralsRes.data ?? [],
    orbTransactions: orbTransactionsRes.data ?? [],
    enrollments: enrollmentsRes.data ?? [],
    lessonProgress: lessonProgressRes.data ?? [],
    chatHistory: {
      conversations,
      messages: chatMessages ?? [],
    },
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${buildFileName()}"`,
      "Cache-Control": "no-store",
    },
  });
}
