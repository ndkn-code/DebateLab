import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import { STUDENT_COURSES_ENABLED } from "@/lib/features";
import type {
  DashboardHomeData,
  DashboardRecommendedDrill,
  DashboardTodayPlanItem,
} from "@/lib/api/dashboard";
import type { PracticeTrack } from "@/types/feedback";
import { ProtectedShell } from "../../(protected)/protected-shell";

type DashboardQaState =
  | "normal"
  | "empty"
  | "course"
  | "weak-speaking"
  | "weak-debate";

const QA_USER_ID = DEV_ADMIN_PROFILE.id;

function isLocalhostHost(host: string) {
  const normalizedHost = host.toLowerCase();
  return (
    normalizedHost === "localhost" ||
    normalizedHost.startsWith("localhost:") ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost.startsWith("127.0.0.1:") ||
    normalizedHost === "[::1]" ||
    normalizedHost.startsWith("[::1]:")
  );
}

function getQaState(value: string | string[] | undefined): DashboardQaState {
  const state = Array.isArray(value) ? value[0] : value;
  if (
    state === "empty" ||
    state === "course" ||
    state === "weak-speaking" ||
    state === "weak-debate"
  ) {
    return state;
  }

  return "normal";
}

function makeDate(daysAgo: number) {
  const date = new Date("2026-05-18T12:00:00.000Z");
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function makeRecommendedDrill(
  overrides: Partial<DashboardRecommendedDrill> = {}
): DashboardRecommendedDrill {
  return {
    key: "weakest-skill",
    href: "/practice?track=debate",
    detailHref: "/profile",
    ctaKey: "start",
    durationMinutes: 10,
    context: "Social media and mental health",
    scoreOutOf100: 63,
    skillKey: "rebuttal",
    track: "debate",
    ...overrides,
  };
}

function makePlanItem(
  id: string,
  overrides: Partial<DashboardTodayPlanItem>
): DashboardTodayPlanItem {
  return {
    id,
    ...makeRecommendedDrill(),
    ...overrides,
  };
}

function trackTitle(track: PracticeTrack) {
  return track === "speaking" ? "Speaking Practice" : "Debate Practice";
}

function makeDashboardData(state: DashboardQaState): DashboardHomeData {
  const hasActivity = state !== "empty";
  const recommendedDrill =
    state === "course" && STUDENT_COURSES_ENABLED
      ? makeRecommendedDrill({
          key: "continue-course",
          href: "/courses",
          detailHref: "/courses",
          ctaKey: "continue",
          durationMinutes: 12,
          context: "Persuasive Speaking 101",
          progressLabel: "42%",
          scoreOutOf100: null,
          skillKey: undefined,
          track: undefined,
        })
      : state === "weak-speaking"
        ? makeRecommendedDrill({
            href: "/practice?track=speaking",
            context: "Filler words and pacing",
            scoreOutOf100: 58,
            skillKey: "delivery",
            track: "speaking",
          })
        : state === "empty"
          ? makeRecommendedDrill({
              key: "underused-track",
              href: "/practice?track=speaking",
              detailHref: "/practice",
              context: null,
              scoreOutOf100: null,
              skillKey: undefined,
              track: "speaking",
          })
        : makeRecommendedDrill();

  const todayPlanItems: DashboardTodayPlanItem[] = [
    ...(STUDENT_COURSES_ENABLED
      ? [
          makePlanItem("continue-course", {
            key: "continue-course",
            href: "/courses",
            detailHref: "/courses",
            ctaKey: "continue",
            durationMinutes: 12,
            context: "Persuasive Speaking 101",
            progressLabel: "42%",
            scoreOutOf100: null,
            skillKey: undefined,
            track: undefined,
          }),
        ]
      : []),
    makePlanItem("review-feedback", {
      key: "review-feedback",
      href: "/history/qa-feedback",
      detailHref: "/history/qa-feedback",
      ctaKey: "review",
      durationMinutes: 7,
      context: "Social media does more harm than good",
      scoreOutOf100: 72,
      skillKey: undefined,
      track: "speaking",
    }),
    makePlanItem("weakest-skill", {
      key: "weakest-skill",
      href: recommendedDrill.href,
      detailHref: "/profile",
      ctaKey: "start",
      durationMinutes: 10,
      context: recommendedDrill.context,
      scoreOutOf100: recommendedDrill.scoreOutOf100,
      skillKey: recommendedDrill.skillKey,
      track: recommendedDrill.track,
    }),
  ];

  const metrics = [
    { key: "clarity", value: 80 },
    { key: "logic", value: 73 },
    { key: "rebuttal", value: state === "weak-debate" || state === "normal" ? 63 : 77 },
    { key: "evidence", value: 68 },
    { key: "delivery", value: state === "weak-speaking" ? 58 : 73 },
  ] as const;

  return {
    profile: DEV_ADMIN_PROFILE,
    nav: [
      { key: "dashboard", href: "/dashboard", status: "live" },
      { key: "practice", href: "/practice", status: "live" },
      { key: "duel", href: "/debates", status: "live" },
      ...(STUDENT_COURSES_ENABLED
        ? ([{ key: "courses", href: "/courses", status: "live" }] as const)
        : []),
      { key: "coach", href: "/chat?context=coach-home", status: "live" },
      { key: "history", href: "/history", status: "live" },
      { key: "analytics", href: "/profile", status: "live" },
    ],
    topBar: {
      currentStreak: hasActivity ? 7 : 0,
      orbBalance: 98300,
      level: 3,
      xpCurrent: 240,
      xpGoal: 500,
      pendingNotifications: 0,
    },
    hero: {
      weeklyStats: Array.from({ length: 7 }, (_, index) => ({
        date: `2026-05-${String(12 + index).padStart(2, "0")}`,
        sessions_completed: hasActivity && index > 1 ? 1 : 0,
        practice_minutes: hasActivity && index > 1 ? 20 : 0,
        xp_earned: hasActivity && index > 1 ? 40 : 0,
      })),
      todayGoal: {
        goalMinutes: 30,
        practicedMinutes: hasActivity ? 12 : 0,
        remainingMinutes: hasActivity ? 18 : 30,
        progressPercent: hasActivity ? 40 : 0,
        metGoal: false,
      },
      weeklyGoal: {
        goalMinutes: 100,
        practicedMinutes: hasActivity ? 86 : 0,
        remainingMinutes: hasActivity ? 14 : 100,
        progressPercent: hasActivity ? 86 : 0,
        metGoal: false,
      },
    },
    skillSnapshot: {
      metrics: metrics.map((metric) => ({
        key: metric.key,
        rawValue: hasActivity ? metric.value : 0,
        challengeAdjustedValue: hasActivity ? metric.value : 0,
        value: hasActivity ? metric.value : 0,
        effectiveSessions: hasActivity ? 4 : 0,
        coverage: hasActivity ? 1 : 0,
      })),
      overallScore: hasActivity ? 72 : null,
      weakestSkill:
        state === "weak-speaking"
          ? "delivery"
          : state === "empty"
            ? null
            : "rebuttal",
      strongestSkill: hasActivity ? "clarity" : null,
      sourceSessions: hasActivity ? 6 : 0,
      confidence: hasActivity ? 58 : 0,
      trackBreakdown: { speaking: hasActivity ? 3 : 0, debate: hasActivity ? 3 : 0 },
      difficultyBreakdown: {
        topic: { beginner: 1, intermediate: 4, advanced: 1 },
        ai: { easy: 1, medium: 4, hard: 1, none: 0 },
      },
    },
    recommendedDrill,
    quickActions: [
      {
        key: "speaking",
        href: "/practice?track=speaking",
        status: "live",
        descriptionKey: "action_speaking_desc",
      },
      {
        key: "debate",
        href: "/practice?track=debate",
        status: "live",
        descriptionKey: "action_debate_desc",
      },
      ...(STUDENT_COURSES_ENABLED
        ? ([
            {
              key: "course",
              href: "/courses",
              status: "live",
              descriptionKey: "action_course_desc",
            },
          ] as const)
        : []),
      {
        key: "coach",
        href: "/chat?context=coach-home",
        status: "live",
        descriptionKey: "action_coach_desc",
      },
    ],
    recentActivity: hasActivity
      ? [
          {
            id: "qa-session-1",
            kind: "speaking",
            title: "Social media does more harm than good",
            subtitle: trackTitle("speaking"),
            createdAt: makeDate(3),
            href: "/history/qa-session-1",
            scoreOutOf100: 72,
            statusLabel: "Proficient",
            progressPercent: null,
          },
          {
            id: "qa-session-2",
            kind: "debate",
            title: "AI tutors should be allowed in schools",
            subtitle: trackTitle("debate"),
            createdAt: makeDate(8),
            href: "/history/qa-session-2",
            scoreOutOf100: 86,
            statusLabel: "Proficient",
            progressPercent: null,
          },
        ]
      : [],
    todayPlanItems: state === "empty"
      ? [
          makePlanItem("start-speaking", {
            key: "start-speaking",
            href: "/practice?track=speaking",
            detailHref: "/practice",
            ctaKey: "start",
            durationMinutes: 10,
            context: null,
            scoreOutOf100: null,
            skillKey: undefined,
            track: "speaking",
          }),
          makePlanItem("start-debate", {
            key: "start-debate",
            href: "/practice?track=debate",
            detailHref: "/practice",
            ctaKey: "start",
            durationMinutes: 10,
            context: null,
            scoreOutOf100: null,
            skillKey: undefined,
            track: "debate",
          }),
          makePlanItem("coach-check", {
            key: "coach-check",
            href: "/chat?context=coach-home",
            detailHref: "/chat?context=coach-home",
            ctaKey: "ask-coach",
            durationMinutes: 5,
            context: null,
            scoreOutOf100: null,
            skillKey: undefined,
            track: undefined,
          }),
        ]
      : todayPlanItems,
    progress: [
      { key: "total-sessions", value: hasActivity ? 20 : 0, displayValue: hasActivity ? "20" : "0", delta: hasActivity ? 1 : null },
      { key: "strong-rate", value: hasActivity ? 70 : 0, displayValue: hasActivity ? "70%" : "0%", delta: hasActivity ? 4 : null },
      { key: "average-score", value: hasActivity ? 72 : 0, displayValue: hasActivity ? "72 /100" : "0 /100", delta: hasActivity ? 2 : null },
      { key: "practice-time", value: hasActivity ? 338 : 0, displayValue: hasActivity ? "338 min" : "0 min", delta: hasActivity ? 22 : null },
    ],
    sidebarCards: {
      dailyGoal: {
        goalMinutes: 30,
        practicedMinutes: hasActivity ? 12 : 0,
        remainingMinutes: hasActivity ? 18 : 30,
        progressPercent: hasActivity ? 40 : 0,
        metGoal: false,
      },
      inviteOrbs: 500,
      referralCode: "QA-DEBATE",
    },
    courseContinuation: state === "course" && STUDENT_COURSES_ENABLED
      ? {
          courseId: "qa-course",
          title: "Persuasive Speaking 101",
          category: "public-speaking",
          progressPercent: 42,
          href: "/courses",
        }
      : null,
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  const host = (await headers()).get("host") ?? "";
  if (process.env.NODE_ENV !== "development" || !isLocalhostHost(host)) {
    notFound();
  }

  const state = getQaState((await searchParams).state);
  return (
    <ProtectedShell
      profile={DEV_ADMIN_PROFILE}
      userEmail={DEV_ADMIN_PROFILE.email}
      userId={QA_USER_ID}
    >
      <DashboardContent
        data={makeDashboardData(state)}
        displayName="Jensen Huang"
        userId={QA_USER_ID}
        showWelcome={false}
      />
    </ProtectedShell>
  );
}
