import { Suspense } from "react";
import { redirect } from "next/navigation";
import { IeltsProfilePerformanceCenter } from "@/components/ielts/profile/IeltsProfilePerformanceCenter";
import type {
  IeltsConsistencyDayView,
  IeltsProfileAttemptView,
  IeltsProfileView,
  IeltsTeacherFeedbackView,
} from "@/components/ielts/profile/types";
import {
  getIeltsHomeData,
  type IeltsHomeData,
} from "@/lib/api/ielts/learner-repository";
import { loadAttemptResults } from "@/lib/api/ielts/results-repository";
import { loadActiveIeltsStudyPlan } from "@/lib/api/ielts/study-plan-repository";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { createTypedServerClient } from "@/lib/supabase/server";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import {
  DEFAULT_IELTS_TARGET_BAND,
  IELTS_SKILLS,
} from "@/lib/ielts/adaptive/contracts";
import type { AttemptResultsInput } from "@/lib/ielts/results/types";

export const metadata = { title: "IELTS performance" };
export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
const CONSISTENCY_DAYS = 84;

function dayKey(value: string): string {
  return value.slice(0, 10);
}

function consistencyDays(
  plan: Awaited<ReturnType<typeof loadActiveIeltsStudyPlan>>,
): IeltsConsistencyDayView[] {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const byDate = new Map<string, IeltsConsistencyDayView>();
  for (let offset = CONSISTENCY_DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date(end.getTime() - offset * DAY_MS)
      .toISOString()
      .slice(0, 10);
    byDate.set(date, {
      date,
      completedMinutes: 0,
      completedTasks: 0,
      plannedMinutes: 0,
      plannedTasks: 0,
    });
  }

  for (const item of plan?.items ?? []) {
    const planned = byDate.get(item.scheduled_date);
    if (planned) {
      planned.plannedMinutes += item.estimated_minutes;
      planned.plannedTasks += 1;
    }
    if (item.status !== "completed" && !item.completed_at) continue;
    const completed = byDate.get(
      dayKey(item.completed_at ?? item.scheduled_date),
    );
    if (!completed) continue;
    completed.completedMinutes += item.estimated_minutes;
    completed.completedTasks += 1;
  }
  return [...byDate.values()];
}

function teacherFeedback(
  attempts: IeltsProfileAttemptView[],
  details: Array<Awaited<ReturnType<typeof loadAttemptResults>>>,
): IeltsTeacherFeedbackView[] {
  const attemptsById = new Map(
    attempts.map((attempt) => [attempt.attemptId, attempt]),
  );
  return details.flatMap((detail) => {
    if (!detail) return [];
    const attempt = attemptsById.get(detail.attemptId);
    if (!attempt) return [];
    const writing = detail.writingTasks.flatMap((task) =>
      task.teacherFeedback
        ? [
            {
              id: `${detail.attemptId}:writing:${task.questionId}`,
              attemptId: detail.attemptId,
              testTitle: detail.testTitle,
              skill: "writing" as const,
              taskLabel: String(task.taskNumber),
              note: task.teacherFeedback,
              submittedAt: detail.submittedAt,
              resultsHref: attempt.resultsHref,
            },
          ]
        : [],
    );
    const speaking = detail.speakingParts.flatMap((part) =>
      part.teacherFeedback
        ? [
            {
              id: `${detail.attemptId}:speaking:${part.questionId}`,
              attemptId: detail.attemptId,
              testTitle: detail.testTitle,
              skill: "speaking" as const,
              taskLabel: part.partNumber ? String(part.partNumber) : "",
              note: part.teacherFeedback,
              submittedAt: detail.submittedAt,
              resultsHref: attempt.resultsHref,
            },
          ]
        : [],
    );
    return [...writing, ...speaking];
  });
}

function buildAttempts(
  recentAttempts: IeltsHomeData["recentAttempts"],
  details: AttemptResultsInput[],
): IeltsProfileAttemptView[] {
  const detailById = new Map(
    details.map((detail) => [detail.attemptId, detail]),
  );
  return recentAttempts.map((attempt) => {
    const detail = detailById.get(attempt.attemptId);
    const scoreSource = detail?.scoreSource ?? "unknown";
    const band =
      scoreSource === "teacher_confirmed"
        ? (detail?.publishedOverallBand ?? null)
        : scoreSource === "unknown"
          ? null
          : (detail?.provisionalBand ?? detail?.publishedOverallBand ?? null);
    return {
      attemptId: attempt.attemptId,
      testTitle: attempt.testTitle,
      submittedAt: attempt.submittedAt,
      status: attempt.status,
      band,
      scoreSource,
      resultsHref: attempt.resultsHref,
    };
  });
}

function buildSkills(
  home: IeltsHomeData,
  plan: Awaited<ReturnType<typeof loadActiveIeltsStudyPlan>>,
  targetOverall: number,
): IeltsProfileView["skills"] {
  const targets = {
    listening: plan?.plan.target_listening_band,
    reading: plan?.plan.target_reading_band,
    writing: plan?.plan.target_writing_band,
    speaking: plan?.plan.target_speaking_band,
  };
  return IELTS_SKILLS.map((skill) => ({
    skill,
    band: home.prediction.skills[skill].band,
    lower: home.prediction.skills[skill].lower,
    upper: home.prediction.skills[skill].upper,
    target: targets[skill] ?? targetOverall,
    confidencePercent: Math.round(
      home.prediction.skills[skill].confidence * 100,
    ),
    status: home.prediction.skills[skill].status,
  }));
}

function buildConsistency(
  home: IeltsHomeData,
  plan: Awaited<ReturnType<typeof loadActiveIeltsStudyPlan>>,
): IeltsProfileView["consistency"] {
  return {
    timezone: plan?.plan.timezone ?? home.retention.timezone,
    dailyMinutesGoal:
      plan?.plan.daily_minutes ?? home.retention.dailyGoal.minutesGoal,
    currentStreak: home.retention.streak.current,
    longestStreak: home.retention.streak.longest,
    days: consistencyDays(plan),
  };
}

function buildNextAction(home: IeltsHomeData): IeltsProfileView["nextAction"] {
  const next = home.today[0];
  return {
    titleEn: next?.titleEn ?? "Open your study plan",
    titleVi: next?.titleVi ?? "Mở kế hoạch học",
    href: next?.launchHref ?? "/ielts/study-plan",
    estimatedMinutes: next?.estimatedMinutes ?? null,
  };
}

function buildProfileView(params: {
  home: IeltsHomeData;
  plan: Awaited<ReturnType<typeof loadActiveIeltsStudyPlan>>;
  details: AttemptResultsInput[];
}): IeltsProfileView {
  const { home, plan, details } = params;
  const attempts = buildAttempts(home.recentAttempts, details);
  const targetOverall =
    plan?.plan.target_overall_band ?? DEFAULT_IELTS_TARGET_BAND;
  const estimate = home.prediction.overall;
  return {
    identity: home.identity,
    module: home.prediction.module,
    target: {
      overallBand: targetOverall,
      testDate: plan?.plan.target_test_date ?? null,
    },
    estimate: {
      band: estimate.band,
      lower: estimate.lower,
      upper: estimate.upper,
      confidencePercent: Math.round(estimate.confidence * 100),
      status: estimate.status,
      source: "ai_provisional",
      asOf: home.prediction.asOf,
      limitations: home.prediction.limitations,
    },
    skills: buildSkills(home, plan, targetOverall),
    recentAttempts: attempts,
    teacherFeedback: teacherFeedback(attempts, details).slice(0, 4),
    consistency: buildConsistency(home, plan),
    nextAction: buildNextAction(home),
  };
}

async function loadProfileView(): Promise<IeltsProfileView> {
  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devUser = user ? null : await getDevAuthBypassUserFromServerContext();
  const userId = user?.id ?? devUser?.id;
  if (!userId) redirect("/auth/login?next=/ielts/profile");

  const client = devUser ? createTypedAdminClient() : supabase;
  const [home, plan] = await Promise.all([
    getIeltsHomeData(userId, client),
    loadActiveIeltsStudyPlan(userId, client),
  ]);
  const completeAttempts = home.recentAttempts.filter(
    (attempt) => attempt.status !== "in_progress",
  );
  const detailResults = user
    ? await Promise.all(
        completeAttempts.map(async (attempt) => {
          try {
            return await loadAttemptResults(attempt.attemptId);
          } catch (error) {
            // Performance remains usable when optional result-detail fields have
            // not reached an environment yet. The repository still reports the
            // contract error to server logs; no database detail reaches the UI.
            console.warn("IELTS profile result details unavailable", {
              attemptId: attempt.attemptId,
              error,
            });
            return null;
          }
        }),
      )
    : [];
  const details = detailResults.filter(
    (detail): detail is AttemptResultsInput => detail !== null,
  );
  return buildProfileView({ home, plan, details });
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <div className="h-16 animate-pulse rounded-xl bg-surface-container" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-xl bg-surface-container lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-xl bg-surface-container" />
      </div>
    </div>
  );
}

async function ProfilePayload() {
  return <IeltsProfilePerformanceCenter view={await loadProfileView()} />;
}

export default function IeltsProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfilePayload />
    </Suspense>
  );
}
