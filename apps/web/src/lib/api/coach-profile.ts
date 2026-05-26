import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PRACTICE_LANGUAGE,
  coercePracticeLanguage,
} from "@/lib/practice-language";
import { buildCoachStarterPrompts } from "@/lib/coach-starter-prompts";
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
  PracticeLanguage,
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
  topic_difficulty: string | null;
  side: string;
  mode: string;
  ai_difficulty: string | null;
  feedback: DebateScore | null;
  total_score: number | null;
  overall_band: string | null;
  practice_language?: PracticeLanguage | null;
  transcript?: string | null;
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
  practice_language?: PracticeLanguage | null;
};

const SKILL_LABELS: Record<PracticeLanguage, Record<SkillMetricKey, string>> = {
  en: {
    clarity: "clarity",
    logic: "logic",
    rebuttal: "rebuttal",
    evidence: "evidence",
    delivery: "delivery",
  },
  vi: {
    clarity: "độ rõ",
    logic: "logic",
    rebuttal: "phản biện",
    evidence: "bằng chứng",
    delivery: "trình bày",
  },
};

const SKILL_TITLE_LABELS: Record<
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

const WEAKNESS_PATTERNS: Array<{
  key: string;
  label: Record<PracticeLanguage, string>;
  repeatedSummary: Record<PracticeLanguage, string>;
  nextSummary: Record<PracticeLanguage, string>;
  relatedSkill: SkillMetricKey | null;
  keywords: string[];
}> = [
  {
    key: "mechanism",
    label: {
      en: "Mechanism depth",
      vi: "Độ sâu cơ chế",
    },
    repeatedSummary: {
      en: "Mechanism depth has shown up repeatedly in recent feedback.",
      vi: "Độ sâu cơ chế xuất hiện lặp lại trong feedback gần đây.",
    },
    nextSummary: {
      en: "Mechanism depth is worth tightening in your next debate.",
      vi: "Bạn nên làm rõ cơ chế hơn trong phiên debate tiếp theo.",
    },
    relatedSkill: "logic",
    keywords: ["mechanism", "how this works", "causal", "causation", "cơ chế", "nguyên nhân", "nhân quả"],
  },
  {
    key: "comparison",
    label: {
      en: "Weighing and comparison",
      vi: "So sánh và weighing",
    },
    repeatedSummary: {
      en: "Weighing and comparison has shown up repeatedly in recent feedback.",
      vi: "So sánh và weighing xuất hiện lặp lại trong feedback gần đây.",
    },
    nextSummary: {
      en: "Weighing and comparison is worth tightening in your next debate.",
      vi: "Bạn nên so sánh tác động rõ hơn trong phiên debate tiếp theo.",
    },
    relatedSkill: "rebuttal",
    keywords: ["weigh", "comparison", "comparative", "compare", "so sánh", "weighing", "quan trọng hơn"],
  },
  {
    key: "impact",
    label: {
      en: "Impact framing",
      vi: "Đóng khung tác động",
    },
    repeatedSummary: {
      en: "Impact framing has shown up repeatedly in recent feedback.",
      vi: "Đóng khung tác động xuất hiện lặp lại trong feedback gần đây.",
    },
    nextSummary: {
      en: "Impact framing is worth tightening in your next debate.",
      vi: "Bạn nên làm tác động rõ và sắc hơn trong phiên debate tiếp theo.",
    },
    relatedSkill: "clarity",
    keywords: ["impact", "impactful", "link back", "motion link", "tác động", "liên hệ motion", "kết nối motion"],
  },
  {
    key: "evidence",
    label: {
      en: "Evidence support",
      vi: "Bằng chứng hỗ trợ",
    },
    repeatedSummary: {
      en: "Evidence support has shown up repeatedly in recent feedback.",
      vi: "Bằng chứng hỗ trợ xuất hiện lặp lại trong feedback gần đây.",
    },
    nextSummary: {
      en: "Evidence support is worth tightening in your next debate.",
      vi: "Bạn nên thêm bằng chứng cụ thể hơn trong phiên debate tiếp theo.",
    },
    relatedSkill: "evidence",
    keywords: ["evidence", "example", "proof", "supporting detail", "bằng chứng", "ví dụ", "dẫn chứng", "chi tiết"],
  },
  {
    key: "clash",
    label: {
      en: "Clash and rebuttal depth",
      vi: "Clash và độ sâu phản biện",
    },
    repeatedSummary: {
      en: "Clash and rebuttal depth has shown up repeatedly in recent feedback.",
      vi: "Clash và độ sâu phản biện xuất hiện lặp lại trong feedback gần đây.",
    },
    nextSummary: {
      en: "Clash and rebuttal depth is worth tightening in your next debate.",
      vi: "Bạn nên phản biện trực diện và sâu hơn trong phiên debate tiếp theo.",
    },
    relatedSkill: "rebuttal",
    keywords: ["clash", "rebuttal", "counter", "response", "phản biện", "đáp lại", "đối đáp"],
  },
  {
    key: "delivery",
    label: {
      en: "Delivery and clarity",
      vi: "Trình bày và độ rõ",
    },
    repeatedSummary: {
      en: "Delivery and clarity has shown up repeatedly in recent feedback.",
      vi: "Trình bày và độ rõ xuất hiện lặp lại trong feedback gần đây.",
    },
    nextSummary: {
      en: "Delivery and clarity is worth tightening in your next debate.",
      vi: "Bạn nên luyện cách nói rõ và tự tin hơn trong phiên tiếp theo.",
    },
    relatedSkill: "delivery",
    keywords: ["fluency", "grammar", "vocabulary", "delivery", "confidence", "lưu loát", "ngữ pháp", "từ vựng", "trình bày", "tự tin"],
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

function describeTrack(track: PracticeTrack, practiceLanguage: PracticeLanguage) {
  if (practiceLanguage === "vi") {
    return track === "speaking" ? "luyện nói" : "luyện debate";
  }
  return track === "speaking" ? "speaking practice" : "debate practice";
}

function skillLabel(skill: SkillMetricKey, practiceLanguage: PracticeLanguage) {
  return SKILL_LABELS[practiceLanguage][skill];
}

function titleCaseSkill(
  skill: SkillMetricKey | null,
  practiceLanguage: PracticeLanguage
) {
  if (!skill) return null;
  return SKILL_TITLE_LABELS[practiceLanguage][skill];
}

function summarizeSession(
  session: SessionRow,
  practiceLanguage: PracticeLanguage
) {
  const feedback = session.feedback;
  if (feedback?.summary) return feedback.summary;
  if (session.total_score != null && session.overall_band) {
    return practiceLanguage === "vi"
      ? `Đạt ${session.total_score}/100 (${session.overall_band}) trong phiên ${describeTrack(
          getPracticeTrack(feedback),
          practiceLanguage
        )}.`
      : `Scored ${session.total_score}/100 (${session.overall_band}) on ${describeTrack(
          getPracticeTrack(feedback),
          practiceLanguage
        )}.`;
  }
  return practiceLanguage === "vi"
    ? `Đã hoàn thành phiên ${describeTrack(
        getPracticeTrack(feedback),
        practiceLanguage
      )} về "${session.topic_title}".`
    : `Completed a ${describeTrack(
        getPracticeTrack(feedback),
        practiceLanguage
      )} session on "${session.topic_title}".`;
}

function buildTranscriptExcerpt(transcript?: string | null) {
  const normalized = (transcript ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > 260 ? `${normalized.slice(0, 257)}...` : normalized;
}

function mapRecentSession(
  session: SessionRow,
  includeTranscript = false,
  practiceLanguage: PracticeLanguage = DEFAULT_PRACTICE_LANGUAGE
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
    summary: summarizeSession(session, practiceLanguage),
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

function buildWeaknessPatterns(
  sessions: SessionRow[],
  practiceLanguage: PracticeLanguage
): CoachWeaknessPattern[] {
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
    label: pattern.label[practiceLanguage],
    count: counts.get(pattern.key) ?? 0,
    summary:
      counts.get(pattern.key) && counts.get(pattern.key)! > 1
        ? pattern.repeatedSummary[practiceLanguage]
        : pattern.nextSummary[practiceLanguage],
    relatedSkill: pattern.relatedSkill,
  }))
    .filter((pattern) => pattern.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 4);
}

function buildTrendSummary(
  sessions: SessionRow[],
  practiceLanguage: PracticeLanguage
) {
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

  let summary =
    practiceLanguage === "vi"
      ? "Bạn cần thêm vài phiên có chấm điểm để phân tích xu hướng đáng tin hơn."
      : "You need a few more scored debates before trend analysis becomes reliable.";
  if (recentAverage != null && previousAverage == null) {
    summary =
      practiceLanguage === "vi"
        ? `Các phiên có điểm gần đây của bạn đang trung bình ${Math.round(
            recentAverage
          )}/100. Hãy tiếp tục xây baseline này.`
        : `Your recent scored sessions are averaging ${Math.round(
            recentAverage
          )}/100. Keep building that baseline.`;
  } else if (recentAverage != null && delta != null) {
    if (direction === "up") {
      summary =
        practiceLanguage === "vi"
          ? `${recent.length} phiên có điểm gần nhất của bạn tăng ${Math.abs(
              delta
            ).toFixed(1)} điểm.`
          : `Your last ${recent.length} scored sessions are trending up by ${Math.abs(
              delta
            ).toFixed(1)} points.`;
    } else if (direction === "down") {
      summary =
        practiceLanguage === "vi"
          ? `${recent.length} phiên có điểm gần nhất giảm ${Math.abs(
              delta
            ).toFixed(1)} điểm, nên đây là lúc tốt để siết lại nền tảng.`
          : `Your last ${recent.length} scored sessions dipped by ${Math.abs(
              delta
            ).toFixed(1)} points, so this is a good moment to tighten fundamentals.`;
    } else {
      summary =
        practiceLanguage === "vi"
          ? `Hiệu suất gần đây của bạn ổn định quanh ${Math.round(
              recentAverage
            )}/100.`
          : `Your recent performance is stable around ${Math.round(
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
  practiceLanguage: PracticeLanguage;
}) {
  const language = params.practiceLanguage;
  return buildCoachStarterPrompts({
    weakestSkillLabel: params.weakestSkill
      ? skillLabel(params.weakestSkill, language)
      : null,
    strongestSkillLabel: params.strongestSkill
      ? skillLabel(params.strongestSkill, language)
      : null,
    weaknessLabel: params.weaknessPatterns[0]?.label ?? null,
    recentSessionCount: params.recentSessions.length,
    practiceLanguage: language,
  });
}

function buildRecommendations(params: {
  skillSnapshot: CoachProfile["skillSnapshot"];
  weaknessPatterns: CoachWeaknessPattern[];
  recentSessions: CoachRecentSession[];
  underusedTrack: PracticeTrack;
  practiceLanguage: PracticeLanguage;
}): CoachRecommendation[] {
  const recommendations: CoachRecommendation[] = [];
  const language = params.practiceLanguage;

  if (params.skillSnapshot.weakestSkill) {
    const targetTrack =
      params.skillSnapshot.weakestSkill === "delivery" ? "speaking" : "debate";
    recommendations.push({
      id: "weakest-skill",
      title:
        language === "vi"
          ? `Cải thiện ${titleCaseSkill(params.skillSnapshot.weakestSkill, language)}`
          : `Improve ${titleCaseSkill(params.skillSnapshot.weakestSkill, language)}`,
      description:
        language === "vi"
          ? `Một phiên ${describeTrack(
              targetTrack,
              language
            )} là cách nhanh nhất để luyện ${skillLabel(
              params.skillSnapshot.weakestSkill,
              language
            )}.`
          : `A ${targetTrack} round is the fastest way to work on ${skillLabel(
              params.skillSnapshot.weakestSkill,
              language
            )}.`,
      prompt:
        language === "vi"
          ? `Giúp mình cải thiện ${skillLabel(
              params.skillSnapshot.weakestSkill,
              language
            )}.`
          : `Help me improve my ${skillLabel(
              params.skillSnapshot.weakestSkill,
              language
            )}.`,
      href: `/practice?track=${targetTrack}`,
      track: targetTrack,
      skillKey: params.skillSnapshot.weakestSkill,
    });
  }

  if (params.weaknessPatterns[0]) {
    recommendations.push({
      id: "recurring-pattern",
      title:
        language === "vi"
          ? `Sửa ${params.weaknessPatterns[0].label}`
          : `Fix ${params.weaknessPatterns[0].label}`,
      description: params.weaknessPatterns[0].summary,
      prompt:
        language === "vi"
          ? `Giúp mình sửa ${params.weaknessPatterns[0].label.toLowerCase()} trong phiên debate tiếp theo.`
          : `Help me fix ${params.weaknessPatterns[0].label.toLowerCase()} in my next debate.`,
      skillKey: params.weaknessPatterns[0].relatedSkill,
    });
  }

  if (params.recentSessions[0]) {
    recommendations.push({
      id: "review-latest",
      title:
        language === "vi"
          ? "Review phiên debate mới nhất"
          : "Review your latest debate",
      description: params.recentSessions[0].topicTitle,
      prompt:
        language === "vi"
          ? "Review phiên debate gần nhất và nói cho mình điểm lớn nhất cần sửa tiếp theo."
          : "Review my last debate and tell me the biggest thing to fix next.",
      href: params.recentSessions[0].href,
      track: params.recentSessions[0].practiceTrack,
    });
  }

  recommendations.push({
    id: "rebalance-track",
    title:
      language === "vi"
        ? params.underusedTrack === "speaking"
          ? "Đưa luyện nói trở lại nhịp luyện"
          : "Đưa debate trở lại nhịp luyện"
        : params.underusedTrack === "speaking"
          ? "Bring speaking back into the mix"
          : "Bring debate back into the mix",
    description:
      language === "vi"
        ? `Nhịp luyện gần đây của bạn đang ít ${describeTrack(
            params.underusedTrack,
            language
          )}.`
        : `Your recent practice mix is lighter on ${describeTrack(
            params.underusedTrack,
            language
          )}.`,
    prompt:
      language === "vi"
        ? params.underusedTrack === "speaking"
          ? "Hôm nay mình nên luyện nói hay luyện debate?"
          : "Hôm nay mình nên luyện debate hay luyện nói?"
        : params.underusedTrack === "speaking"
          ? "Should I do a speaking practice today or a debate practice?"
          : "Should I do a debate practice today or a speaking practice?",
    href: `/practice?track=${params.underusedTrack}`,
    track: params.underusedTrack,
  });

  return recommendations.slice(0, 4);
}

function buildProfileSummary(
  profile: CoachProfile,
  practiceLanguage: PracticeLanguage
) {
  const strongest = titleCaseSkill(
    profile.skillSnapshot.strongestSkill,
    practiceLanguage
  );
  const weakest = titleCaseSkill(
    profile.skillSnapshot.weakestSkill,
    practiceLanguage
  );

  if (practiceLanguage === "vi") {
    return [
      `Người dùng: ${profile.displayName}`,
      `Chuỗi ngày: ${profile.streak}`,
      `Level: ${profile.level}`,
      `Credits: ${profile.credits}`,
      `Mục tiêu hằng ngày: ${profile.dailyGoalMinutes} phút`,
      `Nhịp luyện: ${profile.sessionsLast7} phiên trong 7 ngày, ${profile.minutesLast7} phút trong 7 ngày, ${profile.sessionsLast30} phiên trong 30 ngày`,
      `Tỷ lệ luyện: speaking ${profile.practiceMix.speaking}, debate ${profile.practiceMix.debate}, track đang ít ${profile.practiceMix.underusedTrack}`,
      `Ảnh chụp kỹ năng: mạnh nhất ${strongest ?? "chưa có"}, yếu nhất ${weakest ?? "chưa có"}, tổng ${
        profile.skillSnapshot.overallScore != null
          ? `${Math.round(profile.skillSnapshot.overallScore)}/100`
          : "chưa có"
      }, độ tin cậy ${profile.skillSnapshot.confidence}%`,
      `Xu hướng: ${profile.recentTrend.summary}`,
      profile.weaknessPatterns.length > 0
        ? `Điểm yếu lặp lại: ${profile.weaknessPatterns
            .map((pattern) => pattern.label)
            .join(", ")}`
        : "Điểm yếu lặp lại: chưa xác định",
      profile.strengthPatterns.length > 0
        ? `Điểm mạnh lặp lại: ${profile.strengthPatterns.join(", ")}`
        : "Điểm mạnh lặp lại: chưa xác định",
    ].join("\n");
  }

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

async function getCourseSummary(
  userId: string,
  courseId: string,
  supabaseInput?: SupabaseClient
) {
  const supabase = supabaseInput ?? (await createClient());
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

async function getSessionById(
  userId: string,
  sessionId: string,
  supabaseInput?: SupabaseClient
) {
  const supabase = supabaseInput ?? (await createClient());
  const { data: rpcSession, error: rpcError } = await supabase.rpc(
    "get_practice_feedback_payload",
    { p_session_id: sessionId }
  );

  if (!rpcError && rpcSession && typeof rpcSession === "object" && !Array.isArray(rpcSession)) {
    return rpcSession as SessionRow;
  }

  const { data } = await supabase
      .from("debate_sessions")
      .select(
        "id, topic_title, category:topic_category, side, mode, feedback, total_score, overall_band, transcript, duration_seconds, created_at"
      )
    .eq("user_id", userId)
    .eq("id", sessionId)
    .maybeSingle();

  return (data as SessionRow | null) ?? null;
}

async function getDuelContext(
  userId: string,
  duelIdentifier: string,
  supabaseInput?: SupabaseClient
) {
  const supabase = supabaseInput ?? (await createClient());
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
  practiceLanguage?: PracticeLanguage;
}) {
  const normalizedMessage = params.message?.toLowerCase() ?? "";
  const contextType = params.contextType ?? "";
  const practiceLanguage = params.practiceLanguage ?? DEFAULT_PRACTICE_LANGUAGE;

  if (contextType === "duel-review") return "duel-review" as CoachIntentMode;
  if (contextType === "course") return "course-help" as CoachIntentMode;
  if (contextType === "practice-feedback") return "session-review" as CoachIntentMode;

  if (
    (normalizedMessage.includes("compare") &&
      (normalizedMessage.includes("recent") || normalizedMessage.includes("last"))) ||
    (practiceLanguage === "vi" &&
      normalizedMessage.includes("so sánh") &&
      (normalizedMessage.includes("gần nhất") || normalizedMessage.includes("vừa rồi")))
  ) {
    return "session-comparison" as CoachIntentMode;
  }

  if (
    normalizedMessage.includes("review my last") ||
    normalizedMessage.includes("review my latest") ||
    normalizedMessage.includes("last debate") ||
    normalizedMessage.includes("latest debate") ||
    (practiceLanguage === "vi" &&
      (normalizedMessage.includes("review phiên") ||
        normalizedMessage.includes("xem lại phiên") ||
        normalizedMessage.includes("debate gần nhất")))
  ) {
    return "session-review" as CoachIntentMode;
  }

  if (
    normalizedMessage.includes("progress") ||
    normalizedMessage.includes("trend") ||
    normalizedMessage.includes("improving") ||
    normalizedMessage.includes("why is my") ||
    (practiceLanguage === "vi" &&
      (normalizedMessage.includes("tiến bộ") ||
        normalizedMessage.includes("xu hướng") ||
        normalizedMessage.includes("vì sao")))
  ) {
    return "progress-review" as CoachIntentMode;
  }

  return "general-coaching" as CoachIntentMode;
}

export async function getCoachProfile(
  userId: string,
  practiceLanguageInput?: PracticeLanguage | string | null,
  supabaseInput?: SupabaseClient
): Promise<CoachProfile> {
  const supabase = supabaseInput ?? (await createClient());
  const practiceLanguage = coercePracticeLanguage(
    practiceLanguageInput,
    DEFAULT_PRACTICE_LANGUAGE
  );
  const trailing30Dates = getTrailingDates(DAYS_30);
  const today = trailing30Dates[trailing30Dates.length - 1];

  let scoredSessionsQuery = supabase
    .from("debate_sessions")
    .select(
      "id, topic_title, category:topic_category, topic_difficulty, side, mode, ai_difficulty, feedback, total_score, overall_band, practice_language, duration_seconds, created_at"
    )
    .eq("user_id", userId)
    .not("total_score", "is", null);
  let recentSessionsQuery = supabase
    .from("debate_sessions")
    .select(
      "id, topic_title, category:topic_category, topic_difficulty, side, mode, ai_difficulty, feedback, total_score, overall_band, practice_language, duration_seconds, created_at"
    )
    .eq("user_id", userId);

  if (practiceLanguage === "vi") {
    scoredSessionsQuery = scoredSessionsQuery.eq("practice_language", "vi");
    recentSessionsQuery = recentSessionsQuery.eq("practice_language", "vi");
  } else {
    scoredSessionsQuery = scoredSessionsQuery.or(
      "practice_language.eq.en,practice_language.is.null"
    );
    recentSessionsQuery = recentSessionsQuery.or(
      "practice_language.eq.en,practice_language.is.null"
    );
  }

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
      scoredSessionsQuery
        .order("created_at", { ascending: false })
        .limit(MAX_SCORED_SESSIONS),
      recentSessionsQuery
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
  const recentTrend = buildTrendSummary(scoredSessions, practiceLanguage);
  const weaknessPatterns = buildWeaknessPatterns(
    scoredSessions.slice(0, 8),
    practiceLanguage
  );
  const strengthPatterns = buildStrengthPatterns(scoredSessions.slice(0, 8));
  const mappedRecentSessions = recentSessions.map((session) =>
    mapRecentSession(session, false, practiceLanguage)
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
    let duelQuery = supabase
      .from("debate_duels")
      .select("id, topic_title, practice_language")
      .in("id", duelIds);
    duelQuery =
      practiceLanguage === "vi"
        ? duelQuery.eq("practice_language", "vi")
        : duelQuery.or("practice_language.eq.en,practice_language.is.null");

    const { data: duelData } = await duelQuery;
    const languageScopedDuelIds = ((duelData ?? []) as DuelRow[]).map(
      (duel) => duel.id
    );
    const { data: judgmentData } =
      languageScopedDuelIds.length > 0
        ? await supabase
            .from("debate_duel_judgments")
            .select("duel_id, winner_side, summary, verdict, created_at")
            .in("duel_id", languageScopedDuelIds)
            .order("created_at", { ascending: false })
        : { data: [] };

    const judgments = (judgmentData ?? []) as DuelJudgmentRow[];
    const roleByDuel = new Map(
      duelParticipants.map((participant) => [participant.duel_id, participant.role])
    );
    const duelById = new Map(
      ((duelData ?? []) as DuelRow[]).map((duel) => [duel.id, duel])
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
        ? `${duelById.get(judgments[0].duel_id)?.topic_title ?? (practiceLanguage === "vi" ? "Duel gần đây" : "Recent duel")}: ${
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
      difficultyBreakdown: skillSnapshot.difficultyBreakdown,
    },
    weaknessPatterns,
    recentSessions: mappedRecentSessions,
    underusedTrack,
    practiceLanguage,
  });

  const starterPrompts = buildStarterPrompts({
    weakestSkill: skillSnapshot.weakestSkill,
    strongestSkill: skillSnapshot.strongestSkill,
    weaknessPatterns,
    recentSessions: mappedRecentSessions,
    practiceLanguage,
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
      difficultyBreakdown: skillSnapshot.difficultyBreakdown,
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
      strongestSkillLabel: titleCaseSkill(skillSnapshot.strongestSkill, practiceLanguage),
      weakestSkillLabel: titleCaseSkill(skillSnapshot.weakestSkill, practiceLanguage),
      trendSummary: recentTrend.summary,
      nextMove:
        recommendations[0]?.description ??
        (practiceLanguage === "vi"
          ? "Bắt đầu một phiên debate có chấm điểm để Coach cá nhân hóa bước tiếp theo."
          : "Start a scored debate round so the coach can personalize your next move."),
    },
  };
}

export async function getCoachContextEnvelope(params: {
  userId: string;
  profile: CoachProfile;
  contextType?: string | null;
  contextId?: string | null;
  message?: string | null;
  practiceLanguage?: PracticeLanguage | string | null;
  supabase?: SupabaseClient;
}): Promise<CoachContextEnvelope> {
  const practiceLanguage = coercePracticeLanguage(
    params.practiceLanguage,
    DEFAULT_PRACTICE_LANGUAGE
  );
  const mode = inferIntent({
    contextType: params.contextType,
    message: params.message,
    practiceLanguage,
  });

  let selectedSession: CoachRecentSession | null = null;
  let selectedDuel: CoachContextEnvelope["selectedDuel"] = null;
  let selectedCourse: CoachContextEnvelope["selectedCourse"] = null;

  if (params.contextType === "practice-feedback" && params.contextId) {
    const session = await getSessionById(
      params.userId,
      params.contextId,
      params.supabase
    );
    if (session) {
      selectedSession = mapRecentSession(session, true, practiceLanguage);
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
      const session = await getSessionById(
        params.userId,
        latestSessionId,
        params.supabase
      );
      if (session) {
        selectedSession = mapRecentSession(session, true, practiceLanguage);
      }
    }
  }

  if (params.contextType === "duel-review" && params.contextId) {
    selectedDuel = await getDuelContext(
      params.userId,
      params.contextId,
      params.supabase
    );
  }

  if (params.contextType === "course" && params.contextId) {
    selectedCourse = await getCourseSummary(
      params.userId,
      params.contextId,
      params.supabase
    );
  }

  const strongest = titleCaseSkill(
    params.profile.skillSnapshot.strongestSkill,
    practiceLanguage
  );
  const weakest = titleCaseSkill(
    params.profile.skillSnapshot.weakestSkill,
    practiceLanguage
  );
  const starterPrompts =
    selectedSession != null
      ? practiceLanguage === "vi"
        ? [
            `Review phiên "${selectedSession.topicTitle}" của mình.`,
            "Điểm yếu lớn nhất trong phiên đó là gì?",
            "Bạn sẽ xây lại lập luận yếu nhất của mình như thế nào?",
            "Cho mình một bài luyện đúng vào phiên này.",
          ]
        : [
            `Review my session on "${selectedSession.topicTitle}".`,
            "What was the biggest weakness in that round?",
            "How would you rebuild my weakest argument?",
            "Give me a targeted drill for this session.",
          ]
      : selectedDuel != null
        ? practiceLanguage === "vi"
          ? [
              `Vì sao ${selectedDuel.winnerSide ?? "phe đó"} thắng trận này?`,
              "Mình nên đổi gì trong lần đấu lại?",
              "So sánh chất lượng phản biện của hai bên.",
              "Cho mình một kế hoạch cải thiện riêng cho trận này.",
            ]
          : [
              `Why did ${selectedDuel.winnerSide ?? "that side"} win this duel?`,
              "What should I change in the rematch?",
              "Compare both sides' rebuttal quality.",
              "Give me a duel-specific improvement plan.",
            ]
        : params.profile.starterPrompts;

  const focusTitle =
    selectedSession != null
      ? practiceLanguage === "vi"
        ? "Review phiên đã ghim"
        : "Pinned session review"
      : selectedDuel != null
        ? practiceLanguage === "vi"
          ? "Review duel đã ghim"
          : "Pinned duel review"
        : selectedCourse != null
          ? practiceLanguage === "vi"
            ? "Coach theo khóa học"
            : "Course-aware coaching"
          : practiceLanguage === "vi"
            ? "Trọng tâm coaching hiện tại"
            : "Current coaching focus";

  const focusSummary =
    selectedSession != null
      ? practiceLanguage === "vi"
        ? `${selectedSession.topicTitle} đã sẵn sàng để review với điểm, điểm mạnh và ghi chú cải thiện đi kèm.`
        : `${selectedSession.topicTitle} is ready to review with its score, strengths, and improvement notes attached.`
      : selectedDuel != null
        ? practiceLanguage === "vi"
          ? `${selectedDuel.topicTitle} đã được ghim cùng phán quyết AI và ghi chú so sánh.`
          : `${selectedDuel.topicTitle} is pinned with the AI verdict and comparative notes.`
        : selectedCourse != null
          ? practiceLanguage === "vi"
            ? `${selectedCourse.title} đã được gắn vào, nên Coach có thể nối nội dung khóa học với hồ sơ debate của bạn.`
            : `${selectedCourse.title} is attached, so the coach can connect course work to your debate profile.`
          : weakest && strongest
            ? practiceLanguage === "vi"
              ? `Mảng mạnh nhất của bạn là ${strongest}, còn ${weakest} là khoảng trống rõ nhất cần xử lý tiếp.`
              : `Your strongest area is ${strongest}, while ${weakest} is the clearest gap to close next.`
            : params.profile.recentTrend.summary;

  const promptContext = [
    buildProfileSummary(params.profile, practiceLanguage),
    selectedSession
      ? buildSessionPromptContext(selectedSession, mode === "session-review")
      : null,
    selectedDuel ? buildDuelPromptContext(selectedDuel) : null,
    selectedCourse ? buildCoursePromptContext(selectedCourse) : null,
    mode === "session-comparison" &&
    params.profile.recentSessions.filter((session) => session.totalScore != null).length > 1
      ? practiceLanguage === "vi"
        ? `Các phiên gần đây để so sánh: ${params.profile.recentSessions
            .filter((session) => session.totalScore != null)
            .slice(0, 3)
            .map(
              (session) =>
                `${session.topicTitle} (${session.totalScore != null ? `${session.totalScore}/100` : "chưa chấm"})`
            )
            .join(", ")}`
        : `Recent sessions to compare: ${params.profile.recentSessions
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
