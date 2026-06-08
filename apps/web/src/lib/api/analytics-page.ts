import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PRACTICE_LANGUAGE,
  coercePracticeLanguage,
} from "@/lib/practice-language";
import {
  computeSkillSnapshot,
  roundToTenth,
  type SkillFeedbackSource,
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
  PracticeLanguage,
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

type DailyStatRow = {
  date: string;
  minutes_studied: number;
  sessions_completed: number;
  average_score: number | null;
};

type SoloSessionRow = {
  id: string;
  topic_title: string;
  category: string;
  topic_difficulty: string | null;
  side: DebateDuelSide;
  mode: "quick" | "full";
  ai_difficulty: string | null;
  feedback: DebateScore | null;
  total_score: number | null;
  overall_band: string | null;
  practice_language?: PracticeLanguage | null;
  duration_seconds: number;
  created_at: string;
};

type DuelParticipantRow = {
  duel_id: string;
  role: DebateDuelSide | null;
  joined_at?: string;
};

type DuelRow = {
  id: string;
  share_code: string;
  topic_title: string;
  topic_category: string;
  practice_language?: PracticeLanguage | null;
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

type AnalyticsProfileRow = Pick<
  Profile,
  | "display_name"
  | "avatar_url"
  | "selected_title"
  | "level"
  | "xp"
  | "streak_current"
  | "total_sessions_completed"
  | "total_practice_minutes"
>;

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

const ANALYTICS_SKILL_LABELS: Record<
  PracticeLanguage,
  Record<SkillMetricKey, string>
> = {
  en: {
    clarity: "Clarity",
    logic: "Logic",
    rebuttal: "Rebuttal",
    evidence: "Evidence",
    delivery: "Delivery",
  },
  vi: {
    clarity: "Độ rõ",
    logic: "Logic",
    rebuttal: "Phản biện",
    evidence: "Bằng chứng",
    delivery: "Trình bày",
  },
};

function titleCaseSkill(
  skill: SkillMetricKey | null,
  practiceLanguage: PracticeLanguage
) {
  if (!skill) return null;
  return ANALYTICS_SKILL_LABELS[practiceLanguage][skill];
}

function buildStatusLine(
  scoredSessions: number,
  strongestSkill: SkillMetricKey | null,
  weakestSkill: SkillMetricKey | null,
  practiceLanguage: PracticeLanguage
) {
  if (scoredSessions === 0) {
    return practiceLanguage === "vi"
      ? "Hoàn thành một phiên tiếng Việt có chấm điểm để mở khóa phân tích kỹ năng."
      : "Finish a scored English session and your performance analytics will come to life.";
  }

  if (strongestSkill && weakestSkill && strongestSkill !== weakestSkill) {
    return practiceLanguage === "vi"
      ? `Hiện tại bạn mạnh nhất ở ${titleCaseSkill(
          strongestSkill,
          practiceLanguage
        )}. ${titleCaseSkill(
          weakestSkill,
          practiceLanguage
        )} là trọng tâm rõ nhất tiếp theo.`
      : `You're strongest in ${titleCaseSkill(
          strongestSkill,
          practiceLanguage
        )} right now. ${titleCaseSkill(
          weakestSkill,
          practiceLanguage
        )} is the clearest next focus.`;
  }

  if (strongestSkill) {
    return practiceLanguage === "vi"
      ? `Bạn đang xây sự tự tin qua ${titleCaseSkill(
          strongestSkill,
          practiceLanguage
        )}. Cứ giữ nhịp này.`
      : `You're building confidence through ${titleCaseSkill(
          strongestSkill,
          practiceLanguage
        )}. Keep that momentum going.`;
  }

  return practiceLanguage === "vi"
    ? "Bạn đang xây lập luận chắc hơn và thói quen luyện tập đều hơn mỗi tuần."
    : "You're building strong arguments and better habits every week.";
}

function buildSkillNote(
  strongestSkill: SkillMetricKey | null,
  sourceSessions: number,
  confidence: number,
  trackBreakdown: Record<PracticeTrack, number>,
  practiceLanguage: PracticeLanguage
) {
  if (sourceSessions === 0 || !strongestSkill) {
    return practiceLanguage === "vi"
      ? "Hoàn thành vài phiên có chấm điểm trong khoảng này để mở khóa hồ sơ kỹ năng."
      : "Complete a few scored rounds in this range to unlock your skill profile.";
  }

  if (confidence < 45) {
    return practiceLanguage === "vi"
      ? "Ảnh chụp này vẫn đang gom dữ liệu. Hãy thêm vài phiên có điểm trước khi xem gợi ý là chắc chắn."
      : "This snapshot is still warming up. Add a few more scored rounds before treating recommendations as firm.";
  }

  const trackLabel =
    trackBreakdown.speaking > 0 && trackBreakdown.debate > 0
      ? practiceLanguage === "vi"
        ? "luyện tập kết hợp"
        : "mixed practice"
      : trackBreakdown.speaking > 0
        ? practiceLanguage === "vi"
          ? "luyện nói"
          : "speaking practice"
        : practiceLanguage === "vi"
          ? "luyện debate"
          : "debate practice";

  return practiceLanguage === "vi"
    ? `${titleCaseSkill(
        strongestSkill,
        practiceLanguage
      )} là kỹ năng mạnh nhất của bạn trong khoảng này, dựa trên ${trackLabel}.`
    : `${titleCaseSkill(
        strongestSkill,
        practiceLanguage
      )} is your strongest skill in this range based on your ${trackLabel}.`;
}

function buildPracticeSeries(
  range: AnalyticsRangePreset,
  dailyStats: DailyStatRow[],
  practiceLanguage: PracticeLanguage
) {
  const totalDays = RANGE_DAYS[range];
  const keys = getTrailingDateKeys(totalDays);
  const byDate = new Map(
    dailyStats.map((entry) => [entry.date, entry.minutes_studied ?? 0])
  );
  const labels =
    practiceLanguage === "vi"
      ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
      : ["M", "T", "W", "T", "F", "S", "S"];

  if (range === "7d") {
    return keys.map((key, index) => ({
      label: labels[index] ?? "",
      value: byDate.get(key) ?? 0,
    }));
  }

  const sums = Array.from({ length: 7 }, () => 0);
  const counts = Array.from({ length: 7 }, () => 0);

  keys.forEach((key) => {
    const date = new Date(`${key}T00:00:00Z`);
    const weekday = date.getUTCDay();
    const mondayFirstIndex = weekday === 0 ? 6 : weekday - 1;
    sums[mondayFirstIndex] += byDate.get(key) ?? 0;
    counts[mondayFirstIndex] += 1;
  });

  return labels.map((label, index) => ({
    label,
    value: counts[index] > 0 ? Math.round(sums[index] / counts[index]) : 0,
  }));
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

function mapSkillSnapshot(
  rows: SkillFeedbackSource[],
  practiceLanguage: PracticeLanguage
) {
  const snapshot = computeSkillSnapshot(rows);
  return {
    metrics: snapshot.metrics.map((metric) => ({
      key: metric.key,
      rawValue: metric.rawValue,
      challengeAdjustedValue: metric.challengeAdjustedValue,
      value: metric.value,
      effectiveSessions: metric.effectiveSessions,
      coverage: metric.coverage,
    })),
    overallScore: snapshot.overallScore,
    strongestSkill: snapshot.strongestSkill,
    weakestSkill: snapshot.weakestSkill,
    sourceSessions: snapshot.sourceSessions,
    confidence: snapshot.confidence,
    trackBreakdown: snapshot.trackBreakdown,
    difficultyBreakdown: snapshot.difficultyBreakdown,
    note: buildSkillNote(
      snapshot.strongestSkill,
      snapshot.sourceSessions,
      snapshot.confidence,
      snapshot.trackBreakdown,
      practiceLanguage
    ),
  };
}

function mapSoloRecentSession(session: SoloSessionRow): AnalyticsRecentSession {
  return {
    id: session.id,
    kind: "practice",
    topicTitle: session.topic_title,
    topicCategory: session.category,
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
  rangeInput?: string,
  practiceLanguageInput?: PracticeLanguage | string | null
): Promise<AnalyticsPageData> {
  const range = normalizeRangePreset(rangeInput);
  const practiceLanguage = coercePracticeLanguage(
    practiceLanguageInput,
    DEFAULT_PRACTICE_LANGUAGE
  );
  const {
    currentStartDate,
    currentStartIso,
    previousStartDate,
    previousStartIso,
  } = getRangeWindow(range);
  const supabase = await createClient();
  const soloSessionSelect =
    "id, topic_title, category:topic_category, topic_difficulty, side, mode, ai_difficulty, feedback, total_score, overall_band, practice_language, duration_seconds, created_at";

  let rangeSoloSessionsQuery = supabase
    .from("debate_sessions")
    .select(soloSessionSelect)
    .eq("user_id", userId)
    .gte("created_at", previousStartIso);
  let recentSoloSessionsQuery = supabase
    .from("debate_sessions")
    .select(soloSessionSelect)
    .eq("user_id", userId);

  if (practiceLanguage === "vi") {
    rangeSoloSessionsQuery = rangeSoloSessionsQuery.eq("practice_language", "vi");
    recentSoloSessionsQuery = recentSoloSessionsQuery.eq("practice_language", "vi");
  } else {
    rangeSoloSessionsQuery = rangeSoloSessionsQuery.or(
      "practice_language.eq.en,practice_language.is.null"
    );
    recentSoloSessionsQuery = recentSoloSessionsQuery.or(
      "practice_language.eq.en,practice_language.is.null"
    );
  }

  const [
    profileRes,
    dailyStatsRes,
    rangeSoloSessionsRes,
    recentSoloSessionsRes,
    rangeDuelParticipantsRes,
    recentDuelParticipantsRes,
  ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name, avatar_url, selected_title, level, xp, streak_current, total_sessions_completed, total_practice_minutes"
        )
        .eq("id", userId)
        .single(),
      supabase
        .from("daily_stats")
        .select("date, minutes_studied, sessions_completed, average_score")
        .eq("user_id", userId)
        .gte("date", previousStartDate)
        .order("date", { ascending: true }),
      rangeSoloSessionsQuery
        .order("created_at", { ascending: false })
        .limit(240),
      recentSoloSessionsQuery
        .order("created_at", { ascending: false })
        .limit(MAX_RECENT_SESSIONS),
      supabase
        .from("debate_duel_participants")
        .select("duel_id, role, joined_at")
        .eq("user_id", userId)
        .gte("joined_at", previousStartIso)
        .order("joined_at", { ascending: false })
        .limit(80),
      supabase
        .from("debate_duel_participants")
        .select("duel_id, role, joined_at")
        .eq("user_id", userId)
        .order("joined_at", { ascending: false })
        .limit(12),
    ]);

  const profile = (profileRes.data as AnalyticsProfileRow | null) ?? null;
  const dailyStats = (dailyStatsRes.data ?? []) as DailyStatRow[];
  const mapSoloSession = (session: SoloSessionRow) => ({
      ...session,
      feedback: (session.feedback as DebateScore | null) ?? null,
    });
  const rangeSoloSessions = ((rangeSoloSessionsRes.data ?? []) as SoloSessionRow[]).map(
    mapSoloSession
  );
  const recentSoloSessions = ((recentSoloSessionsRes.data ?? []) as SoloSessionRow[]).map(
    mapSoloSession
  );
  const duelParticipants = [
    ...((rangeDuelParticipantsRes.data ?? []) as DuelParticipantRow[]),
    ...((recentDuelParticipantsRes.data ?? []) as DuelParticipantRow[]),
  ].filter((participant, index, list) => {
    return (
      participant.duel_id &&
      list.findIndex((item) => item.duel_id === participant.duel_id) === index
    );
  });
  const recentDuelParticipants = (recentDuelParticipantsRes.data ??
    []) as DuelParticipantRow[];

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

  const currentSoloSessions = rangeSoloSessions.filter(
    (session) => new Date(session.created_at).getTime() >= new Date(currentStartIso).getTime()
  );
  const previousSoloSessions = rangeSoloSessions.filter((session) => {
    const timestamp = new Date(session.created_at).getTime();
    return (
      timestamp >= new Date(previousStartIso).getTime() &&
      timestamp < new Date(currentStartIso).getTime()
    );
  });

  const rangeSkillSnapshot = mapSkillSnapshot(currentSoloSessions, practiceLanguage);

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
    let duelsQuery = supabase
      .from("debate_duels")
      .select("id, share_code, topic_title, topic_category, practice_language, completed_at, created_at")
      .in("id", duelIds)
      .eq("status", "completed");

    duelsQuery =
      practiceLanguage === "vi"
        ? duelsQuery.eq("practice_language", "vi")
        : duelsQuery.or("practice_language.eq.en,practice_language.is.null");

    const [duelsRes, judgmentsRes, speechesRes] = await Promise.all([
      duelsQuery
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
  const currentDuelCount = duelRows.filter((duel) => {
    const completedAt = duel.completed_at ?? duel.created_at;
    return new Date(completedAt).getTime() >= new Date(currentStartIso).getTime();
  }).length;
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
      series: buildPracticeSeries(range, currentDailyStats, practiceLanguage),
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
      strongestSkill: rangeSkillSnapshot.strongestSkill,
      strongestScore:
        rangeSkillSnapshot.strongestSkill != null
          ? rangeSkillSnapshot.metrics.find(
              (metric) => metric.key === rangeSkillSnapshot.strongestSkill
            )?.value ?? null
          : null,
      focusSkill: rangeSkillSnapshot.weakestSkill,
      focusScore:
        rangeSkillSnapshot.weakestSkill != null
          ? rangeSkillSnapshot.metrics.find(
              (metric) => metric.key === rangeSkillSnapshot.weakestSkill
            )?.value ?? null
          : null,
    },
  ];

  const xp = profile?.xp ?? 0;
  const xpInLevel = xp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL;

  return {
    range,
    practiceLanguage,
    hero: {
      displayName:
        profile?.display_name ??
        (practiceLanguage === "vi" ? "Người tranh biện" : "Debater"),
      avatarUrl: profile?.avatar_url ?? null,
      title: profile?.selected_title ?? null,
      level: profile?.level ?? 1,
      xp,
      xpInLevel,
      xpToNextLevel,
      xpProgressPercent: Math.min(100, Math.round((xpInLevel / xpToNextLevel) * 100)),
      statusLine: buildStatusLine(
        rangeSkillSnapshot.sourceSessions,
        rangeSkillSnapshot.strongestSkill,
        rangeSkillSnapshot.weakestSkill,
        practiceLanguage
      ),
      streak: profile?.streak_current ?? 0,
      totalSessions: profile?.total_sessions_completed ?? 0,
      totalPracticeMinutes: profile?.total_practice_minutes ?? 0,
    },
    skillSnapshot: rangeSkillSnapshot,
    insights,
    recentSessions: buildRecentSessions({
      soloSessions: recentSoloSessions,
      duelParticipants: recentDuelParticipants,
      duels: duelRows,
      duelJudgments,
      duelSpeeches,
    }),
  };
}

export { normalizeRangePreset };
