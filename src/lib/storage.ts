import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";
import { checkAndUnlockAchievements } from "@/lib/achievements";
import type { DebateSession } from "@/types";

const STORAGE_KEY = "debatelab_sessions";
const MAX_SESSIONS = 50;

// localStorage adapter (fallback)
const localAdapter = {
  saveSession(session: DebateSession): void {
    const sessions = this.getSessions();
    sessions.unshift(session);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(sessions.slice(0, MAX_SESSIONS))
    );
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

    const row = {
      id: session.id,
      user_id: userId,
      topic_title: session.topic.title,
      category: session.topic.category,
      topic_difficulty: session.topic.difficulty ?? "intermediate",
      side: session.side,
      mode: session.mode,
      prep_time_seconds: session.prepTime,
      speech_time_seconds: session.speechTime,
      transcript: session.transcript,
      prep_notes: session.prepNotes ?? null,
      ai_difficulty: session.aiDifficulty ?? null,
      rounds: session.rounds ?? null,
      feedback: session.feedback as Record<string, unknown> | null,
      total_score: session.feedback?.totalScore ?? 0,
      overall_band: session.feedback?.overallBand ?? "Unrated",
      duration_seconds: session.duration,
    };

    const { error } = await supabase.from("debate_sessions").insert(row);
    if (error) {
      console.error("Failed to save session to Supabase:", error);
      // Fall back to localStorage
      localAdapter.saveSession(session);
      return;
    }

    if (typeof window !== "undefined") {
      posthog.capture("debate_completed", {
        topic: session.topic.title,
        category: session.topic.category,
        stance: session.side,
        mode: session.mode,
        difficulty: session.topic.difficulty,
        score: session.feedback?.totalScore ?? null,
        duration_seconds: session.duration,
      });
    }

    // Insert activity log
    await supabase.from("activity_log").insert({
      user_id: userId,
      activity_type: "debate_completed",
      reference_id: session.id,
      reference_type: "debate_session",
      xp_earned: calculateXp(session),
      metadata: {
        topic: session.topic.title,
        mode: session.mode,
        score: session.feedback?.totalScore ?? null,
        band: session.feedback?.overallBand ?? null,
      },
    });

    // Upsert daily stats atomically via RPC
    const today = new Date().toISOString().split("T")[0];
    const durationMinutes = Math.round(session.duration / 60);
    const xpEarned = calculateXp(session);

    await supabase.rpc("upsert_daily_stats", {
      p_user_id: userId,
      p_sessions: 1,
      p_minutes: durationMinutes,
      p_xp: xpEarned,
      p_score: session.feedback?.totalScore ?? null,
    });

    // Award XP atomically via RPC
    await supabase.rpc("increment_xp", { user_id: userId, amount: xpEarned });

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

  async getSessions(userId: string): Promise<DebateSession[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("debate_sessions")
      .select("id, created_at, topic_title, category, topic_difficulty, side, mode, prep_time_seconds, speech_time_seconds, transcript, feedback, duration_seconds, prep_notes, ai_difficulty, rounds")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_SESSIONS);

    if (error || !data) {
      console.error("Failed to fetch sessions from Supabase:", error);
      return localAdapter.getSessions();
    }

    return data.map(rowToSession);
  },

  async getSession(
    id: string,
    userId: string
  ): Promise<DebateSession | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("debate_sessions")
      .select("id, created_at, topic_title, category, topic_difficulty, side, mode, prep_time_seconds, speech_time_seconds, transcript, feedback, duration_seconds, prep_notes, ai_difficulty, rounds")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !data) return null;
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
      console.error("Failed to delete session from Supabase:", error);
    }
  },
};

function calculateXp(session: DebateSession): number {
  let xp = 25; // base XP for completing a debate session
  if (session.mode === "full") {
    xp += 10; // bonus for full round
  }
  return xp;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSession(row: any): DebateSession {
  return {
    id: row.id,
    date: row.created_at,
    topic: {
      id: row.topic_id ?? row.id,
      title: row.topic_title,
      category: row.category,
      difficulty: row.topic_difficulty ?? "intermediate",
    },
    side: row.side,
    mode: row.mode,
    prepTime: row.prep_time_seconds,
    speechTime: row.speech_time_seconds,
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
