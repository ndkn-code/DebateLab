import assert from "node:assert/strict";
import { evaluateEmailCandidatesForProfile } from "@/lib/email/eligibility";
import { buildTemplateVariables, renderThinkfyEmail } from "@/lib/email/templates";
import { __emailDispatchInternals } from "@/lib/email/dispatch";
import {
  addDaysToDateKey,
  computeEmailStreakState,
} from "@/lib/email/time";
import {
  buildListUnsubscribeHeaders,
  buildUnsubscribeLinks,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from "@/lib/email/unsubscribe";
import {
  buildProviderStatusPatch,
  getResendEmailId,
  shouldApplyProviderStatus,
} from "@/lib/email/webhooks";
import type {
  EmailActivitySummary,
  EmailProfile,
  EmailStreakDot,
  EmailStreakState,
  EmailTemplateKey,
} from "@/lib/email/types";
import { EMAIL_TEMPLATE_KEYS } from "@/lib/email/types";

const TODAY_VN = "2026-05-16";

function baseProfile(overrides: Partial<EmailProfile> = {}): EmailProfile {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    email: "minh@example.com",
    display_name: "Minh",
    onboarding_completed: true,
    preferences: {
      preferred_locale: "vi",
      email_notifications: true,
      practice_reminders: true,
      streak_reminders: true,
      achievement_updates: true,
    },
    streak_current: 4,
    streak_last_active_date: "2026-05-15",
    total_sessions_completed: 2,
    total_practice_minutes: 34,
    xp: 850,
    level: 2,
    created_at: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

function baseStreak(overrides: Partial<EmailStreakState> = {}): EmailStreakState {
  const activeDates = new Set(["2026-05-13", "2026-05-14", "2026-05-15"]);
  return {
    current: 3,
    profileCurrent: 4,
    lastActiveDate: "2026-05-15",
    profileLastActiveDate: "2026-05-15",
    activeToday: false,
    atRiskToday: true,
    activeDatesLast7: Array.from(activeDates),
    dots: makeDots(TODAY_VN, activeDates),
    timezone: "Asia/Ho_Chi_Minh",
    mismatch: true,
    ...overrides,
  };
}

function baseSummary(overrides: Partial<EmailActivitySummary> = {}): EmailActivitySummary {
  return {
    lastActivityAt: "2026-05-14T03:00:00.000Z",
    lastPracticeAt: "2026-05-14T03:00:00.000Z",
    lastLessonAt: null,
    lastCourseStartedAt: null,
    sessionsLast7Days: 2,
    minutesLast7Days: 24,
    xpLast7Days: 120,
    bestScoreLast7Days: 82,
    latestCourseTitle: null,
    latestAchievementLabel: "Đạt level 2",
    latestAchievementKey: "level_2",
    streakState: baseStreak(),
    ...overrides,
  };
}

function makeDots(today: string, activeDates: Set<string>): EmailStreakDot[] {
  const labels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDaysToDateKey(today, index - 6);
    return {
      date,
      label: labels[new Date(`${date}T00:00:00.000Z`).getUTCDay()],
      active: activeDates.has(date),
      today: date === today,
    };
  });
}

function assertOutcomeCopy(templateKey: EmailTemplateKey) {
  const variables = buildTemplateVariables(templateKey, {
    userName: "Minh",
    locale: "vi",
    sessionsLast7Days: 3,
    minutesLast7Days: 42,
    xpLast7Days: 300,
    bestScoreLast7Days: 91,
    streakCurrent: 3,
    streakDots: baseStreak().dots,
    totalSessions: 9,
    level: 4,
    latestAchievementLabel: "Streak 3 ngày",
  });

  assert.notEqual(variables.subject, variables.preheader, `${templateKey} subject/preheader duplicated`);
  assert.notEqual(variables.subject, variables.headline, `${templateKey} subject/headline duplicated`);
  assert.notEqual(variables.preheader, variables.headline, `${templateKey} preheader/headline duplicated`);
  assert.ok(variables.ctaLabel.length >= 5, `${templateKey} CTA should be specific`);
  assert.doesNotMatch(variables.ctaLabel, /learn more|renew premium|click here/i);
  return variables;
}

async function testTemplateRendering() {
  for (const templateKey of EMAIL_TEMPLATE_KEYS) {
    const variables = assertOutcomeCopy(templateKey);
    const rendered = await renderThinkfyEmail({
      subject: variables.subject,
      variables,
    });

    assert.match(rendered.html, /Thinkfy/);
    assert.match(rendered.html, /https:\/\/thinkfy\.net\/coach\/coach-pet-clean\.png/);
    assert.doesNotMatch(rendered.html, /href="\/(?:practice|courses|dashboard)/);
  }

  const streak = buildTemplateVariables("streak_rescue", {
    userName: "Minh",
    locale: "vi",
    streakCurrent: 4,
    streakDots: baseStreak({ current: 4, mismatch: false }).dots,
  });
  const rendered = await renderThinkfyEmail({
    subject: streak.subject,
    variables: streak,
  });

  assert.equal(rendered.subject, "Streak còn cứu được hôm nay");
  assert.match(rendered.text, /Giữ streak/);

  const english = buildTemplateVariables("weekly_progress", {
    userName: "Minh",
    locale: "en",
    sessionsLast7Days: 3,
    minutesLast7Days: 42,
    bestScoreLast7Days: 91,
  });

  assert.match(english.headline, /weekly progress/i);
  assert.equal(english.locale, "en");
}

function testEligibility() {
  const now = new Date("2026-05-16T03:00:00.000Z");
  const evaluation = evaluateEmailCandidatesForProfile({
    profile: baseProfile(),
    summary: baseSummary(),
    history: [],
    now,
  });

  const streakCandidate = evaluation.candidates.find((candidate) => candidate.templateKey === "streak_rescue");
  assert.ok(streakCandidate);
  assert.equal(streakCandidate.toEmail, "minh@example.com");
  assert.equal(streakCandidate.variables.stat1Value, "3");
  assert.equal(streakCandidate.metadata?.streakComputedCurrent, 3);
  assert.equal(streakCandidate.metadata?.streakMismatch, true);

  const practicedToday = evaluateEmailCandidatesForProfile({
    profile: baseProfile({ streak_current: 4, streak_last_active_date: "2026-05-16" }),
    summary: baseSummary({
      lastActivityAt: "2026-05-15T23:30:00.000Z",
      lastPracticeAt: "2026-05-15T23:30:00.000Z",
      streakState: baseStreak({
        current: 4,
        lastActiveDate: "2026-05-16",
        profileLastActiveDate: "2026-05-16",
        activeToday: true,
        atRiskToday: false,
        mismatch: false,
      }),
      latestAchievementKey: null,
      latestAchievementLabel: null,
    }),
    history: [],
    now,
  });
  assert.equal(practicedToday.candidates.some((candidate) => candidate.templateKey === "streak_rescue"), false);

  const inactiveTwoDays = evaluateEmailCandidatesForProfile({
    profile: baseProfile({ streak_current: 0, streak_last_active_date: "2026-05-13" }),
    summary: baseSummary({
      lastActivityAt: "2026-05-13T03:00:00.000Z",
      lastPracticeAt: "2026-05-13T03:00:00.000Z",
      streakState: baseStreak({
        current: 0,
        lastActiveDate: "2026-05-13",
        profileCurrent: 0,
        profileLastActiveDate: "2026-05-13",
        atRiskToday: false,
        mismatch: false,
      }),
      latestAchievementKey: null,
      latestAchievementLabel: null,
    }),
    history: [],
    now,
  });
  assert.equal(inactiveTwoDays.candidates.some((candidate) => candidate.templateKey === "streak_rescue"), false);
  assert.ok(inactiveTwoDays.candidates.some((candidate) => candidate.templateKey === "winback"));

  const optedOut = evaluateEmailCandidatesForProfile({
    profile: baseProfile({ preferences: { email_notifications: false } }),
    summary: baseSummary(),
    history: [],
    now,
  });

  assert.equal(optedOut.candidates.length, 0);
  assert.deepEqual(optedOut.skippedReasons, ["email_notifications_disabled"]);

  const noPractice = evaluateEmailCandidatesForProfile({
    profile: baseProfile({
      preferences: {
        email_notifications: true,
        practice_reminders: false,
        streak_reminders: true,
        achievement_updates: true,
      },
    }),
    summary: baseSummary({
      lastActivityAt: "2026-05-13T00:00:00.000Z",
      lastPracticeAt: "2026-05-13T00:00:00.000Z",
      streakState: baseStreak({ atRiskToday: false, current: 0, profileCurrent: 0 }),
      latestAchievementKey: null,
      latestAchievementLabel: null,
    }),
    history: [],
    now,
  });

  assert.equal(noPractice.candidates.some((candidate) => candidate.templateKey === "winback"), false);
  assert.ok(noPractice.skippedReasons.includes("winback_preference_disabled"));

  const reminderOnly = evaluateEmailCandidatesForProfile({
    profile: baseProfile({
      preferences: {
        email_notifications: true,
        practice_reminders: true,
        streak_reminders: true,
        achievement_updates: true,
        email_opt_in_scope: "reminders_only",
      },
    }),
    summary: baseSummary({
      lastActivityAt: "2026-05-13T00:00:00.000Z",
      lastPracticeAt: "2026-05-13T00:00:00.000Z",
      latestAchievementKey: "level_3",
      latestAchievementLabel: "Level 3",
    }),
    history: [],
    now,
  });

  assert.ok(
    reminderOnly.candidates.every((candidate) =>
      candidate.templateKey === "practice_reminder" ||
      candidate.templateKey === "streak_rescue"
    )
  );
  assert.ok(reminderOnly.skippedReasons.includes("achievement_scope_disabled"));
  assert.ok(reminderOnly.skippedReasons.includes("winback_scope_disabled"));
}

function testVietnamStreakBoundaries() {
  const profile = baseProfile({ streak_current: 99, streak_last_active_date: "2026-05-15" });

  const beforeVietnamMidnight = computeEmailStreakState({
    profile,
    activities: [
      { activity_type: "debate_completed", reference_type: null, created_at: "2026-05-15T16:30:00.000Z" },
    ],
    now: new Date("2026-05-15T16:59:00.000Z"),
  });
  assert.equal(beforeVietnamMidnight.activeToday, true);
  assert.equal(beforeVietnamMidnight.atRiskToday, false);

  const afterVietnamMidnight = computeEmailStreakState({
    profile,
    activities: [
      { activity_type: "debate_completed", reference_type: null, created_at: "2026-05-15T16:30:00.000Z" },
    ],
    now: new Date("2026-05-15T17:05:00.000Z"),
  });
  assert.equal(afterVietnamMidnight.lastActiveDate, "2026-05-15");
  assert.equal(afterVietnamMidnight.atRiskToday, true);
  assert.equal(afterVietnamMidnight.current, 1);
  assert.equal(afterVietnamMidnight.mismatch, true);

  const duelReferenceQualifies = computeEmailStreakState({
    profile: baseProfile({ streak_current: 1, streak_last_active_date: "2026-05-16" }),
    activities: [
      { activity_type: "anything", reference_type: "debate_duel", created_at: "2026-05-16T02:00:00.000Z" },
    ],
    now: new Date("2026-05-16T03:00:00.000Z"),
  });
  assert.equal(duelReferenceQualifies.activeToday, true);
  assert.equal(duelReferenceQualifies.current, 1);
}

function testDispatchSummaryAndSendInput() {
  const summary = __emailDispatchInternals.summarizeActivity({
    profile: baseProfile({ streak_current: 10, streak_last_active_date: "2026-05-12" }),
    activities: [
      { user_id: "u1", activity_type: "debate_completed", reference_type: null, metadata: null, xp_earned: 10, created_at: "2026-05-13T03:00:00.000Z" },
      { user_id: "u1", activity_type: "duel_completed", reference_type: null, metadata: null, xp_earned: 10, created_at: "2026-05-14T03:00:00.000Z" },
      { user_id: "u1", activity_type: "lesson_completed", reference_type: null, metadata: null, xp_earned: 10, created_at: "2026-05-15T03:00:00.000Z" },
    ],
    dailyStats: [],
    now: new Date("2026-05-16T03:00:00.000Z"),
  });
  assert.equal(summary.streakState?.current, 3);
  assert.equal(summary.streakState?.mismatch, true);

  const variables = buildTemplateVariables("streak_rescue", {
    userName: "Minh",
    locale: "vi",
    streakCurrent: 3,
  });
  const links = buildUnsubscribeLinks({
    email: "minh@example.com",
    userId: "00000000-0000-0000-0000-000000000001",
    category: "streak",
    templateKey: "streak_rescue",
  });
  variables.oneClickUnsubscribeUrl = links.oneClickUnsubscribeUrl;
  const sendInput = __emailDispatchInternals.buildResendSendInput({
    actualRecipient: "ndkn.work@gmail.com",
    rendered: { subject: variables.subject, html: "<p>hi</p>", text: "hi" },
    candidate: {
      userId: "00000000-0000-0000-0000-000000000001",
      toEmail: "minh@example.com",
      templateKey: "streak_rescue",
      category: "streak",
      locale: "vi",
      sendKey: "streak_rescue:00000000-0000-0000-0000-000000000001:2026-05-16",
      subject: variables.subject,
      variables,
    },
  });

  assert.equal(sendInput.options.idempotencyKey, "streak_rescue:00000000-0000-0000-0000-000000000001:2026-05-16");
  assert.match(sendInput.payload.headers?.["List-Unsubscribe"] ?? "", /\/api\/email\/unsubscribe\?token=/);
  assert.equal(sendInput.payload.headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
}

function testUnsubscribeTokensAndHeaders() {
  const token = createUnsubscribeToken({
    email: "Minh@Example.com",
    userId: "00000000-0000-0000-0000-000000000001",
    category: "practice",
    templateKey: "practice_reminder",
  });
  const payload = verifyUnsubscribeToken(token);
  assert.equal(payload.email, "minh@example.com");
  assert.equal(payload.category, "practice");
  assert.throws(() => verifyUnsubscribeToken(`${token}tampered`));

  const headers = buildListUnsubscribeHeaders(
    "https://thinkfy.net/api/email/unsubscribe?token=abc",
    "support@thinkfy.net"
  );
  assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(headers["List-Unsubscribe"], /mailto:support@thinkfy\.net/);
}

function testWebhookStatusRules() {
  assert.equal(shouldApplyProviderStatus("clicked", "delivered"), false);
  assert.equal(shouldApplyProviderStatus("opened", "clicked"), true);

  const clicked = buildProviderStatusPatch({
    eventType: "email.clicked",
    currentStatus: "opened",
    now: new Date("2026-05-16T00:00:00.000Z"),
  });

  assert.equal(clicked.status, "clicked");
  assert.equal(clicked.patch.status, "clicked");
  assert.equal(clicked.patch.clicked_at, "2026-05-16T00:00:00.000Z");

  const delivered = buildProviderStatusPatch({
    eventType: "email.delivered",
    currentStatus: "clicked",
    now: new Date("2026-05-16T00:00:00.000Z"),
  });

  assert.equal(delivered.status, null);
  assert.equal(delivered.patch.status, undefined);

  assert.equal(
    getResendEmailId({
      type: "email.delivered",
      data: { email_id: "resend-123" },
    }),
    "resend-123"
  );
}

async function run() {
  await testTemplateRendering();
  testEligibility();
  testVietnamStreakBoundaries();
  testDispatchSummaryAndSendInput();
  testUnsubscribeTokensAndHeaders();
  testWebhookStatusRules();
  console.log("email system tests passed");
}

void run();
