import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getEmailTestRecipient,
  getReplyToEmailAddresses,
  getSenderEmailAddress,
  getSupportEmailAddress,
  isEmailDryRun,
  isEmailSendingEnabled,
} from "@/lib/email/config";
import {
  evaluateEmailCandidatesForProfile,
  type EmailMessageHistory,
} from "@/lib/email/eligibility";
import { renderThinkfyEmail } from "@/lib/email/templates";
import { loadActiveEmailTemplateOverrides } from "@/lib/email/template-overrides";
import { buildListUnsubscribeHeaders } from "@/lib/email/unsubscribe";
import { computeEmailStreakState, isQualifyingStreakActivity } from "@/lib/email/time";
import type {
  EmailActivitySummary,
  EmailCategory,
  EmailCandidate,
  EmailDispatchResult,
  EmailProfile,
} from "@/lib/email/types";

interface ActivityLogRow {
  user_id: string;
  activity_type: string;
  reference_type: string | null;
  metadata: Record<string, unknown> | null;
  xp_earned: number;
  created_at: string;
}

interface DailyStatsRow {
  user_id: string;
  date: string;
  sessions_completed: number;
  minutes_studied?: number | null;
  practice_minutes?: number | null;
  xp_earned: number;
  average_score: number | null;
}

function getSince(days: number, now: Date) {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

function toRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createEmptySummary(): EmailActivitySummary {
  return {
    lastActivityAt: null,
    lastPracticeAt: null,
    lastLessonAt: null,
    lastCourseStartedAt: null,
    sessionsLast7Days: 0,
    minutesLast7Days: 0,
    xpLast7Days: 0,
    bestScoreLast7Days: null,
    latestCourseTitle: null,
    latestAchievementLabel: null,
    latestAchievementKey: null,
  };
}

function newerDate(current: string | null, next: string) {
  if (!current) return next;
  return new Date(next).getTime() > new Date(current).getTime() ? next : current;
}

function summarizeActivity(input: {
  profile: EmailProfile;
  activities: ActivityLogRow[];
  dailyStats: DailyStatsRow[];
  now?: Date;
}) {
  const summary = createEmptySummary();

  for (const activity of input.activities) {
    summary.lastActivityAt = newerDate(summary.lastActivityAt, activity.created_at);

    if (isQualifyingStreakActivity(activity)) {
      summary.lastPracticeAt = newerDate(summary.lastPracticeAt, activity.created_at);
    }

    if (activity.activity_type === "lesson_completed") {
      summary.lastLessonAt = newerDate(summary.lastLessonAt, activity.created_at);
    }

    if (activity.activity_type === "course_started") {
      summary.lastCourseStartedAt = newerDate(summary.lastCourseStartedAt, activity.created_at);
      const metadata = toRecord(activity.metadata);
      summary.latestCourseTitle =
        getString(metadata.course_name) ||
        getString(metadata.courseTitle) ||
        summary.latestCourseTitle;
    }
  }

  summary.streakState = computeEmailStreakState({
    profile: input.profile,
    activities: input.activities,
    now: input.now,
  });

  for (const row of input.dailyStats) {
    summary.sessionsLast7Days += row.sessions_completed ?? 0;
    summary.minutesLast7Days += row.minutes_studied ?? row.practice_minutes ?? 0;
    summary.xpLast7Days += row.xp_earned ?? 0;
    if (typeof row.average_score === "number") {
      summary.bestScoreLast7Days =
        summary.bestScoreLast7Days == null
          ? row.average_score
          : Math.max(summary.bestScoreLast7Days, row.average_score);
    }
  }

  const computedStreak = summary.streakState.current;

  if (input.profile.total_sessions_completed === 1) {
    summary.latestAchievementKey = "first_debate";
    summary.latestAchievementLabel =
      input.profile.preferences?.preferred_locale === "en"
        ? "First debate complete"
        : "Debate đầu tiên đã xong";
  } else if ([3, 7, 14, 30, 60, 100].includes(computedStreak)) {
    summary.latestAchievementKey = `streak_${computedStreak}`;
    summary.latestAchievementLabel =
      input.profile.preferences?.preferred_locale === "en"
        ? `${computedStreak}-day streak`
        : `Streak ${computedStreak} ngày`;
  } else if (input.profile.level > 1) {
    summary.latestAchievementKey = `level_${input.profile.level}`;
    summary.latestAchievementLabel =
      input.profile.preferences?.preferred_locale === "en"
        ? `Level ${input.profile.level} reached`
        : `Đạt level ${input.profile.level}`;
  }

  if (!summary.lastActivityAt && input.profile.created_at) {
    summary.lastActivityAt = input.profile.created_at;
  }

  return summary;
}

function groupByUser<T extends { user_id: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const existing = grouped.get(row.user_id) ?? [];
    existing.push(row);
    grouped.set(row.user_id, existing);
  }
  return grouped;
}

async function hasActiveSuppression(
  supabase: SupabaseClient,
  email: string,
  category: EmailCategory
) {
  const { data, error } = await supabase
    .from("email_suppressions")
    .select("id")
    .eq("active", true)
    .ilike("email", normalizeEmail(email))
    .or(`category.is.null,category.eq.${category}`)
    .limit(1);

  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

async function insertEmailMessage(supabase: SupabaseClient, candidate: EmailCandidate) {
  const { data, error } = await supabase
    .from("email_messages")
    .insert({
      user_id: candidate.userId,
      to_email: normalizeEmail(candidate.toEmail),
      from_email: getSenderEmailAddress(),
      reply_to: getReplyToEmailAddresses(),
      template_key: candidate.templateKey,
      category: candidate.category,
      locale: candidate.locale,
      subject: candidate.subject,
      status: "queued",
      send_key: candidate.sendKey,
      variables: candidate.variables,
      tags: {
        template: candidate.templateKey,
        category: candidate.category,
        locale: candidate.locale,
      },
      metadata: candidate.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { id: null, duplicate: true };
    throw new Error(error.message);
  }

  return { id: data.id as string, duplicate: false };
}

async function updateMessage(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, unknown>
) {
  const { error } = await supabase
    .from("email_messages")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

function buildResendSendInput(input: {
  candidate: EmailCandidate;
  rendered: { subject: string; html: string; text: string };
  actualRecipient: string;
}) {
  const unsubscribeHeaders = input.candidate.variables.oneClickUnsubscribeUrl
    ? buildListUnsubscribeHeaders(
        input.candidate.variables.oneClickUnsubscribeUrl,
        getSupportEmailAddress()
      )
    : undefined;

  return {
    payload: {
      from: getSenderEmailAddress(),
      to: [input.actualRecipient],
      replyTo: getReplyToEmailAddresses(),
      subject: input.rendered.subject,
      html: input.rendered.html,
      text: input.rendered.text,
      headers: unsubscribeHeaders,
      tags: [
        { name: "template", value: input.candidate.templateKey },
        { name: "category", value: input.candidate.category },
        { name: "locale", value: input.candidate.locale },
      ],
    },
    options: { idempotencyKey: input.candidate.sendKey },
  };
}

async function sendCandidate(input: {
  supabase: SupabaseClient;
  resend: Resend | null;
  candidate: EmailCandidate;
  dryRun: boolean;
  sendingEnabled: boolean;
}) {
  const { supabase, resend, candidate } = input;

  const inserted = await insertEmailMessage(supabase, candidate);
  if (inserted.duplicate || !inserted.id) {
    return { sent: false, skipped: true, failed: false, reason: "duplicate_send_key" };
  }

  if (await hasActiveSuppression(supabase, candidate.toEmail, candidate.category)) {
    await updateMessage(supabase, inserted.id, {
      status: "suppressed",
      skip_reason: "active_suppression",
      suppressed_at: new Date().toISOString(),
    });
    return { sent: false, skipped: true, failed: false, reason: "active_suppression" };
  }

  if (!input.sendingEnabled) {
    await updateMessage(supabase, inserted.id, {
      status: "skipped",
      skip_reason: "emails_disabled",
    });
    return { sent: false, skipped: true, failed: false, reason: "emails_disabled" };
  }

  if (input.dryRun) {
    await updateMessage(supabase, inserted.id, {
      status: "skipped",
      skip_reason: "dry_run",
    });
    return { sent: false, skipped: true, failed: false, reason: "dry_run" };
  }

  if (!resend) {
    await updateMessage(supabase, inserted.id, {
      status: "failed",
      error_message: "Resend client is not configured.",
      failed_at: new Date().toISOString(),
    });
    return { sent: false, skipped: false, failed: true, reason: "missing_resend_client" };
  }

  try {
    const rendered = await renderThinkfyEmail({
      subject: candidate.subject,
      variables: candidate.variables,
    });
    const testRecipient = getEmailTestRecipient();
    const actualRecipient = testRecipient || candidate.toEmail;
    const sendInput = buildResendSendInput({ candidate, rendered, actualRecipient });
    const response = await resend.emails.send(sendInput.payload, sendInput.options);

    if (response.error) {
      throw new Error(response.error.message);
    }

    await updateMessage(supabase, inserted.id, {
      status: "sent",
      resend_email_id: response.data?.id ?? null,
      sent_at: new Date().toISOString(),
      metadata: {
        ...(candidate.metadata ?? {}),
        actualRecipient,
        intendedRecipient: candidate.toEmail,
        testMode: Boolean(testRecipient),
      },
    });

    return { sent: true, skipped: false, failed: false, reason: null };
  } catch (error) {
    await updateMessage(supabase, inserted.id, {
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown send failure",
      failed_at: new Date().toISOString(),
    });
    return {
      sent: false,
      skipped: false,
      failed: true,
      reason: error instanceof Error ? error.message : "send_failed",
    };
  }
}

/**
 * Send an explicit, already-authorized candidate batch through the same
 * suppression, idempotency, rendering, test-recipient, and tracking path used
 * by lifecycle dispatch. Campaign orchestration must call this instead of
 * inserting email_messages directly.
 */
export async function dispatchEmailCandidates(input: {
  supabase: SupabaseClient;
  candidates: EmailCandidate[];
  delayMs?: number;
}) {
  const result: EmailDispatchResult = {
    candidateUsers: new Set(input.candidates.map((candidate) => candidate.userId)).size,
    queued: input.candidates.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    dryRun: isEmailDryRun(),
    errors: [],
  };
  const sendingEnabled = isEmailSendingEnabled();
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  for (const candidate of input.candidates) {
    try {
      const sendResult = await sendCandidate({
        supabase: input.supabase,
        resend,
        candidate,
        dryRun: result.dryRun,
        sendingEnabled,
      });
      if (sendResult.sent) result.sent += 1;
      if (sendResult.skipped) result.skipped += 1;
      if (sendResult.failed) result.failed += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(error instanceof Error ? error.message : "Unknown dispatch failure");
    }

    if ((input.delayMs ?? 550) > 0) {
      await new Promise((resolve) => setTimeout(resolve, input.delayMs ?? 550));
    }
  }

  return result;
}

async function createCronRun(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("email_cron_runs")
    .insert({ job_key: "email-dispatch", status: "started" })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

async function finishCronRun(
  supabase: SupabaseClient,
  id: string,
  result: EmailDispatchResult,
  status: "success" | "error",
  errorMessage?: string
) {
  await supabase
    .from("email_cron_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      candidate_users: result.candidateUsers,
      queued_count: result.queued,
      sent_count: result.sent,
      skipped_count: result.skipped,
      failed_count: result.failed,
      error_message: errorMessage ?? null,
      metadata: {
        dryRun: result.dryRun,
        errors: result.errors.slice(0, 20),
      },
    })
    .eq("id", id);
}

export async function dispatchUserEmails(input: {
  supabase: SupabaseClient;
  now?: Date;
  limit?: number;
}) {
  const supabase = input.supabase;
  const now = input.now ?? new Date();
  const result: EmailDispatchResult = {
    candidateUsers: 0,
    queued: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    dryRun: isEmailDryRun(),
    errors: [],
  };
  const cronRunId = await createCronRun(supabase);

  try {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, email, display_name, onboarding_completed, preferences, streak_current, streak_last_active_date, total_sessions_completed, total_practice_minutes, xp, level, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 500);

    if (profileError) throw new Error(profileError.message);

    const profileRows = (profiles ?? []) as EmailProfile[];
    const profileIds = profileRows.map((profile) => profile.id);
    result.candidateUsers = profileRows.length;

    if (profileIds.length === 0) {
      await finishCronRun(supabase, cronRunId, result, "success");
      return result;
    }

    const [activityRes, statsRes, historyRes] = await Promise.all([
      supabase
        .from("activity_log")
        .select("user_id, activity_type, reference_type, metadata, xp_earned, created_at")
        .in("user_id", profileIds)
        .gte("created_at", getSince(120, now)),
      supabase
        .from("daily_stats")
        .select("user_id, date, sessions_completed, minutes_studied, practice_minutes, xp_earned, average_score")
        .in("user_id", profileIds)
        .gte("date", getSince(8, now).slice(0, 10)),
      supabase
        .from("email_messages")
        .select("user_id, template_key, send_key, status, created_at")
        .in("user_id", profileIds)
        .gte("created_at", getSince(45, now)),
    ]);

    if (activityRes.error) throw new Error(activityRes.error.message);
    if (statsRes.error) throw new Error(statsRes.error.message);
    if (historyRes.error) throw new Error(historyRes.error.message);

    const activitiesByUser = groupByUser((activityRes.data ?? []) as ActivityLogRow[]);
    const statsByUser = groupByUser((statsRes.data ?? []) as DailyStatsRow[]);
    const historyByUser = groupByUser((historyRes.data ?? []) as (EmailMessageHistory & { user_id: string })[]);
    const templateOverrides = await loadActiveEmailTemplateOverrides(supabase);
    const sendingEnabled = isEmailSendingEnabled();
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

    for (const profile of profileRows) {
      const summary = summarizeActivity({
        profile,
        activities: activitiesByUser.get(profile.id) ?? [],
        dailyStats: statsByUser.get(profile.id) ?? [],
        now,
      });
      const evaluation = evaluateEmailCandidatesForProfile({
        profile,
        summary,
        history: historyByUser.get(profile.id) ?? [],
        now,
        templateOverrides,
      });

      for (const reason of evaluation.skippedReasons) {
        if (reason === "missing_email" || reason === "email_notifications_disabled") {
          result.skipped += 1;
        }
      }

      for (const candidate of evaluation.candidates) {
        result.queued += 1;

        try {
          const sendResult = await sendCandidate({
            supabase,
            resend,
            candidate,
            dryRun: result.dryRun,
            sendingEnabled,
          });

          if (sendResult.sent) result.sent += 1;
          if (sendResult.skipped) result.skipped += 1;
          if (sendResult.failed) result.failed += 1;
        } catch (error) {
          result.failed += 1;
          result.errors.push(error instanceof Error ? error.message : "Unknown dispatch failure");
        }

        await new Promise((resolve) => setTimeout(resolve, 550));
      }
    }

    await finishCronRun(supabase, cronRunId, result, result.failed > 0 ? "error" : "success");
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email dispatch failed";
    result.errors.push(message);
    await finishCronRun(supabase, cronRunId, result, "error", message);
    throw error;
  }
}

export const __emailDispatchInternals = {
  summarizeActivity,
  normalizeEmail,
  getNumber,
  buildResendSendInput,
};
