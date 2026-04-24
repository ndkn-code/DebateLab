import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  computeSkillSnapshot,
  roundToTenth,
  type SkillMetricKey,
} from "@/lib/analytics/skill-snapshot";
import type {
  CoachContextEnvelope,
  CoachIntentMode,
  CoachProfile,
  CoachRecentSession,
  CoachRecommendation,
  CoachWeaknessPattern,
  DebateDuelJudgment,
  DebateScore,
  PracticeTrack,
  Profile,
} from "@/types";

const USER_TIMEZONE = "America/New_York";
const DAYS_7 = 7;
const DAYS_30 = 30;
const MAX_SCORED_SESSIONS = 40;
const MAX_RECENT_SESSIONS = 6;

type SessionRow = {
  id: string;
  topic_title: string;
  category: string | null;
  side: string;
  mode: string;
  feedback: DebateScore | null;
  total_score: number | null;
  overall_band: string | null;
  transcript: string;
  duration_seconds: number | null;
  created_at: string;
};

type DailyStatRow = {
  date: string;
  sessions_completed: number;
  minutes_studied: number;
};

type DuelParticipantRow = {
  duel_id: string;
  role: "proposition" | "opposition" | null;
};

type DuelJudgmentRow = {
  duel_id: string;
  winner_side: "proposition" | "opposition" | null;
  summary: string;
  verdict: DebateDuelJudgment | null;
  created_at: string;
};

type DuelRow = {
  id: string;
  topic_title: string;
};

const SKILL_LABELS: Record<SkillMetricKey, string> = {
  clarity: "clarity",
  logic: "logic",
  rebuttal: "rebuttal",
  evidence: "evidence",
  delivery: "delivery",
};

const WEAKNESS_PATTERNS: Array<{
  key: string;
  label: string;
  relatedSkill: SkillMetricKey | null;
  keywords: string[];
}> = [
  {
    key: "mechanism",
    label: "Mechanism depth",
    relatedSkill: "logic",
    keywords: ["mechanism", "how this works", "causal", "causation"],
  },
  {
    key: "comparison",
    label: "Weighing and comparison",
    relatedSkill: "rebuttal",
    keywords: ["weigh", "comparison", "comparative", "compare"],
  },
  {
    key: "impact",
    label: "Impact framing",
    relatedSkill: "clarity",
    keywords: ["impact", "impactful", "link back", "motion link"],
  },
  {
    key: "evidence",
    label: "Evidence support",
    relatedSkill: "evidence",
    keywords: ["evidence", "example", "proof", "supporting detail"],
  },
  {
    key: "clash",
    label: "Clash and rebuttal depth",
    relatedSkill: "rebuttal",
    keywords: ["clash", "rebuttal", "counter", "response"],
  },
  {
    key: "delivery",
    label: "Delivery and clarity",
    relatedSkill: "delivery",
    keywords: ["fluency", "grammar", "vocabulary", "delivery", "confidence"],
  },
];

function formatDateInZone(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: USER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getTrailingDates(totalDays: number) {
  const dates: string[] = [];
  const now = new Date();

  for (let index = totalDays - 1; index >= 0; index -= 1) {
    const current = new Date(now);
    current.setDate(now.getDate() - index);
    dates.push(formatDateInZone(current));
  }

  return dates;
}

function getDailyGoalMinutes(profile: Profile | null) {
  const preferences = (profile?.preferences as Record<string, unknown> | null) ?? {};
  const explicitGoal = preferences.daily_goal_minutes;
  if (typeof explicitGoal === "number" && explicitGoal > 0) {
    return explicitGoal;
  }

  const onboardingGoal = preferences.dailyCommitment;
  if (typeof onboardingGoal === "number" && onboardingGoal > 0) {
    return onboardingGoal;
  }

  return 30;
}

function getPracticeTrack(feedback: DebateScore | null): PracticeTrack {
  return feedback?.practiceTrack === "speaking" ? "speaking" : "debate";
}

function describeTrack(track: PracticeTrack) {
  return track === "speaking" ? "speaking practice" : "debate practice";
}

function titleCaseSkill(skill: SkillMetricKey | null) {
  if (!skill) return null;
  const label = SKILL_LABELS[skill];
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function summarizeSession(session: SessionRow) {
  const feedback = session.feedback;
  if (feedback?.summary) return feedback.summary;
  if (session.total_score != null && session.overall_band) {
    return `Scored ${session.total_score}/100 (${session.overall_band}) on ${describeTrack(
      getPracticeTrack(feedback)
    )}.`;
  }
  return `Completed a ${describeTrack(getPracticeTrack(feedback))} session on "${session.topic_title}".`;
}

function buildTranscriptExcerpt(transcript: string) {
  const normalized = transcript.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > 260 ? `${normalized.slice(0, 257)}...` : normalized;
}

function mapRecentSession(
  session: SessionRow,
  includeTranscript = false
): CoachRecentSession {
  return {
    id: session.id,
    topicTitle: session.topic_title,
    topicCategory: session.category,
    practiceTrack: getPracticeTrack(session.feedback),
    mode: session.mode,
    side: session.side,
    totalScore: session.total_score,
    overallBand: session.overall_band,
    createdAt: session.created_at,
    strengths: session.feedback?.strengths ?? [],
    improvements: session.feedback?.improvements ?? [],
    summary: summarizeSession(session),
    transcriptExcerpt: includeTranscript
      ? buildTranscriptExcerpt(session.transcript)
      : undefined,
    href: `/history/${session.id}`,
  };
}

function buildStrengthPatterns(sessions: SessionRow[]) {
  const counts = new Map<string, { count: number; label: string }>();

  for (const session of sessions) {
    for (const strength of session.feedback?.strengths ?? []) {
      const normalized = strength.trim().toLowerCase();
      if (!normalized) continue;
      const current = counts.get(normalized);
      counts.set(normalized, {
        count: (current?.count ?? 0) + 1,
        label: current?.label ?? strength,
      });
    }
  }

  return [...counts.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 3)
    .map((entry) => entry.label);
}

function collectPatternText(session: SessionRow) {
  const feedback = session.feedback;
  if (!feedback) return [];

  return [
    ...(feedback.improvements ?? []),
    ...(feedback.missingLayers ?? []),
    feedback.weighingFeedback ?? "",
    feedback.clashFeedback ?? "",
    feedback.detailedFeedback?.contentFeedback ?? "",
    feedback.detailedFeedback?.structureFeedback ?? "",
    feedback.detailedFeedback?.languageFeedback ?? "",
    feedback.detailedFeedback?.persuasionFeedback ?? "",
  ]
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildWeaknessPatterns(sessions: SessionRow[]): CoachWeaknessPattern[] {
  const counts = new Map<string, number>();

  for (const session of sessions) {
    const joined = collectPatternText(session).join(" ").toLowerCase();
    if (!joined) continue;

    for (const pattern of WEAKNESS_PATTERNS) {
      if (pattern.keywords.some((keyword) => joined.includes(keyword))) {
        counts.set(pattern.key, (counts.get(pattern.key) ?? 0) + 1);
      }
    }
  }

  return WEAKNESS_PATTERNS.map((pattern) => ({
    key: pattern.key,
    label: pattern.label,
    count: counts.get(pattern.key) ?? 0,
    summary:
      counts.get(pattern.key) && counts.get(pattern.key)! > 1
        ? `${pattern.label} has shown up repeatedly in recent feedback.`
        : `${pattern.label} is worth tightening in your next debate.`,
    relatedSkill: pattern.relatedSkill,
  }))
    .filter((pattern) => pattern.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);
}

function buildTrendSummary(sessions: SessionRow[]) {
  const recent = sessions.slice(0, 5).filter((session) => session.total_score != null);
  const previous = sessions.slice(5, 10).filter((session) => session.total_score != null);

  const recentAverage =
    recent.length > 0
      ? roundToTenth(
          recent.reduce((sum, session) => sum + (session.total_score ?? 0), 0) /
            recent.length
        )
      : null;
  const previousAverage =
    previous.length > 0
      ? roundToTenth(
          previous.reduce((sum, session) => sum + (session.total_score ?? 0), 0) /
            previous.length
        )
      : null;
  const delta =
    recentAverage != null && previousAverage != null
      ? roundToTenth(recentAverage - previousAverage)
      : null;

  let direction: "up" | "down" | "flat" = "flat";
  if (delta != null && delta >= 2) direction = "up";
  if (delta != null && delta <= -2) direction = "down";

  let summary = "You need a few more scored debates before trend analysis becomes reliable.";
  if (recentAverage != null && previousAverage == null) {
    summary = `Your recent scored sessions are averaging ${Math.round(
      recentAverage
    )}/100. Keep building that baseline.`;
  } else if (recentAverage != null && delta != null) {
    if (direction === "up") {
      summary = `Your last ${recent.length} scored sessions are trending up by ${Math.abs(
        delta
      ).toFixed(1)} points.`;
    } else if (direction === "down") {
      summary = `Your last ${recent.length} scored sessions dipped by ${Math.abs(
        delta
      ).toFixed(1)} points, so this is a good moment to tighten fundamentals.`;
    } else {
      summary = `Your recent performance is stable around ${Math.round(
        recentAverage
      )}/100.`;
    }
  }

  return {
    direction,
    averageScore: recentAverage,
    deltaFromPrevious: delta,
    sessionsAnalyzed: recent.length,
    summary,
  } as CoachProfile["recentTrend"];
}

function buildStarterPrompts(params: {
  weakestSkill: SkillMetricKey | null;
  strongestSkill: SkillMetricKey | null;
  weaknessPatterns: CoachWeaknessPattern[];
  recentSessions: CoachRecentSession[];
}) {
  const prompts: string[] = [];

  if (params.weakestSkill && params.strongestSkill) {
    prompts.push(
      `Why is my ${SKILL_LABELS[params.weakestSkill]} weaker than my ${SKILL_LABELS[
        params.strongestSkill
      ]}?`
    );
  }

  if (params.recentSessions.length >= 2) {
    prompts.push("Compare my last 3 debate sessions.");
  }

  if (params.weaknessPatterns[0]) {
    prompts.push(`Help me fix my ${params.weaknessPatterns[0].label.toLowerCase()}.`);
  }

  prompts.push("What should I practice today?");

  if (params.recentSessions.length === 0) {
    return [
      "Help me build a clear debate opening.",
      "What should I focus on in my first practice session?",
      "Make me a short rebuttal drill.",
      "How do I weigh impacts clearly?",
    ];
  }

  return prompts.slice(0, 4);
}

function buildRecommendations(params: {
  skillSnapshot: CoachProfile["skillSnapshot"];
  weaknessPatterns: CoachWeaknessPattern[];
  recentSessions: CoachRecentSession[];
  underusedTrack: PracticeTrack;
}): CoachRecommendation[] {
  const recommendations: CoachRecommendation[] = [];

  if (params.skillSnapshot.weakestSkill) {
    const targetTrack =
      params.skillSnapshot.weakestSkill === "delivery" ? "speaking" : "debate";
    recommendations.push({
      id: "weakest-skill",
      title: `Improve ${titleCaseSkill(params.skillSnapshot.weakestSkill)}`,
      description: `A ${targetTrack} round is the fastest way to work on ${SKILL_LABELS[
        params.skillSnapshot.weakestSkill
      ]}.`,
      prompt: `Help me improve my ${SKILL_LABELS[params.skillSnapshot.weakestSkill]}.`,
      href: `/practice?track=${targetTrack}`,
      track: targetTrack,
      skillKey: params.skillSnapshot.weakestSkill,
    });
  }

  if (params.weaknessPatterns[0]) {
    recommendations.push({
      id: "recurring-pattern",
      title: `Fix ${params.weaknessPatterns[0].label}`,
      description: params.weaknessPatterns[0].summary,
      prompt: `Help me fix ${params.weaknessPatterns[0].label.toLowerCase()} in my next debate.`,
      skillKey: params.weaknessPatterns[0].relatedSkill,
    });
  }

  if (params.recentSessions[0]) {
    recommendations.push({
      id: "review-latest",
      title: "Review your latest debate",
      description: params.recentSessions[0].topicTitle,
      prompt: "Review my last debate and tell me the biggest thing to fix next.",
      href: params.recentSessions[0].href,
      track: params.recentSessions[0].practiceTrack,
    });
  }

  recommendations.push({
    id: "rebalance-track",
    title:
      params.underusedTrack === "speaking"
        ? "Bring speaking back into the mix"
        : "Bring debate back into the mix",
    description: `Your recent practice mix is lighter on ${describeTrack(
      params.underusedTrack
    )}.`,
    prompt:
      params.underusedTrack === "speaking"
        ? "Should I do a speaking practice today or a debate practice?"
        : "Should I do a debate practice today or a speaking practice?",
    href: `/practice?track=${params.underusedTrack}`,
    track: params.underusedTrack,
  });

  return recommendations.slice(0, 4);
}

function buildProfileSummary(profile: CoachProfile) {
  const strongest = titleCaseSkill(profile.skillSnapshot.strongestSkill);
  const weakest = titleCaseSkill(profile.skillSnapshot.weakestSkill);

  return [
    `User: ${profile.displayName}`,
    `Streak: ${profile.streak} day(s)`,
    `Level: ${profile.level}`,
    `Credits: ${profile.credits}`,
    `Daily goal: ${profile.dailyGoalMinutes} minutes`,
    `Practice cadence: ${profile.sessionsLast7} sessions in 7 days, ${profile.minutesLast7} minutes in 7 days, ${profile.sessionsLast30} sessions in 30 days`,
    `Practice mix: speaking ${profile.practiceMix.speaking}, debate ${profile.practiceMix.debate}, underused track ${profile.practiceMix.underusedTrack}`,
    `Skill snapshot: strongest ${strongest ?? "n/a"}, weakest ${weakest ?? "n/a"}, overall ${
      profile.skillSnapshot.overallScore != null
        ? `${Math.round(profile.skillSnapshot.overallScore)}/100`
        : "n/a"
    }, confidence ${profile.skillSnapshot.confidence}%`,
    `Trend: ${profile.recentTrend.summary}`,
    profile.weaknessPatterns.length > 0
      ? `Repeated weaknesses: ${profile.weaknessPatterns
          .map((pattern) => pattern.label)
          .join(", ")}`
      : "Repeated weaknesses: none identified yet",
    profile.strengthPatterns.length > 0
      ? `Recurring strengths: ${profile.strengthPatterns.join(", ")}`
      : "Recurring strengths: none identified yet",
  ].join("\n");
}

async function getCourseSummary(userId: string, courseId: string) {
  const supabase = await createClient();
  const [{ data: profile }, { data: course }, { data: enrollment }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase
      .from("courses")
      .select("id, title, description")
      .eq("id", courseId)
      .maybeSingle(),
    supabase
      .from("enrollments")
      .select("progress_pct")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle(),
  ]);

  const canAccessCourse = profile?.role === "admin" || Boolean(enrollment);
  if (!course || !canAccessCourse) return null;

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    progressPercent: enrollment?.progress_pct ?? null,
  };
}

async function getSessionById(userId: string, sessionId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("debate_sessions")
    .select(
      "id, topic_title, category, side, mode, feedback, total_score, overall_band, transcript, duration_seconds, created_at"
    )
    .eq("user_id", userId)
    .eq("id", sessionId)
    .maybeSingle();

  return (data as SessionRow | null) ?? null;
}

async function getDuelContext(userId: string, duelIdentifier: string) {
  const supabase = await createClient();
  let duelId = duelIdentifier;

  const { data: participant } = await supabase
    .from("debate_duel_participants")
    .select("duel_id")
    .eq("user_id", userId)
    .eq("duel_id", duelIdentifier)
    .maybeSingle();

  if (!participant) {
    const { data: duelByShareCode } = await supabase
      .from("debate_duels")
      .select("id")
      .eq("share_code", duelIdentifier.toUpperCase())
      .maybeSingle();

    if (!duelByShareCode) return null;
    duelId = duelByShareCode.id;

    const { data: participantByResolvedId } = await supabase
      .from("debate_duel_participants")
      .select("duel_id")
      .eq("user_id", userId)
      .eq("duel_id", duelId)
      .maybeSingle();

    if (!participantByResolvedId) return null;
  }

  const [{ data: duel }, { data: judgment }, { data: participantRows }] =
    await Promise.all([
      supabase
        .from("debate_duels")
        .select("id, topic_title")
        .eq("id", duelId)
        .maybeSingle(),
      supabase
        .from("debate_duel_judgments")
        .select("winner_side, summary, verdict")
        .eq("duel_id", duelId)
        .maybeSingle(),
      supabase
        .from("debate_duel_participants")
        .select("role, display_name_snapshot")
        .eq("duel_id", duelId),
    ]);

  if (!duel || !judgment) return null;

  const names = (participantRows ?? [])
    .map((row) => `${row.role ?? "unassigned"}: ${row.display_name_snapshot}`)
    .join(", ");

  return {
    id: duel.id,
    topicTitle: duel.topic_title,
    winnerSide: judgment.winner_side,
    decisionSummary:
      (judgment.verdict as DebateDuelJudgment | null)?.decisionSummary ??
      judgment.summary,
    participantSummary: names,
  };
}

function buildCoursePromptContext(
  course: NonNullable<CoachContextEnvelope["selectedCourse"]>
) {
  return [
    `Course context: "${course.title}"`,
    course.description ? `Course description: ${course.description}` : null,
    course.progressPercent != null
      ? `Current course progress: ${course.progressPercent}%`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSessionPromptContext(session: CoachRecentSession, includeExcerpt: boolean) {
  return [
    `Selected session: "${session.topicTitle}"`,
    `Track: ${session.practiceTrack}`,
    `Mode: ${session.mode}`,
    `Side: ${session.side}`,
    session.totalScore != null ? `Score: ${session.totalScore}/100` : null,
    session.overallBand ? `Band: ${session.overallBand}` : null,
    session.summary ? `Summary: ${session.summary}` : null,
    session.strengths.length > 0
      ? `Strengths: ${session.strengths.join("; ")}`
      : null,
    session.improvements.length > 0
      ? `Improvements: ${session.improvements.join("; ")}`
      : null,
    includeExcerpt && session.transcriptExcerpt
      ? `Transcript excerpt: ${session.transcriptExcerpt}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildDuelPromptContext(duel: NonNullable<CoachContextEnvelope["selectedDuel"]>) {
  return [
    `Selected duel: "${duel.topicTitle}"`,
    duel.winnerSide ? `Winner side: ${duel.winnerSide}` : null,
    `Decision summary: ${duel.decisionSummary}`,
    duel.participantSummary ? `Participants: ${duel.participantSummary}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function inferIntent(params: {
  contextType?: string | null;
  message?: string | null;
}) {
  const normalizedMessage = params.message?.toLowerCase() ?? "";
  const contextType = params.contextType ?? "";

  if (contextType === "duel-review") return "duel-review" as CoachIntentMode;
  if (contextType === "course") return "course-help" as CoachIntentMode;
  if (contextType === "practice-feedback") return "session-review" as CoachIntentMode;

  if (
    normalizedMessage.includes("compare") &&
    (normalizedMessage.includes("recent") || normalizedMessage.includes("last"))
  ) {
    return "session-comparison" as CoachIntentMode;
  }

  if (
    normalizedMessage.includes("review my last") ||
    normalizedMessage.includes("review my latest") ||
    normalizedMessage.includes("last debate") ||
    normalizedMessage.includes("latest debate")
  ) {
    return "session-review" as CoachIntentMode;
  }

  if (
    normalizedMessage.includes("progress") ||
    normalizedMessage.includes("trend") ||
    normalizedMessage.includes("improving") ||
    normalizedMessage.includes("why is my")
  ) {
    return "progress-review" as CoachIntentMode;
  }

  return "general-coaching" as CoachIntentMode;
}

export async function getCoachProfile(userId: string): Promise<CoachProfile> {
  const supabase = await createClient();
  const trailing30Dates = getTrailingDates(DAYS_30);
  const today = trailing30Dates[trailing30Dates.length - 1];

  const [profileRes, statsRes, scoredSessionsRes, recentSessionsRes, duelParticipantRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, email, display_name, avatar_url, role, streak_current, streak_longest, streak_last_active_date, total_practice_minutes, total_sessions_completed, xp, level, onboarding_completed, preferences, selected_title, unlocked_titles, banner_color, referral_code, orb_balance, referred_by, created_at, updated_at"
        )
        .eq("id", userId)
        .single(),
      supabase
        .from("daily_stats")
        .select("date, sessions_completed, minutes_studied")
        .eq("user_id", userId)
        .gte("date", trailing30Dates[0])
        .lte("date", today)
        .order("date"),
      supabase
        .from("debate_sessions")
        .select(
          "id, topic_title, category, side, mode, feedback, total_score, overall_band, transcript, duration_seconds, created_at"
        )
        .eq("user_id", userId)
        .not("total_score", "is", null)
        .order("created_at", { ascending: false })
        .limit(MAX_SCORED_SESSIONS),
      supabase
        .from("debate_sessions")
        .select(
          "id, topic_title, category, side, mode, feedback, total_score, overall_band, transcript, duration_seconds, created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MAX_RECENT_SESSIONS),
      supabase
        .from("debate_duel_participants")
        .select("duel_id, role")
        .eq("user_id", userId)
        .order("joined_at", { ascending: false })
        .limit(12),
    ]);

  const profile = (profileRes.data as Profile | null) ?? null;
  const stats = (statsRes.data ?? []) as DailyStatRow[];
  const scoredSessions = (scoredSessionsRes.data ?? []) as SessionRow[];
  const recentSessions = (recentSessionsRes.data ?? []) as SessionRow[];
  const duelParticipants = (duelParticipantRes.data ?? []) as DuelParticipantRow[];

  const statsByDate = new Map(stats.map((stat) => [stat.date, stat]));
  const minutesLast30 = trailing30Dates.reduce(
    (sum, date) => sum + (statsByDate.get(date)?.minutes_studied ?? 0),
    0
  );
  const minutesLast7 = trailing30Dates
    .slice(-DAYS_7)
    .reduce((sum, date) => sum + (statsByDate.get(date)?.minutes_studied ?? 0), 0);
  const sessionsLast30 = trailing30Dates.reduce(
    (sum, date) => sum + (statsByDate.get(date)?.sessions_completed ?? 0),
    0
  );
  const sessionsLast7 = trailing30Dates
    .slice(-DAYS_7)
    .reduce((sum, date) => sum + (statsByDate.get(date)?.sessions_completed ?? 0), 0);

  const skillSnapshot = computeSkillSnapshot(scoredSessions);
  const recentTrend = buildTrendSummary(scoredSessions);
  const weaknessPatterns = buildWeaknessPatterns(scoredSessions.slice(0, 8));
  const strengthPatterns = buildStrengthPatterns(scoredSessions.slice(0, 8));
  const mappedRecentSessions = recentSessions.map((session) =>
    mapRecentSession(session)
  );
  const recentScoredSessions = mappedRecentSessions.filter(
    (session) => session.totalScore != null
  );
  const bestRecentSession =
    [...recentScoredSessions].sort(
      (left, right) => (right.totalScore ?? 0) - (left.totalScore ?? 0)
    )[0] ?? null;
  const weakestRecentSession =
    [...recentScoredSessions].sort(
      (left, right) => (left.totalScore ?? 0) - (right.totalScore ?? 0)
    )[0] ?? null;

  const practiceMix = recentSessions.reduce(
    (summary, session) => {
      const track = getPracticeTrack(session.feedback);
      summary[track] += 1;
      return summary;
    },
    { speaking: 0, debate: 0 }
  );
  const underusedTrack =
    practiceMix.speaking <= practiceMix.debate ? "speaking" : "debate";

  let duelSummary = {
    totalDuels: 0,
    wins: 0,
    losses: 0,
    recentSummary: null as string | null,
  };

  if (duelParticipants.length > 0) {
    const duelIds = duelParticipants.map((participant) => participant.duel_id);
    const [judgmentRes, duelRes] = await Promise.all([
      supabase
        .from("debate_duel_judgments")
        .select("duel_id, winner_side, summary, verdict, created_at")
        .in("duel_id", duelIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("debate_duels")
        .select("id, topic_title")
        .in("id", duelIds),
    ]);

    const judgments = (judgmentRes.data ?? []) as DuelJudgmentRow[];
    const roleByDuel = new Map(
      duelParticipants.map((participant) => [participant.duel_id, participant.role])
    );
    const duelById = new Map(
      ((duelRes.data ?? []) as DuelRow[]).map((duel) => [duel.id, duel])
    );

    const wins = judgments.filter((judgment) => {
      const role = roleByDuel.get(judgment.duel_id);
      return role && judgment.winner_side && role === judgment.winner_side;
    }).length;
    const losses = judgments.filter((judgment) => {
      const role = roleByDuel.get(judgment.duel_id);
      return role && judgment.winner_side && role !== judgment.winner_side;
    }).length;

    duelSummary = {
      totalDuels: judgments.length,
      wins,
      losses,
      recentSummary: judgments[0]
        ? `${duelById.get(judgments[0].duel_id)?.topic_title ?? "Recent duel"}: ${
            judgments[0].summary
          }`
        : null,
    };
  }

  const recommendations = buildRecommendations({
    skillSnapshot: {
      metrics: skillSnapshot.metrics,
      overallScore: skillSnapshot.overallScore,
      strongestSkill: skillSnapshot.strongestSkill,
      weakestSkill: skillSnapshot.weakestSkill,
      sourceSessions: skillSnapshot.sourceSessions,
      confidence: skillSnapshot.confidence,
      trackBreakdown: skillSnapshot.trackBreakdown,
    },
    weaknessPatterns,
    recentSessions: mappedRecentSessions,
    underusedTrack,
  });

  const starterPrompts = buildStarterPrompts({
    weakestSkill: skillSnapshot.weakestSkill,
    strongestSkill: skillSnapshot.strongestSkill,
    weaknessPatterns,
    recentSessions: mappedRecentSessions,
  });

  return {
    displayName: profile?.display_name || "Debater",
    streak: profile?.streak_current ?? 0,
    level: profile?.level ?? 1,
    credits: profile?.orb_balance ?? 0,
    dailyGoalMinutes: getDailyGoalMinutes(profile),
    sessionsLast7,
    sessionsLast30,
    minutesLast7,
    minutesLast30,
    practiceMix: {
      speaking: practiceMix.speaking,
      debate: practiceMix.debate,
      underusedTrack,
    },
    skillSnapshot: {
      metrics: skillSnapshot.metrics,
      overallScore: skillSnapshot.overallScore,
      strongestSkill: skillSnapshot.strongestSkill,
      weakestSkill: skillSnapshot.weakestSkill,
      sourceSessions: skillSnapshot.sourceSessions,
      confidence: skillSnapshot.confidence,
      trackBreakdown: skillSnapshot.trackBreakdown,
    },
    recentTrend,
    weaknessPatterns,
    strengthPatterns,
    recentSessions: mappedRecentSessions,
    bestRecentSession,
    weakestRecentSession,
    duelSummary,
    recommendations,
    starterPrompts,
    brief: {
      strongestSkillLabel: titleCaseSkill(skillSnapshot.strongestSkill),
      weakestSkillLabel: titleCaseSkill(skillSnapshot.weakestSkill),
      trendSummary: recentTrend.summary,
      nextMove:
        recommendations[0]?.description ??
        "Start a scored debate round so the coach can personalize your next move.",
    },
  };
}

export async function getCoachContextEnvelope(params: {
  userId: string;
  profile: CoachProfile;
  contextType?: string | null;
  contextId?: string | null;
  message?: string | null;
}): Promise<CoachContextEnvelope> {
  const mode = inferIntent({
    contextType: params.contextType,
    message: params.message,
  });

  let selectedSession: CoachRecentSession | null = null;
  let selectedDuel: CoachContextEnvelope["selectedDuel"] = null;
  let selectedCourse: CoachContextEnvelope["selectedCourse"] = null;

  if (params.contextType === "practice-feedback" && params.contextId) {
    const session = await getSessionById(params.userId, params.contextId);
    if (session) {
      selectedSession = mapRecentSession(session, true);
    }
  }

  if (!selectedSession && mode === "session-review") {
    const latestSessionId =
      params.profile.recentSessions.find(
        (session) => session.practiceTrack === "debate" && session.totalScore != null
      )?.id ??
      params.profile.recentSessions.find((session) => session.totalScore != null)?.id ??
      params.profile.recentSessions[0]?.id;
    if (latestSessionId) {
      const session = await getSessionById(params.userId, latestSessionId);
      if (session) {
        selectedSession = mapRecentSession(session, true);
      }
    }
  }

  if (params.contextType === "duel-review" && params.contextId) {
    selectedDuel = await getDuelContext(params.userId, params.contextId);
  }

  if (params.contextType === "course" && params.contextId) {
    selectedCourse = await getCourseSummary(params.userId, params.contextId);
  }

  const strongest = titleCaseSkill(params.profile.skillSnapshot.strongestSkill);
  const weakest = titleCaseSkill(params.profile.skillSnapshot.weakestSkill);
  const starterPrompts =
    selectedSession != null
      ? [
          `Review my session on "${selectedSession.topicTitle}".`,
          "What was the biggest weakness in that round?",
          "How would you rebuild my weakest argument?",
          "Give me a targeted drill for this session.",
        ]
      : selectedDuel != null
        ? [
            `Why did ${selectedDuel.winnerSide ?? "that side"} win this duel?`,
            "What should I change in the rematch?",
            "Compare both sides' rebuttal quality.",
            "Give me a duel-specific improvement plan.",
          ]
        : params.profile.starterPrompts;

  const focusTitle =
    selectedSession != null
      ? "Pinned session review"
      : selectedDuel != null
        ? "Pinned duel review"
        : selectedCourse != null
          ? "Course-aware coaching"
          : "Current coaching focus";

  const focusSummary =
    selectedSession != null
      ? `${selectedSession.topicTitle} is ready to review with its score, strengths, and improvement notes attached.`
      : selectedDuel != null
        ? `${selectedDuel.topicTitle} is pinned with the AI verdict and comparative notes.`
        : selectedCourse != null
          ? `${selectedCourse.title} is attached, so the coach can connect course work to your debate profile.`
          : weakest && strongest
            ? `Your strongest area is ${strongest}, while ${weakest} is the clearest gap to close next.`
            : params.profile.recentTrend.summary;

  const promptContext = [
    buildProfileSummary(params.profile),
    selectedSession
      ? buildSessionPromptContext(selectedSession, mode === "session-review")
      : null,
    selectedDuel ? buildDuelPromptContext(selectedDuel) : null,
    selectedCourse ? buildCoursePromptContext(selectedCourse) : null,
    mode === "session-comparison" &&
    params.profile.recentSessions.filter((session) => session.totalScore != null).length > 1
      ? `Recent sessions to compare: ${params.profile.recentSessions
          .filter((session) => session.totalScore != null)
          .slice(0, 3)
          .map(
            (session) =>
              `${session.topicTitle} (${session.totalScore != null ? `${session.totalScore}/100` : "unscored"})`
          )
          .join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    mode,
    focusTitle,
    focusSummary,
    promptContext,
    starterPrompts,
    selectedSession,
    selectedDuel,
    selectedCourse,
  };
}
