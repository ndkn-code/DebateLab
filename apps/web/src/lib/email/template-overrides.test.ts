import assert from "node:assert/strict";
import { evaluateEmailCandidatesForProfile } from "@/lib/email/eligibility";
import {
  applyEmailTemplateCopyOverrides,
  buildAdminTemplateTestSendInput,
  buildDefaultTemplateVariables,
  buildEmailTemplateAdminPayload,
  buildTemplateOverrideUpsert,
  extractEmailTemplateCopy,
  normalizeEmailTemplateCopy,
  renderTemplatePreview,
  type EmailTemplateOverrideMap,
} from "@/lib/email/template-overrides";
import { EMAIL_TEMPLATE_KEYS, type EmailActivitySummary, type EmailProfile } from "@/lib/email/types";

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
    total_sessions_completed: 8,
    total_practice_minutes: 90,
    xp: 850,
    level: 3,
    created_at: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

function baseSummary(overrides: Partial<EmailActivitySummary> = {}): EmailActivitySummary {
  return {
    lastActivityAt: "2026-05-13T00:00:00.000Z",
    lastPracticeAt: "2026-05-13T00:00:00.000Z",
    lastLessonAt: null,
    lastCourseStartedAt: null,
    sessionsLast7Days: 4,
    minutesLast7Days: 72,
    xpLast7Days: 860,
    bestScoreLast7Days: 88,
    latestCourseTitle: "Phản biện như đội tuyển debate",
    latestAchievementLabel: null,
    latestAchievementKey: null,
    streakState: null,
    ...overrides,
  };
}

async function testAdminPayloadDefaults() {
  const payload = await buildEmailTemplateAdminPayload(null);
  assert.equal(payload.templates.length, EMAIL_TEMPLATE_KEYS.length);
  assert.ok(payload.scenarios.some((scenario) => scenario.key === "streak_at_risk"));

  for (const template of payload.templates) {
    for (const locale of ["vi", "en"] as const) {
      const state = template.locales[locale];
      assert.equal(state.hasOverride, false);
      assert.equal(state.version, null);
      assert.deepEqual(state.effectiveCopy, state.defaultCopy);
      assert.notEqual(state.effectiveCopy.subject, state.effectiveCopy.preheader);
      assert.notEqual(state.effectiveCopy.subject, state.effectiveCopy.headline);
    }
  }
}

function testValidationAndApplication() {
  assert.throws(
    () =>
      normalizeEmailTemplateCopy({
        subject: "",
        preheader: "Preview",
        headline: "Headline",
        body: "Body",
        cta_label: "Go",
      }),
    /Subject is required/
  );

  assert.throws(
    () =>
      normalizeEmailTemplateCopy({
        subject: "x".repeat(121),
        preheader: "Preview",
        headline: "Headline",
        body: "Body",
        cta_label: "Go",
      }),
    /Subject must be 120/
  );

  const defaults = buildDefaultTemplateVariables({
    templateKey: "streak_rescue",
    locale: "vi",
    scenarioKey: "streak_at_risk",
  });
  const overridden = applyEmailTemplateCopyOverrides(defaults, {
    subject: "Streak cháy nhẹ rồi",
    preheader: "Một bài hôm nay là đủ giữ mạch.",
    headline: "Giữ nhịp trước khi hết ngày.",
    body: "Bấm vào làm một round ngắn. Streak không tự cứu chính nó đâu.",
    cta_label: "Cứu streak",
  });

  assert.equal(overridden.subject, "Streak cháy nhẹ rồi");
  assert.equal(overridden.ctaLabel, "Cứu streak");
  assert.equal(overridden.stat1Value, "6");
  assert.match(overridden.ctaUrl, /\/practice/);

  const copy = extractEmailTemplateCopy(overridden);
  assert.equal(copy.subject, "Streak cháy nhẹ rồi");
  assert.equal(copy.stat1_label, "Streak");
}

async function testPreviewRendering() {
  const rendered = await renderTemplatePreview({
    templateKey: "welcome",
    locale: "vi",
    scenarioKey: "default",
    draftFields: {
      subject: "Bài đầu tiên đang đợi",
      preheader: "Một bước nhỏ hôm nay.",
      headline: "Mở màn bằng một round gọn.",
      body: "Thinkfy sẽ đọc phần bạn còn vướng và biến nó thành bước luyện tiếp theo.",
      cta_label: "Luyện bài đầu",
      badge_label: "Ngày 1",
      stat1_label: "Mục tiêu",
      stat2_label: "Chế độ",
      stat3_label: "",
    },
  });

  assert.equal(rendered.subject, "Bài đầu tiên đang đợi");
  assert.match(rendered.html, /Mở màn bằng một round gọn/);
  assert.match(rendered.text, /Luyện bài đầu/);
  assert.match(rendered.html, /https:\/\/thinkfy\.net\/coach\/coach-pet-clean\.png/);
}

function testVersioningAndSendPayload() {
  const upsert = buildTemplateOverrideUpsert({
    templateKey: "welcome",
    locale: "vi",
    fields: {
      subject: "Subject",
      preheader: "Preheader",
      headline: "Headline",
      body: "Body",
      cta_label: "CTA",
      badge_label: "",
      stat1_label: "Goal",
      stat2_label: "Mode",
      stat3_label: "",
    },
    existing: { version: 3 },
    actorId: "00000000-0000-0000-0000-000000000001",
  });
  assert.equal(upsert.version, 4);
  assert.equal(upsert.is_active, true);

  const sendInput = buildAdminTemplateTestSendInput({
    to: "ndkn.work@gmail.com",
    templateKey: "welcome",
    locale: "vi",
    rendered: { subject: "Subject", html: "<p>Hello</p>", text: "Hello" },
  });
  assert.equal(sendInput.payload.to[0], "ndkn.work@gmail.com");
  assert.equal(sendInput.payload.subject, "[Thinkfy QA] Subject");
  assert.match(sendInput.options.idempotencyKey, /^admin-template-test:welcome:vi:/);
}

function testCandidateUsesOverrides() {
  const overrides: EmailTemplateOverrideMap = {
    vi: {
      winback: {
        id: "override_1",
        template_key: "winback",
        locale: "vi",
        fields: {
          subject: "Không phải tạm biệt đâu nhé",
          preheader: "Bài luyện vẫn còn nguyên.",
          headline: "Quay lại bằng một round nhỏ.",
          body: "Năm phút là đủ để mở lại guồng luyện.",
          cta_label: "Quay lại luyện",
        },
        version: 5,
        is_active: true,
        updated_by: null,
        created_at: "2026-05-16T00:00:00.000Z",
        updated_at: "2026-05-16T00:00:00.000Z",
      },
    },
  };
  const evaluation = evaluateEmailCandidatesForProfile({
    profile: baseProfile(),
    summary: baseSummary(),
    history: [],
    now: new Date("2026-05-16T03:00:00.000Z"),
    templateOverrides: overrides,
  });
  const winback = evaluation.candidates.find((candidate) => candidate.templateKey === "winback");
  assert.ok(winback);
  assert.equal(winback.subject, "Không phải tạm biệt đâu nhé");
  assert.equal(winback.variables.headline, "Quay lại bằng một round nhỏ.");
  assert.equal(winback.metadata?.templateOverrideVersion, 5);
  assert.equal(winback.metadata?.templateCopyOverridden, true);
}

async function run() {
  await testAdminPayloadDefaults();
  testValidationAndApplication();
  await testPreviewRendering();
  testVersioningAndSendPayload();
  testCandidateUsesOverrides();
  console.log("email template override tests passed");
}

void run();
