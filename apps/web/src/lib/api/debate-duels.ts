import "server-only";

import { createClient } from "@/lib/supabase/server";
import { judgeDebateDuel } from "@/lib/gemini";
import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import { recordAiQualityRun } from "@/lib/ai/quality";
import {
  getDuelJudgeProvider,
  getProviderLabel,
  getProviderModelName,
} from "@/lib/ai/provider-selection";
import type { AiQualityTelemetry } from "@/lib/ai/quality-model";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import {
  DUEL_ENTRY_COST,
  DUEL_XP_REWARD,
  getNextDuelPhase,
} from "@/lib/debate-duels/shared";
import {
  DEFAULT_PRACTICE_LANGUAGE,
  coercePracticeLanguage,
} from "@/lib/practice-language";
import { coercePublicProfileData } from "@/lib/profile-social/model";
import {
  computeSkillSnapshot,
  type SkillFeedbackSource,
} from "@/lib/analytics/skill-snapshot";
import type {
  DebateDuelJudgment,
  DebateDuelMatchmakingTicket,
  DebateDuelParticipant,
  DebateDuelPhase,
  DebateDuelRoomView,
  DebateDuelSide,
  DebateDuelSideAssignmentMode,
  DebateDuelSpeech,
  PracticeLanguage,
} from "@/types";

type DuelRow = {
  id: string;
  share_code: string;
  creator_id: string;
  practice_topic_key?: string | null;
  topic_title: string;
  topic_category: string;
  topic_category_key?: string | null;
  topic_difficulty: "beginner" | "intermediate" | "advanced";
  topic_description: string | null;
  practice_language?: PracticeLanguage | null;
  duel_kind: "custom" | "matchmaking";
  rated: boolean;
  integrity_status: "clean" | "warned" | "suspicious" | "no_contest";
  rating_processed_at: string | null;
  rating_excluded_reason: string | null;
  prep_time_seconds: number;
  opening_time_seconds: number;
  rebuttal_time_seconds: number;
  entry_cost: number;
  side_assignment_mode: DebateDuelSideAssignmentMode;
  creator_side_preference: DebateDuelSide | null;
  status: DebateDuelRoomView["status"];
  current_phase: DebateDuelPhase;
  phase_started_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string;
  created_at: string;
};

type DuelParticipantRow = {
  id: string;
  duel_id: string;
  user_id: string;
  role: DebateDuelSide | null;
  display_name_snapshot: string;
  avatar_url_snapshot: string | null;
  joined_at: string;
  ready_at: string | null;
  credits_charged_at: string | null;
  completed_at: string | null;
};

type DuelSpeechRow = {
  id: string;
  duel_id: string;
  participant_id: string;
  round_number: number;
  speech_type: "opening" | "rebuttal";
  side: DebateDuelSide;
  transcript: string;
  audio_storage_path: string | null;
  duration_seconds: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type DuelJudgmentRow = {
  id: string;
  duel_id: string;
  winner_participant_id: string | null;
  winner_side: DebateDuelSide | null;
  judge_model: string;
  confidence: number | null;
  verdict: DebateDuelJudgment | null;
  summary: string;
  created_at: string;
};

type DuelMatchmakingTicketRow = {
  id: string;
  user_id: string;
  status: DebateDuelMatchmakingTicket["status"];
  topic_category: string;
  topic_category_key?: string | null;
  topic_difficulty: DebateDuelMatchmakingTicket["topicDifficulty"];
  practice_language?: PracticeLanguage | null;
  prep_time_seconds: number;
  opening_time_seconds: number;
  rebuttal_time_seconds: number;
  matched_duel_id: string | null;
  matched_ticket_id: string | null;
  expires_at: string;
  matched_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  debate_duels?: { share_code: string } | { share_code: string }[] | null;
};

export interface CreateDebateDuelInput {
  topicKey?: string | null;
  topicTitle: string;
  topicCategory: string;
  topicCategoryKey?: string | null;
  topicDifficulty: "beginner" | "intermediate" | "advanced";
  topicDescription?: string;
  practiceLanguage?: PracticeLanguage;
  prepTimeSeconds: number;
  openingTimeSeconds: number;
  rebuttalTimeSeconds: number;
  sideAssignmentMode: DebateDuelSideAssignmentMode;
  creatorSidePreference?: DebateDuelSide | null;
}

export interface DebateDuelHistoryItem {
  id: string;
  shareCode: string;
  topicTitle: string;
  role: DebateDuelSide | null;
  winnerSide: DebateDuelSide | null;
  summary: string;
  durationSeconds: number | null;
  createdAt: string;
  href: string;
}

function normalizeShareCode(shareCode: string) {
  return shareCode.trim().toUpperCase();
}

function mapSpeech(row: DuelSpeechRow): DebateDuelSpeech {
  return {
    id: row.id,
    participantId: row.participant_id,
    roundNumber: row.round_number,
    speechType: row.speech_type,
    side: row.side,
    transcript: row.transcript,
    audioStoragePath: row.audio_storage_path,
    durationSeconds: row.duration_seconds,
    submittedAt: row.created_at,
    metadata: row.metadata ?? {},
  };
}

async function fetchRoomRows(shareCode: string) {
  const supabase = await createClient();
  const normalizedCode = normalizeShareCode(shareCode);

  const { data: duel, error: duelError } = await supabase
    .from("debate_duels")
    .select(
      "id, share_code, creator_id, practice_topic_key, topic_title, topic_category, topic_category_key, topic_difficulty, topic_description, practice_language, duel_kind, rated, integrity_status, rating_processed_at, rating_excluded_reason, prep_time_seconds, opening_time_seconds, rebuttal_time_seconds, entry_cost, side_assignment_mode, creator_side_preference, status, current_phase, phase_started_at, started_at, completed_at, expires_at, created_at"
    )
    .eq("share_code", normalizedCode)
    .maybeSingle();

  if (duelError) {
    throw new Error(duelError.message);
  }

  if (!duel) {
    return null;
  }

  const { data: participants, error: participantError } = await supabase
    .from("debate_duel_participants")
    .select(
      "id, duel_id, user_id, role, display_name_snapshot, avatar_url_snapshot, joined_at, ready_at, credits_charged_at, completed_at"
    )
    .eq("duel_id", duel.id)
    .order("joined_at", { ascending: true });

  if (participantError) {
    throw new Error(participantError.message);
  }

  const { data: speeches, error: speechError } = await supabase
    .from("debate_duel_speeches")
    .select(
      "id, duel_id, participant_id, round_number, speech_type, side, transcript, audio_storage_path, duration_seconds, metadata, created_at"
    )
    .eq("duel_id", duel.id)
    .order("round_number", { ascending: true });

  if (speechError) {
    throw new Error(speechError.message);
  }

  const { data: judgment, error: judgmentError } = await supabase
    .from("debate_duel_judgments")
    .select(
      "id, duel_id, winner_participant_id, winner_side, judge_model, confidence, verdict, summary, created_at"
    )
    .eq("duel_id", duel.id)
    .maybeSingle();

  if (judgmentError) {
    throw new Error(judgmentError.message);
  }

  const mappedParticipantsBase: DebateDuelParticipant[] = (participants ?? []).map(
    (participant) => {
      return {
        id: participant.id,
        userId: participant.user_id,
        displayName: participant.display_name_snapshot || "Debater",
        avatarUrl: participant.avatar_url_snapshot ?? null,
        role: participant.role,
        joinedAt: participant.joined_at,
        readyAt: participant.ready_at,
        creditsChargedAt: participant.credits_charged_at,
        completedAt: participant.completed_at,
      };
    }
  );
  const mappedParticipants: DebateDuelParticipant[] = await Promise.all(
    mappedParticipantsBase.map(async (participant) => {
      try {
        const { data, error } = await supabase.rpc("get_profile_public_data", {
          p_target_user_id: participant.userId,
          p_handle: null,
          p_leaderboard_language: duel.practice_language ?? "en",
        });

        if (error) return participant;

        const publicProfile = coercePublicProfileData(data);
        const handle = publicProfile.profile?.handle ?? null;
        return {
          ...participant,
          handle,
          profileHref:
            publicProfile.state === "self"
              ? "/profile"
              : handle && publicProfile.profile
                ? `/profile/${handle}`
                : null,
        };
      } catch {
        return participant;
      }
    })
  );

  return {
    duel: duel as DuelRow,
    participants: participants as DuelParticipantRow[],
    mappedParticipants,
    speeches: ((speeches ?? []) as DuelSpeechRow[]).map(mapSpeech),
    judgment: (judgment as DuelJudgmentRow | null) ?? null,
  };
}

function toRoomView(params: {
  duel: DuelRow;
  participants: DebateDuelParticipant[];
  speeches: DebateDuelSpeech[];
  judgment: DuelJudgmentRow | null;
  userId: string;
}) {
  const { duel, participants, speeches, judgment, userId } = params;
  const viewerParticipant = participants.find(
    (participant) => participant.userId === userId
  );
  const participantCount = participants.length;
  const everyoneReady =
    participantCount === 2 &&
    participants.every((participant) => participant.readyAt);
  const isExpired =
    duel.status === "expired" ||
    (duel.status === "lobby" && new Date(duel.expires_at).getTime() <= Date.now());

  return {
    id: duel.id,
    shareCode: duel.share_code,
    topicKey: duel.practice_topic_key ?? null,
    topicTitle: duel.topic_title,
    topicCategory: duel.topic_category,
    topicCategoryKey: duel.topic_category_key ?? null,
    topicDifficulty: duel.topic_difficulty,
    topicDescription: duel.topic_description,
    practiceLanguage: coercePracticeLanguage(
      duel.practice_language,
      DEFAULT_PRACTICE_LANGUAGE
    ),
    duelKind: duel.duel_kind ?? "custom",
    rated: duel.rated ?? false,
    integrityStatus: duel.integrity_status ?? "clean",
    status: isExpired ? "expired" : duel.status,
    currentPhase: duel.current_phase,
    sideAssignmentMode: duel.side_assignment_mode,
    creatorSidePreference: duel.creator_side_preference,
    config: {
      prepTimeSeconds: duel.prep_time_seconds,
      openingTimeSeconds: duel.opening_time_seconds,
      rebuttalTimeSeconds: duel.rebuttal_time_seconds,
      entryCost: duel.entry_cost,
    },
    phaseStartedAt: duel.phase_started_at,
    startedAt: duel.started_at,
    completedAt: duel.completed_at,
    expiresAt: duel.expires_at,
    createdAt: duel.created_at,
    creatorId: duel.creator_id,
    participants,
    speeches,
    judgment: judgment?.verdict ?? null,
    viewer: {
      id: userId,
      isCreator: duel.creator_id === userId,
      isParticipant: !!viewerParticipant,
      participantId: viewerParticipant?.id ?? null,
      role: viewerParticipant?.role ?? null,
    },
    canJoin:
      !isExpired &&
      duel.status === "lobby" &&
      !viewerParticipant &&
      participantCount < 2,
    canReady: duel.status === "lobby" && !!viewerParticipant,
    canStart:
      !isExpired &&
      duel.status === "lobby" &&
      (duel.creator_id === userId ||
        (duel.duel_kind === "matchmaking" && !!viewerParticipant)) &&
      everyoneReady,
  } satisfies DebateDuelRoomView;
}

async function getDuelById(duelId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debate_duels")
    .select(
      "id, share_code, creator_id, practice_topic_key, topic_title, topic_category, topic_category_key, topic_difficulty, topic_description, practice_language, duel_kind, rated, integrity_status, rating_processed_at, rating_excluded_reason, prep_time_seconds, opening_time_seconds, rebuttal_time_seconds, entry_cost, side_assignment_mode, creator_side_preference, status, current_phase, phase_started_at, started_at, completed_at, expires_at, created_at"
    )
    .eq("id", duelId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as DuelRow;
}

export async function getDebateDuelRoom(
  shareCode: string,
  userId: string
): Promise<DebateDuelRoomView | null> {
  const rows = await fetchRoomRows(shareCode);
  if (!rows) return null;

  if (
    rows.duel.status === "lobby" &&
    new Date(rows.duel.expires_at).getTime() <= Date.now()
  ) {
    const supabase = await createClient();
    await supabase
      .from("debate_duels")
      .update({
        status: "expired",
        current_phase: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", rows.duel.id);
    rows.duel.status = "expired";
    rows.duel.current_phase = "completed";
  }

  return toRoomView({
    duel: rows.duel,
    participants: rows.mappedParticipants,
    speeches: rows.speeches,
    judgment: rows.judgment,
    userId,
  });
}

export async function createDebateDuelRoom(
  userId: string,
  input: CreateDebateDuelInput
) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", userId)
    .single();
  const { data: shareCode, error: codeError } = await supabase.rpc(
    "generate_duel_share_code"
  );

  if (codeError || !shareCode) {
    throw new Error(codeError?.message || "Failed to create share code");
  }

  const creatorRole =
    input.sideAssignmentMode === "choose"
      ? input.creatorSidePreference ?? "proposition"
      : null;

  const { data: duel, error } = await supabase
    .from("debate_duels")
    .insert({
      share_code: shareCode,
      creator_id: userId,
      practice_topic_key: input.topicKey ?? null,
      topic_title: input.topicTitle,
      topic_category: input.topicCategory,
      topic_category_key: input.topicCategoryKey ?? null,
      topic_difficulty: input.topicDifficulty,
      topic_description: input.topicDescription ?? null,
      practice_language: coercePracticeLanguage(input.practiceLanguage),
      prep_time_seconds: input.prepTimeSeconds,
      opening_time_seconds: input.openingTimeSeconds,
      rebuttal_time_seconds: input.rebuttalTimeSeconds,
      entry_cost: DUEL_ENTRY_COST,
      side_assignment_mode: input.sideAssignmentMode,
      duel_kind: "custom",
      rated: false,
      creator_side_preference:
        input.sideAssignmentMode === "choose"
          ? input.creatorSidePreference ?? "proposition"
          : null,
    })
    .select("id, share_code")
    .single();

  if (error || !duel) {
    throw new Error(error?.message || "Failed to create duel");
  }

  const { error: participantError } = await supabase
    .from("debate_duel_participants")
    .insert({
      duel_id: duel.id,
      user_id: userId,
      role: creatorRole,
      display_name_snapshot: profile?.display_name || "Debater",
      avatar_url_snapshot: profile?.avatar_url ?? null,
    });

  if (participantError) {
    throw new Error(participantError.message);
  }

  return duel.share_code as string;
}

export async function joinDebateDuelRoom(shareCode: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_debate_duel", {
    p_share_code: normalizeShareCode(shareCode),
    p_actor_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return getDebateDuelRoom(shareCode, userId);
}

export async function setDebateDuelReady(
  shareCode: string,
  userId: string,
  ready: boolean
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_debate_duel_ready", {
    p_share_code: normalizeShareCode(shareCode),
    p_actor_user_id: userId,
    p_ready: ready,
  });

  if (error) {
    throw new Error(error.message);
  }

  return getDebateDuelRoom(shareCode, userId);
}

export async function startDebateDuelRoom(shareCode: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_debate_duel", {
    p_share_code: normalizeShareCode(shareCode),
    p_actor_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return getDebateDuelRoom(shareCode, userId);
}

export interface EnterDebateDuelMatchmakingInput {
  topicCategory: string;
  topicCategoryKey?: string | null;
  topicDifficulty: "beginner" | "intermediate" | "advanced";
  topicKey?: string | null;
  topicTitle: string;
  topicDescription?: string | null;
  practiceLanguage?: PracticeLanguage;
  prepTimeSeconds: number;
  openingTimeSeconds: number;
  rebuttalTimeSeconds: number;
}

export interface DebateDuelIntegrityResult {
  warningCount: number;
  showWarning: boolean;
  message: string | null;
  integrityStatus: DebateDuelRoomView["integrityStatus"];
}

function mapMatchmakingTicket(
  row: DuelMatchmakingTicketRow,
  shareCode: string | null
): DebateDuelMatchmakingTicket {
  const expired =
    row.status === "queued" && new Date(row.expires_at).getTime() <= Date.now();

  return {
    id: row.id,
    status: expired ? "expired" : row.status,
    topicCategory: row.topic_category,
    topicCategoryKey: row.topic_category_key ?? null,
    topicDifficulty: row.topic_difficulty,
    practiceLanguage: coercePracticeLanguage(
      row.practice_language,
      DEFAULT_PRACTICE_LANGUAGE
    ),
    config: {
      prepTimeSeconds: row.prep_time_seconds,
      openingTimeSeconds: row.opening_time_seconds,
      rebuttalTimeSeconds: row.rebuttal_time_seconds,
      entryCost: DUEL_ENTRY_COST,
    },
    matchedDuelId: row.matched_duel_id,
    matchedTicketId: row.matched_ticket_id,
    shareCode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    matchedAt: row.matched_at,
    cancelledAt: row.cancelled_at,
  };
}

async function getShareCodeForDuel(duelId: string | null) {
  if (!duelId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debate_duels")
    .select("share_code")
    .eq("id", duelId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.share_code ?? null;
}

async function fetchMatchmakingTicketById(ticketId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debate_duel_matchmaking_tickets")
    .select(
      "id, user_id, status, topic_category, topic_category_key, topic_difficulty, practice_language, prep_time_seconds, opening_time_seconds, rebuttal_time_seconds, matched_duel_id, matched_ticket_id, expires_at, matched_at, cancelled_at, created_at, updated_at"
    )
    .eq("id", ticketId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;
  const row = data as DuelMatchmakingTicketRow;
  const shareCode = await getShareCodeForDuel(row.matched_duel_id);
  return mapMatchmakingTicket(row, shareCode);
}

export async function getCurrentDebateDuelMatchmakingTicket(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debate_duel_matchmaking_tickets")
    .select(
      "id, user_id, status, topic_category, topic_category_key, topic_difficulty, practice_language, prep_time_seconds, opening_time_seconds, rebuttal_time_seconds, matched_duel_id, matched_ticket_id, expires_at, matched_at, cancelled_at, created_at, updated_at"
    )
    .eq("user_id", userId)
    .in("status", ["queued", "matched"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;
  const row = data as DuelMatchmakingTicketRow;
  const shareCode = await getShareCodeForDuel(row.matched_duel_id);
  return mapMatchmakingTicket(row, shareCode);
}

async function seedDuelMmrProfile(userId: string) {
  const supabase = await createClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 29);
  startDate.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("debate_sessions")
    .select(
      "feedback, total_score, created_at, mode, duration_seconds, topic_difficulty, ai_difficulty"
    )
    .eq("user_id", userId)
    .not("total_score", "is", null)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const snapshot = computeSkillSnapshot((data ?? []) as SkillFeedbackSource[]);
  const hasUsableSnapshot =
    snapshot.overallScore != null && snapshot.confidence >= 0.2;
  const seedRating = hasUsableSnapshot
    ? Math.min(1200, Math.max(800, 1000 + (snapshot.overallScore! - 50) * 8))
    : 1000;
  const seedSnapshot = {
    overallScore: snapshot.overallScore,
    confidence: snapshot.confidence,
    sourceSessions: snapshot.sourceSessions,
    trackBreakdown: snapshot.trackBreakdown,
    difficultyBreakdown: snapshot.difficultyBreakdown,
  };

  const { error: seedError } = await supabase.rpc("ensure_duel_mmr_profile", {
    p_user_id: userId,
    p_seed_rating: seedRating,
    p_seed_source: hasUsableSnapshot ? "skill_snapshot" : "default",
    p_seed_snapshot: seedSnapshot,
  });

  if (seedError) {
    throw new Error(seedError.message);
  }
}

export async function enterDebateDuelMatchmaking(
  userId: string,
  input: EnterDebateDuelMatchmakingInput
) {
  await seedDuelMmrProfile(userId);

  const supabase = await createClient();
  const { data: ticketId, error } = await supabase.rpc(
    "enter_debate_duel_matchmaking",
    {
      p_actor_user_id: userId,
      p_topic_category: input.topicCategory,
      p_topic_category_key: input.topicCategoryKey ?? input.topicCategory,
      p_practice_topic_key: input.topicKey ?? null,
      p_topic_difficulty: input.topicDifficulty,
      p_topic_title: input.topicTitle,
      p_topic_description: input.topicDescription ?? "",
      p_practice_language: coercePracticeLanguage(input.practiceLanguage),
      p_prep_time_seconds: input.prepTimeSeconds,
      p_opening_time_seconds: input.openingTimeSeconds,
      p_rebuttal_time_seconds: input.rebuttalTimeSeconds,
    }
  );

  if (error || !ticketId) {
    throw new Error(error?.message || "Failed to enter matchmaking.");
  }

  return fetchMatchmakingTicketById(String(ticketId), userId);
}

export async function cancelDebateDuelMatchmaking(
  ticketId: string,
  userId: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_debate_duel_matchmaking", {
    p_ticket_id: ticketId,
    p_actor_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return fetchMatchmakingTicketById(ticketId, userId);
}

function classifyIntegrityEvent(input: {
  actionType: string;
  metadata?: Record<string, unknown>;
  source: "client" | "server";
}) {
  const actionType = input.actionType.toUpperCase();
  const clientWarningTypes = new Set([
    "TAB_SWITCH",
    "WINDOW_BLUR",
    "COPY_PASTE",
    "KEYBOARD_SHORTCUT",
    "RIGHT_CLICK",
  ]);
  const technicalTypes = new Set(["WINDOW_FOCUS", "RECONNECT", "DISCONNECT"]);

  if (input.source === "server") {
    if (
      actionType === "EMPTY_TRANSCRIPT" ||
      actionType === "SHORT_TRANSCRIPT" ||
      actionType === "SPEECH_TIMING_ANOMALY"
    ) {
      return {
        severity: "critical" as const,
        isSuspicious: true,
        reason:
          actionType === "EMPTY_TRANSCRIPT"
            ? "No transcript was captured for an active speech."
            : actionType === "SHORT_TRANSCRIPT"
              ? "Speech transcript was unusually short."
              : "Speech timing did not match the active round.",
      };
    }
  }

  if (clientWarningTypes.has(actionType)) {
    return {
      severity: "warning" as const,
      isSuspicious: true,
      reason: "This action can weaken fair-play confidence in matchmaking.",
    };
  }

  return {
    severity: technicalTypes.has(actionType) ? ("info" as const) : ("info" as const),
    isSuspicious: false,
    reason: null,
  };
}

export async function recordDebateDuelIntegrityEvent(input: {
  shareCode: string;
  userId: string;
  actionType: string;
  metadata?: Record<string, unknown>;
  source?: "client" | "server";
}): Promise<DebateDuelIntegrityResult> {
  const source = input.source ?? "client";
  const room = await getDebateDuelRoom(input.shareCode, input.userId);
  if (!room || !room.viewer.participantId) {
    throw new Error("Duel participant required.");
  }

  if (room.duelKind !== "matchmaking") {
    return {
      warningCount: 0,
      showWarning: false,
      message: null,
      integrityStatus: room.integrityStatus,
    };
  }

  const classification = classifyIntegrityEvent({
    actionType: input.actionType,
    metadata: input.metadata,
    source,
  });
  const supabase = await createClient();

  const { error: insertError } = await supabase
    .from("debate_duel_integrity_events")
    .insert({
      duel_id: room.id,
      participant_id: room.viewer.participantId,
      user_id: input.userId,
      action_type: input.actionType.toUpperCase(),
      action_data: input.metadata ?? {},
      severity: classification.severity,
      is_suspicious: classification.isSuspicious,
      suspicious_reason: classification.reason,
    });

  if (insertError) {
    throw new Error(insertError.message);
  }

  const recentWindow = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: suspiciousRows, error: suspiciousError } = await supabase
    .from("debate_duel_integrity_events")
    .select("id, severity")
    .eq("duel_id", room.id)
    .eq("user_id", input.userId)
    .eq("is_suspicious", true)
    .gte("created_at", recentWindow);

  if (suspiciousError) {
    throw new Error(suspiciousError.message);
  }

  const suspiciousCount = suspiciousRows?.length ?? 0;
  const criticalCount =
    suspiciousRows?.filter((row) => row.severity === "critical").length ?? 0;
  const nextStatus =
    source === "server" && criticalCount >= 2
      ? "no_contest"
      : suspiciousCount >= 4
        ? "suspicious"
        : suspiciousCount >= 2
          ? "warned"
          : room.integrityStatus;

  if (nextStatus !== room.integrityStatus) {
    const { error: duelError } = await supabase
      .from("debate_duels")
      .update({
        integrity_status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", room.id);

    if (duelError) {
      throw new Error(duelError.message);
    }
  }

  return {
    warningCount: suspiciousCount,
    showWarning: classification.isSuspicious && suspiciousCount >= 2,
    message:
      classification.isSuspicious && suspiciousCount >= 2
        ? "Fair-play warning: repeated tab, paste, shortcut, or speech-quality issues can exclude this match from hidden skill matching."
        : null,
    integrityStatus: nextStatus,
  };
}

async function processDebateDuelRating(duelId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("process_debate_duel_rating", {
    p_duel_id: duelId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function finalizeDuelAnalytics(duelId: string, totalSeconds: number) {
  const supabase = await createClient();
  const durationMinutes = Math.max(1, Math.round(totalSeconds / 60));
  const { error } = await supabase.rpc("finalize_debate_duel_stats", {
    p_duel_id: duelId,
    p_duration_minutes: durationMinutes,
    p_xp: DUEL_XP_REWARD,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function judgeAndFinalizeDebateDuel(
  duelId: string,
  speeches: DebateDuelSpeech[],
  participants: DebateDuelParticipant[]
) {
  const supabase = await createClient();
  const duel = await getDuelById(duelId);

  const orderedSpeeches = [...speeches].sort(
    (left, right) => left.roundNumber - right.roundNumber
  );

  const participantBySide = new Map(
    participants
      .filter((participant) => participant.role)
      .map((participant) => [participant.role as DebateDuelSide, participant])
  );

  const writeClient = tryCreateAdminClient() ?? supabase;
  const judgeStartedAt = Date.now();
  let telemetry: AiQualityTelemetry | null = null;
  let judgment: DebateDuelJudgment;
  try {
    judgment = await judgeDebateDuel({
      motion: duel.topic_title,
      topicCategory: duel.topic_category,
      practiceLanguage: coercePracticeLanguage(duel.practice_language),
      participants: {
        proposition: {
          participantId: participantBySide.get("proposition")?.id ?? null,
          displayName:
            participantBySide.get("proposition")?.displayName ?? "Proposition",
        },
        opposition: {
          participantId: participantBySide.get("opposition")?.id ?? null,
          displayName:
            participantBySide.get("opposition")?.displayName ?? "Opposition",
        },
      },
      speeches: orderedSpeeches.map((speech) => ({
        id: speech.id,
        roundNumber: speech.roundNumber,
        speechType: speech.speechType,
        side: speech.side,
        label:
          speech.roundNumber === 1
            ? "Proposition Opening"
            : speech.roundNumber === 2
              ? "Opposition Opening"
              : speech.roundNumber === 3
                ? "Proposition Rebuttal"
                : "Opposition Rebuttal",
        transcript: speech.transcript,
        durationSeconds: speech.durationSeconds,
        qualityFlags:
          speech.transcript.trim().split(/\s+/).filter(Boolean).length < 20
            ? ["short_transcript"]
            : [],
      })),
    }, duel.creator_id, (nextTelemetry) => {
      telemetry = nextTelemetry;
    });
  } catch (error) {
    const provider = getDuelJudgeProvider();
    await recordAiQualityRun(writeClient, {
      userId: duel.creator_id,
      outputType: "duel_judging",
      status: "error",
      sourceRoute: "/api/debate-duels/[shareCode]/speeches/[roundNumber]",
      provider: getProviderLabel(provider),
      requestedProvider: getProviderLabel(provider),
      model: getProviderModelName(provider),
      practiceTrack: "debate",
      practiceLanguage: coercePracticeLanguage(duel.practice_language),
      difficulty: duel.topic_difficulty,
      debateFormat: "duel",
      topicTitle: duel.topic_title,
      latencyMs: Date.now() - judgeStartedAt,
      errorCode: "DUEL_JUDGING_FAILED",
      errorMessage: error instanceof Error ? error.message : String(error),
      inputPreview: orderedSpeeches
        .map((speech) => `${speech.side} ${speech.speechType}: ${speech.transcript}`)
        .join("\n\n"),
      debateDuelId: duelId,
      metadata: {
        shareCode: duel.share_code,
        topicCategory: duel.topic_category,
        duelKind: duel.duel_kind,
        speechCount: orderedSpeeches.length,
        participantIds: participants.map((participant) => participant.id),
      },
    }).catch(() => null);
    throw error;
  }

  const winnerParticipantId =
    judgment.winnerSide === "proposition"
      ? participantBySide.get("proposition")?.id ?? null
      : participantBySide.get("opposition")?.id ?? null;

  const aiQualityTelemetry = telemetry as AiQualityTelemetry | null;
  const aiQualityRunId = aiQualityTelemetry
    ? await recordAiQualityRun(writeClient, {
        ...aiQualityTelemetry,
        userId: duel.creator_id,
        outputType: "duel_judging",
        sourceRoute: "/api/debate-duels/[shareCode]/speeches/[roundNumber]",
        practiceTrack: "debate",
        practiceLanguage: coercePracticeLanguage(duel.practice_language),
        difficulty: duel.topic_difficulty,
        debateFormat: "duel",
        topicTitle: duel.topic_title,
        winner: judgment.winnerSide,
        confidence: judgment.confidence,
        outputText: JSON.stringify(judgment),
        inputPreview: orderedSpeeches
          .map((speech) => `${speech.side} ${speech.speechType}: ${speech.transcript}`)
          .join("\n\n"),
        debateDuelId: duelId,
        metadata: {
          shareCode: duel.share_code,
          topicCategory: duel.topic_category,
          duelKind: duel.duel_kind,
          speechCount: orderedSpeeches.length,
          participantIds: participants.map((participant) => participant.id),
        },
      })
    : null;
  judgment.aiQualityRunId = aiQualityRunId;

  const { error: insertError } = await supabase.rpc(
    "store_debate_duel_judgment",
    {
      p_duel_id: duelId,
      p_winner_participant_id: winnerParticipantId,
      p_winner_side: judgment.winnerSide,
      p_judge_model: judgment.model,
      p_confidence: judgment.confidence,
      p_verdict: judgment,
      p_summary: judgment.summary,
    }
  );

  if (insertError) {
    throw new Error(insertError.message);
  }

  const totalSeconds = orderedSpeeches.reduce(
    (sum, speech) => sum + speech.durationSeconds,
    duel.prep_time_seconds + Math.max(30, Math.min(duel.prep_time_seconds, 60))
  );

  await finalizeDuelAnalytics(duelId, totalSeconds);

  const { error: duelError } = await supabase
    .from("debate_duels")
    .update({
      status: "completed",
      current_phase: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", duelId);

  if (duelError) {
    throw new Error(duelError.message);
  }

  await supabase
    .from("debate_duel_participants")
    .update({
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("duel_id", duelId);

  await Promise.all(
    participants.map((participant) =>
      recordAnalyticsEvent(supabase, participant.userId, {
        eventName: "duel_completed",
        featureArea: "duels",
        durationMs: totalSeconds * 1000,
        metadata: {
          duel_id: duelId,
          topic: duel.topic_title,
          practice_language: coercePracticeLanguage(duel.practice_language),
          role: participant.role,
          winner_side: judgment.winnerSide,
          won: participant.role === judgment.winnerSide,
          judge_model: judgment.model,
        },
      })
    )
  );

  try {
    await processDebateDuelRating(duelId);
  } catch (ratingError) {
    if (process.env.NODE_ENV === "development") {
      console.error("Duel hidden MMR processing failed:", ratingError);
    }
  }

  return judgment;
}

export async function submitDebateDuelSpeech(params: {
  shareCode: string;
  userId: string;
  roundNumber: number;
  transcript: string;
  durationSeconds: number;
  audioStoragePath?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const room = await getDebateDuelRoom(params.shareCode, params.userId);
  if (!room || !room.viewer.participantId || !room.viewer.role) {
    throw new Error("You must join the duel before submitting a speech");
  }
  if (room.status !== "in_progress") {
    throw new Error("This duel is not currently running");
  }

  const allowedPhase = room.currentPhase;
  const phaseToRound: Record<
    DebateDuelPhase,
    { roundNumber: number; side: DebateDuelSide; speechType: "opening" | "rebuttal" } | null
  > = {
    lobby: null,
    prep: null,
    "proposition-opening": {
      roundNumber: 1,
      side: "proposition",
      speechType: "opening",
    },
    "opposition-opening": {
      roundNumber: 2,
      side: "opposition",
      speechType: "opening",
    },
    "rebuttal-prep": null,
    "proposition-rebuttal": {
      roundNumber: 3,
      side: "proposition",
      speechType: "rebuttal",
    },
    "opposition-rebuttal": {
      roundNumber: 4,
      side: "opposition",
      speechType: "rebuttal",
    },
    judging: null,
    completed: null,
  };

  const phaseInfo = phaseToRound[allowedPhase];
  if (!phaseInfo) {
    throw new Error("This phase does not accept speeches");
  }

  if (
    phaseInfo.roundNumber !== params.roundNumber ||
    phaseInfo.side !== room.viewer.role
  ) {
    throw new Error("This is not your active round");
  }

  const { error: speechError } = await supabase
    .from("debate_duel_speeches")
    .upsert(
      {
        duel_id: room.id,
        participant_id: room.viewer.participantId,
        round_number: params.roundNumber,
        speech_type: phaseInfo.speechType,
        side: phaseInfo.side,
        transcript: params.transcript,
        audio_storage_path: params.audioStoragePath ?? null,
        duration_seconds: params.durationSeconds,
        metadata: params.metadata ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "duel_id,round_number" }
    );

  if (speechError) {
    throw new Error(speechError.message);
  }

  if (room.duelKind === "matchmaking") {
    const wordCount = params.transcript
      .replace("[No transcript captured]", "")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    const actionType =
      wordCount === 0
        ? "EMPTY_TRANSCRIPT"
        : wordCount < 20
          ? "SHORT_TRANSCRIPT"
          : null;

    if (actionType) {
      try {
        await recordDebateDuelIntegrityEvent({
          shareCode: params.shareCode,
          userId: params.userId,
          actionType,
          metadata: {
            roundNumber: params.roundNumber,
            wordCount,
            durationSeconds: params.durationSeconds,
          },
          source: "server",
        });
      } catch (integrityError) {
        if (process.env.NODE_ENV === "development") {
          console.error("Duel integrity logging failed:", integrityError);
        }
      }
    }
  }

  const nextPhase = getNextDuelPhase(room.currentPhase);
  const nextStatus = nextPhase === "judging" ? "judging" : "in_progress";
  const { error: duelError } = await supabase
    .from("debate_duels")
    .update({
      current_phase: nextPhase,
      status: nextStatus,
      phase_started_at:
        nextPhase === "completed" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", room.id);

  if (duelError) {
    throw new Error(duelError.message);
  }

  const updatedRoom = await getDebateDuelRoom(params.shareCode, params.userId);
  if (!updatedRoom) {
    throw new Error("Failed to reload duel room");
  }

  if (nextPhase === "judging") {
    await judgeAndFinalizeDebateDuel(
      room.id,
      [...updatedRoom.speeches].sort(
        (left, right) => left.roundNumber - right.roundNumber
      ),
      updatedRoom.participants
    );
    return getDebateDuelRoom(params.shareCode, params.userId);
  }

  return updatedRoom;
}

export async function getDebateDuelResult(
  shareCode: string,
  userId: string
): Promise<DebateDuelRoomView | null> {
  const room = await getDebateDuelRoom(shareCode, userId);
  if (!room) return null;
  return room;
}

export async function getDebateDuelHistory(
  userId: string,
  practiceLanguageInput?: PracticeLanguage | string | null
): Promise<DebateDuelHistoryItem[]> {
  const supabase = await createClient();
  const practiceLanguage =
    practiceLanguageInput == null
      ? null
      : coercePracticeLanguage(practiceLanguageInput);

  const { data: participantRows, error } = await supabase
    .from("debate_duel_participants")
    .select("duel_id, role")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  if (error || !participantRows || participantRows.length === 0) {
    return [];
  }

  const duelIds = participantRows.map((row) => row.duel_id);
  let duelQuery = supabase
    .from("debate_duels")
    .select(
      "id, share_code, creator_id, practice_topic_key, topic_title, topic_category, topic_category_key, topic_difficulty, topic_description, practice_language, duel_kind, rated, integrity_status, rating_processed_at, rating_excluded_reason, prep_time_seconds, opening_time_seconds, rebuttal_time_seconds, entry_cost, side_assignment_mode, creator_side_preference, status, current_phase, phase_started_at, started_at, completed_at, expires_at, created_at"
    )
    .in("id", duelIds)
    .eq("status", "completed");

  if (practiceLanguage === "vi") {
    duelQuery = duelQuery.eq("practice_language", "vi");
  } else if (practiceLanguage === "en") {
    duelQuery = duelQuery.or("practice_language.eq.en,practice_language.is.null");
  }

  const { data: duels } = await duelQuery
    .order("created_at", { ascending: false })
    .limit(6);

  if (!duels || duels.length === 0) {
    return [];
  }

  const { data: judgments } = await supabase
    .from("debate_duel_judgments")
    .select(
      "duel_id, winner_side, summary, created_at, judge_model, confidence, verdict, id, winner_participant_id"
    )
    .in(
      "duel_id",
      duels.map((duel) => duel.id)
    );

  const completedDuelIds = duels.map((duel) => duel.id);
  const { data: speeches, error: speechError } = await supabase
    .from("debate_duel_speeches")
    .select("duel_id, duration_seconds")
    .in("duel_id", completedDuelIds);

  if (speechError) {
    throw new Error(speechError.message);
  }

  const judgmentByDuel = new Map(
    ((judgments ?? []) as DuelJudgmentRow[]).map((judgment) => [
      judgment.duel_id,
      judgment,
    ])
  );
  const durationByDuel = new Map<string, number>();
  ((speeches ?? []) as Pick<DuelSpeechRow, "duel_id" | "duration_seconds">[]).forEach(
    (speech) => {
      durationByDuel.set(
        speech.duel_id,
        (durationByDuel.get(speech.duel_id) ?? 0) + speech.duration_seconds
      );
    }
  );
  const roleByDuel = new Map(
    (participantRows as { duel_id: string; role: DebateDuelSide | null }[]).map(
      (row) => [row.duel_id, row.role]
    )
  );

  return (duels as DuelRow[]).map((duel) => {
    const speechSeconds = durationByDuel.get(duel.id) ?? 0;
    const prepSeconds =
      duel.prep_time_seconds + Math.max(30, Math.min(duel.prep_time_seconds, 60));

    return {
      id: duel.id,
      shareCode: duel.share_code,
      topicTitle: duel.topic_title,
      role: roleByDuel.get(duel.id) ?? null,
      winnerSide: judgmentByDuel.get(duel.id)?.winner_side ?? null,
      summary:
        judgmentByDuel.get(duel.id)?.summary ||
        "AI judged this duel after the final rebuttal.",
      durationSeconds: speechSeconds > 0 ? prepSeconds + speechSeconds : null,
      createdAt: duel.created_at,
      href: `/debates/${duel.share_code}/result`,
    };
  });
}
