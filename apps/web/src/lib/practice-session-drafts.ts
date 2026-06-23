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
import { getTopicCategoryKey, getTopicStableKey } from "@/lib/topics";
import type { Mode, Phase } from "@/store/session-store";
import type {
  AiDifficulty,
  DebateMemory,
  DebateRound,
  DebateTopic,
  PracticeLanguage,
  PracticeTrack,
} from "@/types";

const STORAGE_KEY = "debatelab_practice_draft_id";
const LOCAL_DRAFT_KEY = "debatelab_practice_local_draft";
const PENDING_HANDOFF_KEY = "debatelab_practice_pending_session";
const PENDING_HANDOFF_TTL_MS = 10 * 60 * 1000;

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
  debateMemory?: DebateMemory | null;
  sessionStartTime: number | null;
}

interface PendingPracticeSessionHandoff {
  createdAt: number;
  payload: PracticeSessionDraftPayload;
}

interface PracticeSessionDraftRow {
  id: string;
  topic_id: string | null;
  practice_topic_key?: string | null;
  topic_title: string;
  topic_category: string;
  topic_category_key?: string | null;
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
    practice_topic_key: getTopicStableKey(payload.selectedTopic),
    topic_title: payload.selectedTopic.title,
    topic_category: payload.selectedTopic.category,
    topic_category_key: getTopicCategoryKey(payload.selectedTopic),
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
      id: row.practice_topic_key ?? row.topic_id ?? row.id,
      topicKey: row.practice_topic_key ?? row.topic_id ?? row.id,
      categoryKey: row.topic_category_key ?? undefined,
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
    debateMemory:
      row.rounds?.slice().reverse().find((round) => round.debateMemory)
        ?.debateMemory ?? null,
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPracticeSessionDraftPayload(
  value: unknown
): value is PracticeSessionDraftPayload {
  if (!isPlainObject(value)) return false;

  const selectedTopic = value.selectedTopic;
  return (
    isPlainObject(selectedTopic) &&
    typeof selectedTopic.title === "string" &&
    typeof selectedTopic.category === "string" &&
    (value.side === "proposition" || value.side === "opposition") &&
    (value.practiceTrack === "speaking" || value.practiceTrack === "debate") &&
    (value.mode === "quick" || value.mode === "full") &&
    typeof value.prepTime === "number" &&
    typeof value.speechTime === "number" &&
    typeof value.currentPhase === "string" &&
    typeof value.currentRound === "number"
  );
}

function readPendingPracticeSessionHandoff() {
  if (typeof window === "undefined") return null;

  const rawHandoff = window.localStorage.getItem(PENDING_HANDOFF_KEY);
  if (!rawHandoff) return null;

  try {
    const parsed = JSON.parse(rawHandoff) as unknown;
    if (!isPlainObject(parsed)) return null;

    const createdAt =
      typeof parsed.createdAt === "number" ? parsed.createdAt : 0;
    if (
      createdAt <= 0 ||
      Date.now() - createdAt > PENDING_HANDOFF_TTL_MS ||
      !isPracticeSessionDraftPayload(parsed.payload)
    ) {
      window.localStorage.removeItem(PENDING_HANDOFF_KEY);
      return null;
    }

    return {
      createdAt,
      payload: parsed.payload,
    };
  } catch {
    window.localStorage.removeItem(PENDING_HANDOFF_KEY);
    return null;
  }
}

export function setPendingPracticeSessionHandoff(
  payload: PracticeSessionDraftPayload
) {
  if (typeof window === "undefined") return;

  const handoff: PendingPracticeSessionHandoff = {
    createdAt: Date.now(),
    payload,
  };
  window.localStorage.setItem(PENDING_HANDOFF_KEY, JSON.stringify(handoff));
}

export function consumePendingPracticeSessionHandoff() {
  const handoff = readPendingPracticeSessionHandoff();
  if (typeof window !== "undefined" && handoff) {
    window.localStorage.removeItem(PENDING_HANDOFF_KEY);
  }
  return handoff?.payload ?? null;
}

export function clearPendingPracticeSessionHandoff() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_HANDOFF_KEY);
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
      "id, topic_id, practice_topic_key, topic_title, topic_category, topic_category_key, topic_difficulty, side, practice_track, practice_language, mode, prep_time, speech_time, ai_difficulty, current_phase, current_round, prep_notes, transcript, rounds, session_started_at"
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
