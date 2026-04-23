import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  computeSkillSnapshot,
  roundToTenth,
  type SkillMetricKey,
} from "@/lib/analytics/skill-snapshot";
import type {
  AnalyticsInsightCard,
  AnalyticsPageData,
  AnalyticsRangePreset,
  AnalyticsRecentSession,
  DebateDuelJudgment,
  DebateDuelSide,
  DebateScore,
  PracticeTrack,
  Profile,
} from "@/types";

const RANGE_DAYS: Record<AnalyticsRangePreset, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const USER_TIMEZONE = "America/New_York";
const XP_PER_LEVEL = 500;
const MAX_RECENT_SESSIONS = 6;
const MAX_LIFETIME_SKILL_SESSIONS = 250;

type DailyStatRow = {
  date: string;
  minutes_studied: number;
  sessions_completed: number;
  average_score: number | null;
};

type SoloSessionRow = {
  id: string;
  topic_title: string;
  topic_category: string;
  side: DebateDuelSide;
  mode: "quick" | "full";
  feedback: DebateScore | null;
  total_score: number | null;
  overall_band: string | null;
  duration_seconds: number;
  created_at: string;
};

type DuelParticipantRow = {
  duel_id: string;
  role: DebateDuelSide | null;
};

type DuelRow = {
  id: string;
  share_code: string;
  topic_title: string;
  topic_category: string;
  completed_at: string | null;
  created_at: string;
};

type DuelJudgmentRow = {
  duel_id: string;
  winner_side: DebateDuelSide | null;
  confidence: number | null;
  verdict: DebateDuelJudgment | null;
};

type DuelSpeechRow = {
  duel_id: string;
  duration_seconds: number;
};

function normalizeRangePreset(value?: string): AnalyticsRangePreset {
  return value === "7d" || value === "30d" || value === "90d" ? value : "30d";
}

function formatDateInZone(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: USER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getRangeWindow(range: AnalyticsRangePreset) {
  const days = RANGE_DAYS[range];
  const now = new Date();

  const currentStart = new Date(now);
  currentStart.setDate(now.getDate() - (days - 1));

  const previousStart = new Date(now);
  previousStart.setDate(now.getDate() - ((days * 2) - 1));

  return {
    days,
    currentStart,
    previousStart,
    currentStartDate: formatDateInZone(currentStart),
    previousStartDate: formatDateInZone(previousStart),
    currentStartIso: currentStart.toISOString(),
    previousStartIso: previousStart.toISOString(),
  };
}

function getTrailingDateKeys(days: number) {
  const now = new Date();
  const dates: string[] = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const current = new Date(now);
    current.setDate(now.getDate() - index);
    dates.push(formatDateInZone(current));
  }

  return dates;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function inferPracticeTrack(feedback: DebateScore | null): PracticeTrack {
  return feedback?.practiceTrack === "speaking" ? "speaking" : "debate";
}

function titleCaseSkill(skill: SkillMetricKey | null) {
  if (!skill) return null;
  return `${skill.charAt(0).toUpperCase()}${skill.slice(1)}`;
}

function buildStatusLine(
  totalSessions: number,
  strongestSkill: SkillMetricKey | null,
  weakestSkill: SkillMetricKey | null
) {
  if (totalSessions === 0) {
    return "Start your first practice session and your analytics will come to life.";
  }

  if (strongestSkill && weakestSkill && strongestSkill !== weakestSkill) {
    return `You're strongest in ${titleCaseSkill(
      strongestSkill
    )} right now. ${titleCaseSkill(weakestSkill)} is the clearest next focus.`;
  }

  if (strongestSkill) {
    return `You're building confidence through ${titleCaseSkill(
      strongestSkill
    )}. Keep that momentum going.`;
  }

  return "You're building strong arguments and better habits every week.";
}

function buildSkillNote(
  strongestSkill: SkillMetricKey | null,
  sourceSessions: number
) {
  if (sourceSessions === 0 || !strongestSkill) {
    return "Complete a few scored rounds to unlock your long-term skill profile.";
  }

  return `${titleCaseSkill(
    strongestSkill
  )} is your strongest lifetime skill right now.`;
}

function buildPracticeSeries(range: AnalyticsRangePreset, dailyStats: DailyStatRow[]) {
  const totalDays = RANGE_DAYS[range];
  const keys = getTrailingDateKeys(totalDays);
  const byDate = new Map(
    dailyStats.map((entry) => [entry.date, entry.minutes_studied ?? 0])
  );

  if (range === "7d") {
    const labels = ["M", "T", "W", "T", "F", "S", "S"];
    return keys.map((key, index) => ({
      label: labels[index] ?? "",
      value: byDate.get(key) ?? 0,
    }));
  }

  const bucketCount = 6;
  const bucketSize = Math.ceil(keys.length / bucketCount);
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const slice = keys.slice(index * bucketSize, (index + 1) * bucketSize);
    return {
      label: `P${index + 1}`,
      value: sum(slice.map((key) => byDate.get(key) ?? 0)),
    };
  });

  return buckets;
}

function buildScoreSeries(sessions: SoloSessionRow[]) {
  return [...sessions]
    .filter((session) => session.total_score != null)
    .slice(0, 6)
    .reverse()
    .map((session, index) => ({
      label: `${index + 1}`,
      value: session.total_score ?? 0,
    }));
}

function getRangeDeltaPercent(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function getRangeDeltaPoints(current: number | null, previous: number | null) {
  if (current == null || previous == null) return null;
  return roundToTenth(current - previous);
}

function roundMinutesFromSeconds(totalSeconds: number | null) {
  if (!totalSeconds || totalSeconds <= 0) return null;
  return Math.max(1, Math.round(totalSeconds / 60));
}

function mapLifetimeSkillSnapshot(rows: { feedback: DebateScore | null }[]) {
  const snapshot = computeSkillSnapshot(rows);
  return {
    metrics: snapshot.metrics.map((metric) => ({
      key: metric.key,
      value: metric.value,
      scoreOutOf100: Math.round(metric.value * 20),
    })),
    overallScore: snapshot.overallScore,
    overallScoreOutOf100:
      snapshot.overallScore != null ? Math.round(snapshot.overallScore * 20) : null,
    strongestSkill: snapshot.strongestSkill,
    weakestSkill: snapshot.weakestSkill,
    sourceSessions: snapshot.sourceSessions,
    note: buildSkillNote(snapshot.strongestSkill, snapshot.sourceSessions),
  };
}

function mapSoloRecentSession(session: SoloSessionRow): AnalyticsRecentSession {
  return {
    id: session.id,
    kind: "practice",
    topicTitle: session.topic_title,
    topicCategory: session.topic_category,
    practiceTrack: inferPracticeTrack(session.feedback),
    mode: session.mode,
    side: session.side,
    score: session.total_score,
    resultLabel: session.overall_band,
    confidencePercent: null,
    durationMinutes: roundMinutesFromSeconds(session.duration_seconds),
    createdAt: session.created_at,
    href: `/history/${session.id}`,
  };
}

function mapDuelRecentSession(params: {
  duel: DuelRow;
  role: DebateDuelSide | null;
  judgment: DuelJudgmentRow | undefined;
  durationSeconds: number;
}): AnalyticsRecentSession {
  const { duel, role, judgment, durationSeconds } = params;
  const outcome =
    judgment?.winner_side && role
      ? judgment.winner_side === role
        ? "Won"
        : "Lost"
      : "Completed";

  return {
    id: duel.id,
    kind: "duel",
    topicTitle: duel.topic_title,
    topicCategory: duel.topic_category,
    practiceTrack: "debate",
    mode: "duel",
    side: role,
    score: null,
    resultLabel: outcome,
    confidencePercent:
      judgment?.confidence != null ? Math.round(judgment.confidence * 100) : null,
    durationMinutes: roundMinutesFromSeconds(durationSeconds),
    createdAt: duel.completed_at ?? duel.created_at,
    href: `/debates/${duel.share_code}/result`,
  };
}

function buildRecentSessions(params: {
  soloSessions: SoloSessionRow[];
  duelParticipants: DuelParticipantRow[];
  duels: DuelRow[];
  duelJudgments: DuelJudgmentRow[];
  duelSpeeches: DuelSpeechRow[];
}) {
  const duelById = new Map(params.duels.map((duel) => [duel.id, duel]));
  const judgmentByDuelId = new Map(
    params.duelJudgments.map((judgment) => [judgment.duel_id, judgment])
  );
  const durationByDuelId = params.duelSpeeches.reduce((map, speech) => {
    map.set(speech.duel_id, (map.get(speech.duel_id) ?? 0) + speech.duration_seconds);
    return map;
  }, new Map<string, number>());

  const recentPractice = params.soloSessions.map(mapSoloRecentSession);
  const recentDuels = params.duelParticipants
    .map((participant) => {
      const duel = duelById.get(participant.duel_id);
      if (!duel) return null;
      return mapDuelRecentSession({
        duel,
        role: participant.role,
        judgment: judgmentByDuelId.get(participant.duel_id),
        durationSeconds: durationByDuelId.get(participant.duel_id) ?? 0,
      });
    })
    .filter(Boolean) as AnalyticsRecentSession[];

  return [...recentPractice, ...recentDuels]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )
    .slice(0, MAX_RECENT_SESSIONS);
}

export async function getAnalyticsPageData(
  userId: string,
  rangeInput?: string
): Promise<AnalyticsPageData> {
  const range = normalizeRangePreset(rangeInput);
  const {
    currentStartDate,
    currentStartIso,
    previousStartDate,
    previousStartIso,
  } = getRangeWindow(range);
  const supabase = await createClient();

  const [profileRes, skillSessionsRes, dailyStatsRes, soloSessionsRes, duelParticipantsRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase
        .from("debate_sessions")
        .select("feedback")
        .eq("user_id", userId)
        .not("feedback", "is", null)
        .order("created_at", { ascending: false })
        .limit(MAX_LIFETIME_SKILL_SESSIONS),
      supabase
        .from("daily_stats")
        .select("date, minutes_studied, sessions_completed, average_score")
        .eq("user_id", userId)
        .gte("date", previousStartDate)
        .order("date", { ascending: true }),
      supabase
        .from("debate_sessions")
        .select(
          "id, topic_title, topic_category, side, mode, feedback, total_score, overall_band, duration_seconds, created_at"
        )
        .eq("user_id", userId)
        .gte("created_at", previousStartIso)
        .order("created_at", { ascending: false })
        .limit(90),
      supabase
        .from("debate_duel_participants")
        .select("duel_id, role")
        .eq("user_id", userId)
        .order("joined_at", { ascending: false })
        .limit(24),
    ]);

  const profile = (profileRes.data as Profile | null) ?? null;
  const dailyStats = (dailyStatsRes.data ?? []) as DailyStatRow[];
  const soloSessions = ((soloSessionsRes.data ?? []) as SoloSessionRow[]).map(
    (session) => ({
      ...session,
      feedback: (session.feedback as DebateScore | null) ?? null,
    })
  );
  const duelParticipants = (duelParticipantsRes.data ?? []) as DuelParticipantRow[];

  const lifetimeSkillSnapshot = mapLifetimeSkillSnapshot(
    ((skillSessionsRes.data ?? []) as { feedback: DebateScore | null }[]).map((row) => ({
      feedback: (row.feedback as DebateScore | null) ?? null,
    }))
  );

  const currentDailyStats = dailyStats.filter(
    (entry) => entry.date >= currentStartDate
  );
  const previousDailyStats = dailyStats.filter(
    (entry) => entry.date >= previousStartDate && entry.date < currentStartDate
  );

  const currentPracticeMinutes = sum(
    currentDailyStats.map((entry) => entry.minutes_studied ?? 0)
  );
  const previousPracticeMinutes = sum(
    previousDailyStats.map((entry) => entry.minutes_studied ?? 0)
  );

  const currentSoloSessions = soloSessions.filter(
    (session) => new Date(session.created_at).getTime() >= new Date(currentStartIso).getTime()
  );
  const previousSoloSessions = soloSessions.filter((session) => {
    const timestamp = new Date(session.created_at).getTime();
    return (
      timestamp >= new Date(previousStartIso).getTime() &&
      timestamp < new Date(currentStartIso).getTime()
    );
  });

  const currentScoredSoloSessions = currentSoloSessions.filter(
    (session) => session.total_score != null
  );
  const previousScoredSoloSessions = previousSoloSessions.filter(
    (session) => session.total_score != null
  );

  const duelIds = duelParticipants.map((participant) => participant.duel_id);
  const duelRows: DuelRow[] = [];
  const duelJudgments: DuelJudgmentRow[] = [];
  const duelSpeeches: DuelSpeechRow[] = [];

  if (duelIds.length > 0) {
    const [duelsRes, judgmentsRes, speechesRes] = await Promise.all([
      supabase
        .from("debate_duels")
        .select("id, share_code, topic_title, topic_category, completed_at, created_at")
        .in("id", duelIds)
        .eq("status", "completed")
        .gte("completed_at", currentStartIso)
        .order("completed_at", { ascending: false }),
      supabase
        .from("debate_duel_judgments")
        .select("duel_id, winner_side, confidence, verdict")
        .in("duel_id", duelIds),
      supabase
        .from("debate_duel_speeches")
        .select("duel_id, duration_seconds")
        .in("duel_id", duelIds),
    ]);

    duelRows.push(...((duelsRes.data ?? []) as DuelRow[]));
    duelJudgments.push(...((judgmentsRes.data ?? []) as DuelJudgmentRow[]));
    duelSpeeches.push(...((speechesRes.data ?? []) as DuelSpeechRow[]));
  }

  const currentDebateSoloCount = currentSoloSessions.filter(
    (session) => inferPracticeTrack(session.feedback) === "debate"
  ).length;
  const currentSpeakingSoloCount = currentSoloSessions.filter(
    (session) => inferPracticeTrack(session.feedback) === "speaking"
  ).length;
  const currentDuelCount = duelRows.length;
  const debateMixCount = currentDebateSoloCount + currentDuelCount;
  const totalMixCount = debateMixCount + currentSpeakingSoloCount;

  const currentAverageScore =
    currentScoredSoloSessions.length > 0
      ? roundToTenth(
          currentScoredSoloSessions.reduce(
            (total, session) => total + (session.total_score ?? 0),
            0
          ) / currentScoredSoloSessions.length
        )
      : null;
  const previousAverageScore =
    previousScoredSoloSessions.length > 0
      ? roundToTenth(
          previousScoredSoloSessions.reduce(
            (total, session) => total + (session.total_score ?? 0),
            0
          ) / previousScoredSoloSessions.length
        )
      : null;

  const insights: AnalyticsInsightCard[] = [
    {
      key: "practice-minutes",
      totalMinutes: currentPracticeMinutes,
      deltaPercent: getRangeDeltaPercent(
        currentPracticeMinutes,
        previousPracticeMinutes
      ),
      series: buildPracticeSeries(range, currentDailyStats),
    },
    {
      key: "speaking-vs-debate",
      speakingCount: currentSpeakingSoloCount,
      debateCount: debateMixCount,
      speakingPercent:
        totalMixCount > 0
          ? Math.round((currentSpeakingSoloCount / totalMixCount) * 100)
          : 0,
      debatePercent:
        totalMixCount > 0 ? Math.round((debateMixCount / totalMixCount) * 100) : 0,
    },
    {
      key: "recent-average-score",
      averageScore: currentAverageScore,
      deltaPoints: getRangeDeltaPoints(currentAverageScore, previousAverageScore),
      sessionsAnalyzed: currentScoredSoloSessions.length,
      series: buildScoreSeries(currentScoredSoloSessions),
    },
    {
      key: "strongest-focus",
      strongestSkill: lifetimeSkillSnapshot.strongestSkill,
      strongestScore:
        lifetimeSkillSnapshot.strongestSkill != null
          ? lifetimeSkillSnapshot.metrics.find(
              (metric) => metric.key === lifetimeSkillSnapshot.strongestSkill
            )?.scoreOutOf100 ?? null
          : null,
      focusSkill: lifetimeSkillSnapshot.weakestSkill,
      focusScore:
        lifetimeSkillSnapshot.weakestSkill != null
          ? lifetimeSkillSnapshot.metrics.find(
              (metric) => metric.key === lifetimeSkillSnapshot.weakestSkill
            )?.scoreOutOf100 ?? null
          : null,
    },
  ];

  const xp = profile?.xp ?? 0;
  const xpInLevel = xp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL;

  return {
    range,
    hero: {
      displayName: profile?.display_name ?? "Debater",
      avatarUrl: profile?.avatar_url ?? null,
      title: profile?.selected_title ?? null,
      level: profile?.level ?? 1,
      xp,
      xpInLevel,
      xpToNextLevel,
      xpProgressPercent: Math.min(100, Math.round((xpInLevel / xpToNextLevel) * 100)),
      statusLine: buildStatusLine(
        profile?.total_sessions_completed ?? 0,
        lifetimeSkillSnapshot.strongestSkill,
        lifetimeSkillSnapshot.weakestSkill
      ),
      streak: profile?.streak_current ?? 0,
      totalSessions: profile?.total_sessions_completed ?? 0,
      totalPracticeMinutes: profile?.total_practice_minutes ?? 0,
    },
    skillSnapshot: lifetimeSkillSnapshot,
    insights,
    recentSessions: buildRecentSessions({
      soloSessions: currentSoloSessions,
      duelParticipants,
      duels: duelRows,
      duelJudgments,
      duelSpeeches,
    }),
  };
}

export { normalizeRangePreset };
