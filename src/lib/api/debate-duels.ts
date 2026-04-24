import "server-only";

import { createClient } from "@/lib/supabase/server";
import { judgeDebateDuel } from "@/lib/gemini";
import {
  DUEL_ENTRY_COST,
  DUEL_XP_REWARD,
  getNextDuelPhase,
} from "@/lib/debate-duels/shared";
import type {
  DebateDuelJudgment,
  DebateDuelParticipant,
  DebateDuelPhase,
  DebateDuelRoomView,
  DebateDuelSide,
  DebateDuelSideAssignmentMode,
  DebateDuelSpeech,
} from "@/types";

type DuelRow = {
  id: string;
  share_code: string;
  creator_id: string;
  topic_title: string;
  topic_category: string;
  topic_description: string | null;
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

export interface CreateDebateDuelInput {
  topicTitle: string;
  topicCategory: string;
  topicDescription?: string;
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
      "id, share_code, creator_id, topic_title, topic_category, topic_description, prep_time_seconds, opening_time_seconds, rebuttal_time_seconds, entry_cost, side_assignment_mode, creator_side_preference, status, current_phase, phase_started_at, started_at, completed_at, expires_at, created_at"
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

  const mappedParticipants: DebateDuelParticipant[] = (participants ?? []).map(
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
    topicTitle: duel.topic_title,
    topicCategory: duel.topic_category,
    topicDescription: duel.topic_description,
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
      duel.creator_id === userId &&
      everyoneReady,
  } satisfies DebateDuelRoomView;
}

async function getDuelById(duelId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debate_duels")
    .select(
      "id, share_code, creator_id, topic_title, topic_category, topic_description, prep_time_seconds, opening_time_seconds, rebuttal_time_seconds, entry_cost, side_assignment_mode, creator_side_preference, status, current_phase, phase_started_at, started_at, completed_at, expires_at, created_at"
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
      topic_title: input.topicTitle,
      topic_category: input.topicCategory,
      topic_description: input.topicDescription ?? null,
      prep_time_seconds: input.prepTimeSeconds,
      opening_time_seconds: input.openingTimeSeconds,
      rebuttal_time_seconds: input.rebuttalTimeSeconds,
      entry_cost: DUEL_ENTRY_COST,
      side_assignment_mode: input.sideAssignmentMode,
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
  const room = await getDebateDuelRoom(shareCode, userId);
  if (!room) throw new Error("Duel room not found");
  if (room.status !== "lobby") throw new Error("This duel has already started");
  if (room.viewer.isParticipant) return room;
  if (room.participants.length >= 2) {
    throw new Error("This duel room is already full");
  }

  const joinRole =
    room.sideAssignmentMode === "choose" && room.creatorSidePreference
      ? room.creatorSidePreference === "proposition"
        ? "opposition"
        : "proposition"
      : null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", userId)
    .single();

  const { error } = await supabase.from("debate_duel_participants").insert({
    duel_id: room.id,
    user_id: userId,
    role: joinRole,
    display_name_snapshot: profile?.display_name || "Debater",
    avatar_url_snapshot: profile?.avatar_url ?? null,
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
  const room = await getDebateDuelRoom(shareCode, userId);
  if (!room?.viewer.participantId) {
    throw new Error("Join the duel before marking ready");
  }

  const { error } = await supabase
    .from("debate_duel_participants")
    .update({
      ready_at: ready ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", room.viewer.participantId);

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

  const judgment = await judgeDebateDuel({
    motion: duel.topic_title,
    topicCategory: duel.topic_category,
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
  });

  const winnerParticipantId =
    judgment.winnerSide === "proposition"
      ? participantBySide.get("proposition")?.id ?? null
      : participantBySide.get("opposition")?.id ?? null;

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
  userId: string
): Promise<DebateDuelHistoryItem[]> {
  const supabase = await createClient();

  const { data: participantRows, error } = await supabase
    .from("debate_duel_participants")
    .select("duel_id, role")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  if (error || !participantRows || participantRows.length === 0) {
    return [];
  }

  const duelIds = participantRows.map((row) => row.duel_id);
  const { data: duels } = await supabase
    .from("debate_duels")
    .select(
      "id, share_code, creator_id, topic_title, topic_category, topic_description, prep_time_seconds, opening_time_seconds, rebuttal_time_seconds, entry_cost, side_assignment_mode, creator_side_preference, status, current_phase, phase_started_at, started_at, completed_at, expires_at, created_at"
    )
    .in("id", duelIds)
    .eq("status", "completed")
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
