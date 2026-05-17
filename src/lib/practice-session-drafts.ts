import { createClient } from "@/lib/supabase/client";
import {
  SOLO_PREP_DURATION,
  SOLO_SPEECH_DURATION,
  clampDurationSeconds,
} from "@/lib/practice-durations";
import {
  DEFAULT_PRACTICE_LANGUAGE,
  coercePracticeLanguage,
} from "@/lib/practice-language";
import type { Mode, Phase } from "@/store/session-store";
import type {
  AiDifficulty,
  DebateRound,
  DebateTopic,
  PracticeLanguage,
  PracticeTrack,
} from "@/types";

const STORAGE_KEY = "debatelab_practice_draft_id";
const LOCAL_DRAFT_KEY = "debatelab_practice_local_draft";

export interface PracticeSessionDraftPayload {
  selectedTopic: DebateTopic;
  side: "proposition" | "opposition";
  practiceTrack: PracticeTrack;
  practiceLanguage: PracticeLanguage;
  mode: Mode;
  prepTime: number;
  speechTime: number;
  aiDifficulty: AiDifficulty;
  currentPhase: Phase;
  currentRound: number;
  prepNotes: string;
  transcript: string;
  rounds: DebateRound[];
  sessionStartTime: number | null;
}

interface PracticeSessionDraftRow {
  id: string;
  topic_id: string | null;
  topic_title: string;
  topic_category: string;
  topic_difficulty: DebateTopic["difficulty"];
  side: "proposition" | "opposition";
  practice_track: PracticeTrack;
  practice_language?: PracticeLanguage | null;
  mode: Mode;
  prep_time: number;
  speech_time: number;
  ai_difficulty: AiDifficulty | null;
  current_phase: Phase;
  current_round: number;
  prep_notes: string | null;
  transcript: string | null;
  rounds: DebateRound[] | null;
  session_started_at: string | null;
}

function payloadToRow(userId: string, payload: PracticeSessionDraftPayload) {
  return {
    user_id: userId,
    topic_id: payload.selectedTopic.id,
    topic_title: payload.selectedTopic.title,
    topic_category: payload.selectedTopic.category,
    topic_difficulty: payload.selectedTopic.difficulty ?? "intermediate",
    side: payload.side,
    practice_track: payload.practiceTrack,
    practice_language: coercePracticeLanguage(payload.practiceLanguage),
    mode: payload.mode,
    prep_time: clampDurationSeconds(payload.prepTime, SOLO_PREP_DURATION),
    speech_time: clampDurationSeconds(payload.speechTime, SOLO_SPEECH_DURATION),
    ai_difficulty: payload.aiDifficulty,
    current_phase: payload.currentPhase,
    current_round: payload.currentRound,
    prep_notes: payload.prepNotes,
    transcript: payload.transcript,
    rounds: payload.rounds,
    session_started_at: payload.sessionStartTime
      ? new Date(payload.sessionStartTime).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  };
}

function rowToPayload(row: PracticeSessionDraftRow): PracticeSessionDraftPayload {
  return {
    selectedTopic: {
      id: row.topic_id ?? row.id,
      title: row.topic_title,
      category: row.topic_category,
      difficulty: row.topic_difficulty ?? "intermediate",
    },
    side: row.side,
    practiceTrack: row.practice_track,
    practiceLanguage: coercePracticeLanguage(
      row.practice_language,
      DEFAULT_PRACTICE_LANGUAGE
    ),
    mode: row.mode,
    prepTime: clampDurationSeconds(row.prep_time, SOLO_PREP_DURATION),
    speechTime: clampDurationSeconds(row.speech_time, SOLO_SPEECH_DURATION),
    aiDifficulty: row.ai_difficulty ?? "medium",
    currentPhase: row.current_phase,
    currentRound: row.current_round,
    prepNotes: row.prep_notes ?? "",
    transcript: row.transcript ?? "",
    rounds: row.rounds ?? [],
    sessionStartTime: row.session_started_at
      ? new Date(row.session_started_at).getTime()
      : null,
  };
}

export function getStoredPracticeDraftId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredPracticeDraftId(draftId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, draftId);
}

export function clearStoredPracticeDraftId(draftId?: string | null) {
  if (typeof window === "undefined") return;
  const storedDraftId = getStoredPracticeDraftId();
  if (!draftId || storedDraftId === draftId) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function getLocalPracticeSessionDraft() {
  if (typeof window === "undefined") return null;

  const rawDraft = window.localStorage.getItem(LOCAL_DRAFT_KEY);
  if (!rawDraft) return null;

  try {
    return JSON.parse(rawDraft) as PracticeSessionDraftPayload;
  } catch {
    window.localStorage.removeItem(LOCAL_DRAFT_KEY);
    return null;
  }
}

export function setLocalPracticeSessionDraft(
  payload: PracticeSessionDraftPayload
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(payload));
}

export function clearLocalPracticeSessionDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOCAL_DRAFT_KEY);
}

export async function createPracticeSessionDraft(
  userId: string,
  payload: PracticeSessionDraftPayload
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("practice_session_drafts")
    .insert(payloadToRow(userId, payload))
    .select("id")
    .single();

  if (error || !data?.id) {
    throw error ?? new Error("Failed to create practice draft.");
  }

  return data.id as string;
}

export async function updatePracticeSessionDraft(
  draftId: string,
  userId: string,
  payload: PracticeSessionDraftPayload
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("practice_session_drafts")
    .update(payloadToRow(userId, payload))
    .eq("id", draftId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function loadPracticeSessionDraft(draftId: string, userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("practice_session_drafts")
    .select(
      "id, topic_id, topic_title, topic_category, topic_difficulty, side, practice_track, practice_language, mode, prep_time, speech_time, ai_difficulty, current_phase, current_round, prep_notes, transcript, rounds, session_started_at"
    )
    .eq("id", draftId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    draftId: data.id as string,
    ...rowToPayload(data as PracticeSessionDraftRow),
  };
}

export async function deletePracticeSessionDraft(
  draftId: string,
  userId: string
) {
  const supabase = createClient();
  await supabase
    .from("practice_session_drafts")
    .delete()
    .eq("id", draftId)
    .eq("user_id", userId);
  clearStoredPracticeDraftId(draftId);
}
