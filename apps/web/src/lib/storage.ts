import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { checkAndUnlockAchievements } from "@/lib/achievements";
import { trackAnalyticsEvent } from "@/lib/hooks/useAnalyticsEventTracker";
import { recordPerformanceAttemptForSession } from "@/lib/performance/club-performance-recorder";
import {
  DEFAULT_PRACTICE_LANGUAGE,
  coercePracticeLanguage,
} from "@/lib/practice-language";
import { getTopicCategoryKey, getTopicStableKey } from "@/lib/topics";
import type { DebateSession, PracticeLanguage } from "@/types";

const STORAGE_KEY = "debatelab_sessions";
const LOCAL_IMPORT_ID_MAP_KEY = "debatelab_session_import_ids";
const STORAGE_UPDATE_EVENT = "debatelab:sessions-updated";
const MAX_SESSIONS = 50;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FULL_SESSION_SELECT =
  "id, created_at, topic_id, practice_topic_key, topic_title, topic_category, topic_category_key, topic_difficulty, side, practice_track, practice_language, mode, prep_time, speech_time, transcript, feedback, duration_seconds, prep_notes, ai_difficulty, rounds";
const BASE_SESSION_SELECT =
  "id, created_at, topic_title, topic_category, topic_difficulty, side, mode, prep_time, speech_time, transcript, feedback, duration_seconds";
const OPTIONAL_SESSION_COLUMNS = [
  "practice_topic_key",
  "topic_category_key",
  "practice_track",
  "practice_language",
  "prep_notes",
  "ai_difficulty",
  "rounds",
  "total_score",
  "overall_band",
] as const;

interface GetSessionsOptions {
  practiceLanguage?: PracticeLanguage;
}

export function filterSessionsByPracticeLanguage(
  sessions: DebateSession[],
  practiceLanguage?: PracticeLanguage
) {
  if (!practiceLanguage) return sessions;

  return sessions.filter(
    (session) =>
      coercePracticeLanguage(session.practiceLanguage, DEFAULT_PRACTICE_LANGUAGE) ===
      practiceLanguage
  );
}

// localStorage adapter (fallback)
const localAdapter = {
  saveSession(session: DebateSession): void {
    const sessions = this
      .getSessions()
      .filter((storedSession) => storedSession.id !== session.id);
    sessions.unshift(session);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(sessions.slice(0, MAX_SESSIONS))
    );
    window.dispatchEvent(new Event(STORAGE_UPDATE_EVENT));
  },

  getSessions(): DebateSession[] {
    if (typeof window === "undefined") return [];
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? (JSON.parse(data) as DebateSession[]) : [];
  },

  getSession(id: string): DebateSession | null {
    return this.getSessions().find((s) => s.id === id) ?? null;
  },

  deleteSession(id: string): void {
    const sessions = this.getSessions().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  },
};

// Supabase adapter
const supabaseAdapter = {
  async saveSession(session: DebateSession, userId: string): Promise<void> {
    const supabase = createClient();
    localAdapter.saveSession(session);

    const row = sessionToRow(session, userId);

    const { error } = await insertSessionRows(row);
    if (error) {
      console.warn("Failed to save debate session to Supabase", error.message);
      return;
    }

    const performanceResult = await recordPerformanceAttemptForSession(
      supabase,
      session,
      userId
    );
    if (!performanceResult.ok && performanceResult.error) {
      console.warn("Failed to record performance attempt", performanceResult.error);
    }

    if (typeof window !== "undefined") {
      posthog.capture("debate_completed", {
        topic: session.topic.title,
        category: session.topic.category,
        stance: session.side,
        practice_track: session.practiceTrack,
        practice_language: session.practiceLanguage,
        mode: session.mode,
        difficulty: session.topic.difficulty,
        score: session.feedback?.totalScore ?? null,
        duration_seconds: session.duration,
      });
    }

    trackAnalyticsEvent({
      eventName: "practice_completed",
      featureArea: "practice",
      route: window.location.pathname,
      durationMs: session.duration * 1000,
      metadata: {
        debate_session_id: session.id,
        topic: session.topic.title,
        practice_track: session.practiceTrack,
        practice_language: session.practiceLanguage,
        mode: session.mode,
        score: session.feedback?.totalScore ?? null,
      },
    });

    const today = new Date().toISOString().split("T")[0];
    const durationMinutes = Math.round(session.duration / 60);

    // Update session count, practice minutes, and streak
    const { data: profileData } = await supabase
      .from("profiles")
      .select("total_sessions_completed, total_practice_minutes, streak_current, streak_longest, streak_last_active_date")
      .eq("id", userId)
      .single();

    if (profileData) {
      let newStreak = profileData.streak_current ?? 0;
      const lastActive = profileData.streak_last_active_date;
      if (lastActive !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        newStreak = lastActive === yesterdayStr ? newStreak + 1 : 1;
      }
      const newLongest = Math.max(newStreak, profileData.streak_longest ?? 0);

      await supabase
        .from("profiles")
        .update({
          total_sessions_completed: (profileData.total_sessions_completed ?? 0) + 1,
          total_practice_minutes: (profileData.total_practice_minutes ?? 0) + durationMinutes,
          streak_current: newStreak,
          streak_longest: newLongest,
          streak_last_active_date: today,
        })
        .eq("id", userId);
    }

    // Check for newly unlocked achievements (fire-and-forget)
    checkAndUnlockAchievements(userId).catch(() => {});
  },

  async getSessions(
    userId: string,
    options: GetSessionsOptions = {}
  ): Promise<DebateSession[]> {
    const { data, error } = await querySessions(userId, options);

    if (error || !data) {
      const allLocalSessions = localAdapter.getSessions();
      await syncLocalOnlySessions(userId, allLocalSessions);
      return filterSessionsByPracticeLanguage(
        allLocalSessions,
        options.practiceLanguage
      );
    }

    const remoteSessions = data.map(rowToSession);
    const remoteIds = new Set(remoteSessions.map((session) => session.id));
    const importIdResolver = createImportIdResolver();
    const allLocalSessions = localAdapter.getSessions();
    const localOnlySessions = allLocalSessions.filter((localSession) => {
      const importId = importIdResolver.resolve(localSession);
      return importId ? !remoteIds.has(importId) : !remoteIds.has(localSession.id);
    });
    importIdResolver.flush();

    await syncLocalOnlySessions(userId, localOnlySessions);

    const visibleLocalSessions = filterSessionsByPracticeLanguage(
      localOnlySessions,
      options.practiceLanguage
    );

    return [...remoteSessions, ...visibleLocalSessions]
      .sort(
        (left, right) =>
          new Date(right.date).getTime() - new Date(left.date).getTime()
      )
      .slice(0, MAX_SESSIONS);
  },

  async getSession(
    id: string,
    userId: string
  ): Promise<DebateSession | null> {
    const supabase = createClient();
    const initialResult = await supabase
      .from("debate_sessions")
      .select(FULL_SESSION_SELECT)
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    let data: Record<string, unknown> | null = initialResult.data;
    let error = initialResult.error;

    if (isSchemaCompatibilityError(error)) {
      const retry = await supabase
        .from("debate_sessions")
        .select(BASE_SESSION_SELECT)
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      return localAdapter.getSession(id);
    }
    return rowToSession(data);
  },

  async deleteSession(id: string, userId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from("debate_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      // deletion failed silently
    }
    localAdapter.deleteSession(id);
  },
};

function readImportIdMap(): Record<string, string> {
  if (typeof window === "undefined") return {};

  try {
    const data = localStorage.getItem(LOCAL_IMPORT_ID_MAP_KEY);
    if (!data) return {};
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function writeImportIdMap(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_IMPORT_ID_MAP_KEY, JSON.stringify(map));
}

function createImportId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return null;
}

function createImportIdResolver() {
  const importIdMap = readImportIdMap();
  let didChangeMap = false;

  return {
    resolve(session: DebateSession) {
      if (UUID_PATTERN.test(session.id)) return session.id;

      const mappedId = importIdMap[session.id];
      if (mappedId && UUID_PATTERN.test(mappedId)) return mappedId;

      const generatedId = createImportId();
      if (!generatedId) return null;

      importIdMap[session.id] = generatedId;
      didChangeMap = true;
      return generatedId;
    },
    flush() {
      if (didChangeMap) {
        writeImportIdMap(importIdMap);
      }
    },
  };
}

function sessionToRow(
  session: DebateSession,
  userId: string,
  options: { preserveCreatedAt?: boolean; idOverride?: string } = {}
) {
  const createdAt = new Date(session.date);

  return {
    id: options.idOverride ?? session.id,
    user_id: userId,
    practice_topic_key: getTopicStableKey(session.topic),
    topic_title: session.topic.title,
    topic_category: session.topic.category,
    topic_category_key: getTopicCategoryKey(session.topic),
    topic_difficulty: session.topic.difficulty ?? "intermediate",
    side: session.side,
    practice_track: session.practiceTrack,
    practice_language: coercePracticeLanguage(session.practiceLanguage),
    mode: session.mode,
    prep_time: session.prepTime,
    speech_time: session.speechTime,
    transcript: session.transcript,
    prep_notes: session.prepNotes ?? null,
    ai_difficulty: session.aiDifficulty ?? null,
    rounds: session.rounds ?? null,
    feedback: session.feedback as Record<string, unknown> | null,
    total_score: session.feedback?.totalScore ?? 0,
    overall_band: session.feedback?.overallBand ?? "Unrated",
    duration_seconds: session.duration,
    ...(options.preserveCreatedAt && !Number.isNaN(createdAt.getTime())
      ? { created_at: createdAt.toISOString() }
      : {}),
  };
}

function stripOptionalSessionColumns<T extends Record<string, unknown>>(row: T) {
  const compatibleRow = { ...row };
  for (const column of OPTIONAL_SESSION_COLUMNS) {
    delete compatibleRow[column];
  }
  return compatibleRow;
}

function isSchemaCompatibilityError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("Could not find") ||
    message.includes("schema cache") ||
    message.includes("column")
  );
}

async function insertSessionRows(
  rows: ReturnType<typeof sessionToRow> | ReturnType<typeof sessionToRow>[]
) {
  const supabase = createClient();
  const { error } = await supabase.from("debate_sessions").insert(rows);

  if (!isSchemaCompatibilityError(error)) {
    return { error };
  }

  const compatibleRows = Array.isArray(rows)
    ? rows.map(stripOptionalSessionColumns)
    : stripOptionalSessionColumns(rows);

  return supabase.from("debate_sessions").insert(compatibleRows);
}

async function upsertSessionRows(
  rows: ReturnType<typeof sessionToRow> | ReturnType<typeof sessionToRow>[]
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("debate_sessions")
    .upsert(rows, { ignoreDuplicates: true, onConflict: "id" });

  if (!isSchemaCompatibilityError(error)) {
    return { error };
  }

  const compatibleRows = Array.isArray(rows)
    ? rows.map(stripOptionalSessionColumns)
    : stripOptionalSessionColumns(rows);

  return supabase
    .from("debate_sessions")
    .upsert(compatibleRows, { ignoreDuplicates: true, onConflict: "id" });
}

async function querySessions(
  userId: string,
  options: GetSessionsOptions = {}
) {
  const supabase = createClient();
  let query = supabase
    .from("debate_sessions")
    .select(FULL_SESSION_SELECT)
    .eq("user_id", userId);

  if (options.practiceLanguage === "vi") {
    query = query.eq("practice_language", "vi");
  } else if (options.practiceLanguage === "en") {
    query = query.or("practice_language.eq.en,practice_language.is.null");
  }

  const result = await query
    .order("created_at", { ascending: false })
    .limit(MAX_SESSIONS);

  if (!isSchemaCompatibilityError(result.error)) {
    return result;
  }

  if (options.practiceLanguage === "vi") {
    return { data: [], error: null };
  }

  return supabase
    .from("debate_sessions")
    .select(BASE_SESSION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_SESSIONS);
}

async function syncLocalOnlySessions(
  userId: string,
  localOnlySessions: DebateSession[]
) {
  const importIdResolver = createImportIdResolver();
  const importableSessions = localOnlySessions
    .map((session) => ({
      importId: importIdResolver.resolve(session),
      session,
    }))
    .filter(
      (item): item is { importId: string; session: DebateSession } =>
        item.importId !== null
    );
  importIdResolver.flush();

  if (importableSessions.length === 0) return;

  const rows = importableSessions.map(({ importId, session }) =>
    sessionToRow(session, userId, {
      idOverride: importId,
      preserveCreatedAt: true,
    })
  );

  const { error } = await upsertSessionRows(rows);
  if (error) {
    console.warn("Failed to sync local practice history to Supabase", error.message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSession(row: any): DebateSession {
  return {
    id: row.id,
    date: row.created_at,
    topic: {
      id: row.practice_topic_key ?? row.topic_id ?? row.id,
      topicKey: row.practice_topic_key ?? row.topic_id ?? row.id,
      categoryKey: row.topic_category_key,
      title: row.topic_title,
      category: row.topic_category,
      difficulty: row.topic_difficulty ?? "intermediate",
    },
    side: row.side,
    practiceTrack:
      row.practice_track ??
      row.practiceTrack ??
      row.feedback?.practiceTrack ??
      "debate",
    practiceLanguage: coercePracticeLanguage(
      row.practice_language ?? row.practiceLanguage ?? row.feedback?.practiceLanguage,
      DEFAULT_PRACTICE_LANGUAGE
    ),
    mode: row.mode,
    prepTime: row.prep_time,
    speechTime: row.speech_time,
    transcript: row.transcript,
    feedback: row.feedback,
    duration: row.duration_seconds,
    prepNotes: row.prep_notes,
    aiDifficulty: row.ai_difficulty,
    rounds: row.rounds,
  };
}

// Unified storage interface
export const storage = {
  saveSession(session: DebateSession): void {
    localAdapter.saveSession(session);
  },

  getSessions(): DebateSession[] {
    return localAdapter.getSessions();
  },

  getSession(id: string): DebateSession | null {
    return localAdapter.getSession(id);
  },

  deleteSession(id: string): void {
    localAdapter.deleteSession(id);
  },
};

// Async Supabase storage for authenticated users
export const supabaseStorage = supabaseAdapter;
