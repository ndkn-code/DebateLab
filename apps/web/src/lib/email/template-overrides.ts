import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  getReplyToEmailAddresses,
  getSenderEmailAddress,
} from "@/lib/email/config";
import {
  EMAIL_TEMPLATE_META,
  buildTemplateVariables,
  renderThinkfyEmail,
  type TemplateContext,
} from "@/lib/email/templates";
import { addDaysToDateKey } from "@/lib/email/time";
import {
  EMAIL_TEMPLATE_KEYS,
  type EmailLocale,
  type EmailStreakDot,
  type EmailTemplateKey,
  type EmailTemplateVariables,
  type RenderedEmail,
} from "@/lib/email/types";

export const EMAIL_TEMPLATE_COPY_FIELD_CONFIG = [
  { key: "subject", label: "Subject", maxLength: 120, required: true },
  { key: "preheader", label: "Preheader", maxLength: 160, required: true },
  { key: "headline", label: "Headline", maxLength: 140, required: true },
  { key: "body", label: "Body", maxLength: 520, required: true },
  { key: "cta_label", label: "CTA label", maxLength: 48, required: true },
  { key: "badge_label", label: "Badge", maxLength: 40, required: false },
  { key: "stat1_label", label: "Stat 1 label", maxLength: 32, required: false },
  { key: "stat2_label", label: "Stat 2 label", maxLength: 32, required: false },
  { key: "stat3_label", label: "Stat 3 label", maxLength: 32, required: false },
] as const;

export type EmailTemplateCopyField = (typeof EMAIL_TEMPLATE_COPY_FIELD_CONFIG)[number]["key"];
export type EmailTemplateCopy = Partial<Record<EmailTemplateCopyField, string>>;

export interface EmailTemplateOverrideRow {
  id: string;
  template_key: EmailTemplateKey;
  locale: EmailLocale;
  fields: EmailTemplateCopy;
  version: number;
  is_active: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateAuditRow {
  id: string;
  template_key: EmailTemplateKey;
  locale: EmailLocale;
  action: "save" | "reset";
  fields: EmailTemplateCopy;
  previous_fields: EmailTemplateCopy | null;
  version: number;
  actor_id: string | null;
  created_at: string;
}

export interface EmailTemplateLocaleAdminState {
  defaultCopy: Required<EmailTemplateCopy>;
  overrideCopy: EmailTemplateCopy | null;
  effectiveCopy: Required<EmailTemplateCopy>;
  hasOverride: boolean;
  version: number | null;
  updatedAt: string | null;
  updatedBy: string | null;
  audit: EmailTemplateAuditRow[];
}

export interface EmailTemplateAdminItem {
  templateKey: EmailTemplateKey;
  category: string;
  preference: string;
  locales: Record<EmailLocale, EmailTemplateLocaleAdminState>;
}

export interface EmailTemplateAdminPayload {
  templates: EmailTemplateAdminItem[];
  scenarios: Array<{ key: string; label: string }>;
  fields: typeof EMAIL_TEMPLATE_COPY_FIELD_CONFIG;
}

export interface EmailTemplateOverrideMeta {
  id: string;
  version: number;
  updatedAt: string;
}

export type EmailTemplateOverrideMap = Partial<
  Record<EmailLocale, Partial<Record<EmailTemplateKey, EmailTemplateOverrideRow>>>
>;

const devOverrideStore = new Map<string, EmailTemplateOverrideRow>();
const devAuditStore: EmailTemplateAuditRow[] = [];

export const EMAIL_PREVIEW_SCENARIOS = [
  { key: "default", label: "User mới - Default" },
  { key: "onboarding", label: "Onboarding dang dở" },
  { key: "active_streak", label: "Active streak" },
  { key: "streak_at_risk", label: "Streak at risk" },
  { key: "zero_streak", label: "Zero streak" },
  { key: "streak_mismatch", label: "Profile streak mismatch" },
  { key: "weekly_progress", label: "Weekly progress" },
  { key: "achievement", label: "Achievement" },
  { key: "course_nudge", label: "Course nudge" },
  { key: "club_invitation", label: "Club invitation" },
] as const;

const FIELD_TO_VARIABLE: Record<EmailTemplateCopyField, keyof EmailTemplateVariables | "subject"> = {
  subject: "subject",
  preheader: "preheader",
  headline: "headline",
  body: "body",
  cta_label: "ctaLabel",
  badge_label: "badgeLabel",
  stat1_label: "stat1Label",
  stat2_label: "stat2Label",
  stat3_label: "stat3Label",
};

function isTemplateKey(value: unknown): value is EmailTemplateKey {
  return typeof value === "string" && EMAIL_TEMPLATE_KEYS.includes(value as EmailTemplateKey);
}

export function resolveEmailTemplateKey(value: unknown): EmailTemplateKey {
  if (isTemplateKey(value)) return value;
  throw new Error("Invalid email template key.");
}

export function resolveEmailLocale(value: unknown): EmailLocale {
  return value === "en" ? "en" : "vi";
}

function sanitizeCopyValue(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
}

export function normalizeEmailTemplateCopy(
  input: unknown,
  options: { requireRequiredFields?: boolean } = {}
): EmailTemplateCopy {
  const requireRequiredFields = options.requireRequiredFields ?? true;
  const source =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const normalized: EmailTemplateCopy = {};
  const errors: string[] = [];

  for (const field of EMAIL_TEMPLATE_COPY_FIELD_CONFIG) {
    const raw = source[field.key];
    if (raw === undefined && !requireRequiredFields) continue;
    const value = typeof raw === "string" ? sanitizeCopyValue(raw) : "";
    if (field.required && requireRequiredFields && !value) {
      errors.push(`${field.label} is required.`);
      continue;
    }
    if (value.length > field.maxLength) {
      errors.push(`${field.label} must be ${field.maxLength} characters or fewer.`);
      continue;
    }
    normalized[field.key] = value;
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  return normalized;
}

export function extractEmailTemplateCopy(
  variables: EmailTemplateVariables & { subject: string }
): Required<EmailTemplateCopy> {
  return {
    subject: variables.subject,
    preheader: variables.preheader,
    headline: variables.headline,
    body: variables.body,
    cta_label: variables.ctaLabel,
    badge_label: variables.badgeLabel ?? "",
    stat1_label: variables.stat1Label ?? "",
    stat2_label: variables.stat2Label ?? "",
    stat3_label: variables.stat3Label ?? "",
  };
}

export function applyEmailTemplateCopyOverrides<T extends EmailTemplateVariables & { subject: string }>(
  variables: T,
  fields?: EmailTemplateCopy | null
): T {
  if (!fields) return variables;
  const output = { ...variables } as T;

  for (const field of EMAIL_TEMPLATE_COPY_FIELD_CONFIG) {
    const value = fields[field.key];
    if (typeof value !== "string") continue;
    const variableKey = FIELD_TO_VARIABLE[field.key];
    (output as unknown as Record<string, string>)[variableKey] = value;
  }

  return output;
}

export function getOverrideForTemplate(
  overrides: EmailTemplateOverrideMap | undefined,
  locale: EmailLocale,
  templateKey: EmailTemplateKey
) {
  return overrides?.[locale]?.[templateKey] ?? null;
}

function makeDots(today: string, activeOffsets: number[]) {
  const activeDates = new Set(activeOffsets.map((offset) => addDaysToDateKey(today, offset)));
  const labels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  return Array.from({ length: 7 }, (_, index): EmailStreakDot => {
    const date = addDaysToDateKey(today, index - 6);
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    return {
      date,
      label: labels[weekday],
      active: activeDates.has(date),
      today: date === today,
    };
  });
}

export function buildEmailPreviewContext(
  templateKey: EmailTemplateKey,
  locale: EmailLocale,
  scenarioKey = "default"
): TemplateContext {
  const base: TemplateContext = {
    locale,
    userName: locale === "en" ? "Minh" : "Minh",
    sessionsLast7Days: 4,
    minutesLast7Days: 72,
    xpLast7Days: 860,
    bestScoreLast7Days: 88,
    streakCurrent: 6,
    streakDots: makeDots("2026-05-16", [-6, -5, -4, -3, -2, -1]),
    level: 7,
    totalSessions: 28,
    latestCourseTitle:
      locale === "en" ? "Team debate rebuttal basics" : "Phản biện như đội tuyển debate",
    latestAchievementLabel:
      locale === "en" ? "7-day streak is almost in reach." : "Streak 7 ngày sắp vào tầm ngắm.",
    ctaUrl: "https://thinkfy.net/join/club/demo-token",
    clubName: locale === "en" ? "Hanoi Debate Club" : "Hanoi Debate Club",
    clubRole: locale === "en" ? "club admin" : "quản trị viên CLB",
    inviterName: "Coach Linh",
    city: "Ha Noi",
  };

  if (scenarioKey === "onboarding") {
    return { ...base, sessionsLast7Days: 0, minutesLast7Days: 0, xpLast7Days: 0 };
  }

  if (scenarioKey === "active_streak") {
    return { ...base, streakCurrent: 6, streakDots: makeDots("2026-05-16", [-5, -4, -3, -2, -1, 0]) };
  }

  if (scenarioKey === "streak_at_risk") {
    return { ...base, streakCurrent: 6, streakDots: makeDots("2026-05-16", [-6, -5, -4, -3, -2, -1]) };
  }

  if (scenarioKey === "zero_streak") {
    return { ...base, streakCurrent: 0, streakDots: makeDots("2026-05-16", []) };
  }

  if (scenarioKey === "streak_mismatch") {
    return { ...base, streakCurrent: 3, streakDots: makeDots("2026-05-16", [-3, -2, -1]) };
  }

  if (scenarioKey === "weekly_progress") {
    return { ...base, sessionsLast7Days: 7, minutesLast7Days: 148, xpLast7Days: 1540, bestScoreLast7Days: 93 };
  }

  if (scenarioKey === "achievement") {
    return {
      ...base,
      level: 8,
      totalSessions: 42,
      latestAchievementLabel: locale === "en" ? "Level 8 reached" : "Đạt level 8",
    };
  }

  if (scenarioKey === "course_nudge") {
    return {
      ...base,
      latestCourseTitle: locale === "en" ? "Cross-examination fundamentals" : "Nền tảng cross-examination",
    };
  }

  if (scenarioKey === "club_invitation" || templateKey === "club_invitation") {
    return {
      ...base,
      sessionsLast7Days: 0,
      minutesLast7Days: 0,
      xpLast7Days: 0,
    };
  }

  if (templateKey === "welcome" || templateKey === "onboarding_nudge") {
    return { ...base, sessionsLast7Days: 0, minutesLast7Days: 0, xpLast7Days: 0 };
  }

  return base;
}

export function buildDefaultTemplateVariables(input: {
  templateKey: EmailTemplateKey;
  locale: EmailLocale;
  scenarioKey?: string;
}) {
  return buildTemplateVariables(
    input.templateKey,
    buildEmailPreviewContext(input.templateKey, input.locale, input.scenarioKey)
  );
}

export async function renderTemplatePreview(input: {
  templateKey: EmailTemplateKey;
  locale: EmailLocale;
  scenarioKey?: string;
  activeOverride?: EmailTemplateCopy | null;
  draftFields?: EmailTemplateCopy | null;
}): Promise<RenderedEmail & { effectiveCopy: Required<EmailTemplateCopy> }> {
  const variables = applyEmailTemplateCopyOverrides(
    applyEmailTemplateCopyOverrides(
      buildDefaultTemplateVariables(input),
      input.activeOverride
    ),
    input.draftFields
  );
  const rendered = await renderThinkfyEmail({
    subject: variables.subject,
    variables,
  });

  return {
    ...rendered,
    effectiveCopy: extractEmailTemplateCopy(variables),
  };
}

function isOverrideRow(row: unknown): row is EmailTemplateOverrideRow {
  const item = row as Partial<EmailTemplateOverrideRow>;
  return isTemplateKey(item.template_key) && (item.locale === "vi" || item.locale === "en");
}

export async function loadActiveEmailTemplateOverrides(
  supabase: SupabaseClient
): Promise<EmailTemplateOverrideMap> {
  const { data, error } = await supabase
    .from("email_template_overrides")
    .select("id, template_key, locale, fields, version, is_active, updated_by, created_at, updated_at")
    .eq("is_active", true);

  if (error) {
    if (["42P01", "PGRST205"].includes(error.code ?? "")) return {};
    throw new Error(error.message);
  }

  const map: EmailTemplateOverrideMap = { vi: {}, en: {} };
  for (const row of data ?? []) {
    if (!isOverrideRow(row)) continue;
    const fields = normalizeEmailTemplateCopy(row.fields, { requireRequiredFields: false });
    map[row.locale] = map[row.locale] ?? {};
    map[row.locale]![row.template_key] = { ...row, fields };
  }

  return map;
}

async function loadTemplateAudits(
  supabase: SupabaseClient
): Promise<EmailTemplateAuditRow[]> {
  const { data, error } = await supabase
    .from("email_template_override_events")
    .select("id, template_key, locale, action, fields, previous_fields, version, actor_id, created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    if (["42P01", "PGRST205"].includes(error.code ?? "")) return [];
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((row): row is EmailTemplateAuditRow => {
      const item = row as Partial<EmailTemplateAuditRow>;
      return isTemplateKey(item.template_key) && (item.locale === "vi" || item.locale === "en");
    })
    .map((row) => ({
      ...row,
      fields: normalizeEmailTemplateCopy(row.fields, { requireRequiredFields: false }),
      previous_fields: row.previous_fields
        ? normalizeEmailTemplateCopy(row.previous_fields, { requireRequiredFields: false })
        : null,
    }));
}

export async function buildEmailTemplateAdminPayload(
  supabase?: SupabaseClient | null
): Promise<EmailTemplateAdminPayload> {
  const [overrides, audits] = supabase
    ? await Promise.all([loadActiveEmailTemplateOverrides(supabase), loadTemplateAudits(supabase)])
    : [{}, [] as EmailTemplateAuditRow[]];

  return buildEmailTemplateAdminPayloadFromState(overrides, audits);
}

export function buildEmailTemplateAdminPayloadFromState(
  overrides: EmailTemplateOverrideMap,
  audits: EmailTemplateAuditRow[]
): EmailTemplateAdminPayload {
  return {
    fields: EMAIL_TEMPLATE_COPY_FIELD_CONFIG,
    scenarios: [...EMAIL_PREVIEW_SCENARIOS],
    templates: EMAIL_TEMPLATE_KEYS.map((templateKey) => {
      const locales = (["vi", "en"] as EmailLocale[]).reduce(
        (accumulator, locale) => {
          const defaultCopy = extractEmailTemplateCopy(
            buildDefaultTemplateVariables({ templateKey, locale })
          );
          const override = getOverrideForTemplate(overrides, locale, templateKey);
          const effectiveCopy = normalizeEmailTemplateCopy(
            { ...defaultCopy, ...(override?.fields ?? {}) },
            { requireRequiredFields: true }
          ) as Required<EmailTemplateCopy>;
          accumulator[locale] = {
            defaultCopy,
            overrideCopy: override?.fields ?? null,
            effectiveCopy,
            hasOverride: Boolean(override),
            version: override?.version ?? null,
            updatedAt: override?.updated_at ?? null,
            updatedBy: override?.updated_by ?? null,
            audit: audits.filter((event) => event.template_key === templateKey && event.locale === locale).slice(0, 6),
          };
          return accumulator;
        },
        {} as Record<EmailLocale, EmailTemplateLocaleAdminState>
      );

      return {
        templateKey,
        category: EMAIL_TEMPLATE_META[templateKey].category,
        preference: EMAIL_TEMPLATE_META[templateKey].preference,
        locales,
      };
    }),
  };
}

export function loadDevEmailTemplateOverrides(): EmailTemplateOverrideMap {
  const map: EmailTemplateOverrideMap = { vi: {}, en: {} };
  for (const override of devOverrideStore.values()) {
    if (!override.is_active) continue;
    map[override.locale] = map[override.locale] ?? {};
    map[override.locale]![override.template_key] = override;
  }
  return map;
}

export function buildDevEmailTemplateAdminPayload() {
  return buildEmailTemplateAdminPayloadFromState(loadDevEmailTemplateOverrides(), devAuditStore);
}

function devStoreKey(templateKey: EmailTemplateKey, locale: EmailLocale) {
  return `${templateKey}:${locale}`;
}

export function saveDevEmailTemplateOverride(input: {
  templateKey: EmailTemplateKey;
  locale: EmailLocale;
  fields: EmailTemplateCopy;
  actorId: string | null;
}) {
  const key = devStoreKey(input.templateKey, input.locale);
  const existing = devOverrideStore.get(key) ?? null;
  const upsert = buildTemplateOverrideUpsert({
    templateKey: input.templateKey,
    locale: input.locale,
    fields: input.fields,
    existing,
    actorId: input.actorId,
  });
  const now = new Date().toISOString();
  const row: EmailTemplateOverrideRow = {
    id: existing?.id ?? `dev-${key}`,
    template_key: input.templateKey,
    locale: input.locale,
    fields: upsert.fields,
    version: upsert.version,
    is_active: true,
    updated_by: input.actorId,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  devOverrideStore.set(key, row);
  devAuditStore.unshift({
    id: `dev-event-${Date.now()}`,
    template_key: input.templateKey,
    locale: input.locale,
    action: "save",
    fields: row.fields,
    previous_fields: existing?.fields ?? null,
    version: row.version,
    actor_id: input.actorId,
    created_at: now,
  });
  return row;
}

export function resetDevEmailTemplateOverride(input: {
  templateKey: EmailTemplateKey;
  locale: EmailLocale;
  actorId: string | null;
}) {
  const key = devStoreKey(input.templateKey, input.locale);
  const existing = devOverrideStore.get(key) ?? null;
  if (!existing) return null;
  const now = new Date().toISOString();
  const nextVersion = existing.version + 1;
  devOverrideStore.delete(key);
  devAuditStore.unshift({
    id: `dev-event-${Date.now()}`,
    template_key: input.templateKey,
    locale: input.locale,
    action: "reset",
    fields: {},
    previous_fields: existing.fields,
    version: nextVersion,
    actor_id: input.actorId,
    created_at: now,
  });
  return { id: existing.id, version: nextVersion };
}

export function buildTemplateOverrideUpsert(input: {
  templateKey: EmailTemplateKey;
  locale: EmailLocale;
  fields: EmailTemplateCopy;
  existing?: Pick<EmailTemplateOverrideRow, "version"> | null;
  actorId: string | null;
}) {
  const now = new Date().toISOString();
  return {
    template_key: input.templateKey,
    locale: input.locale,
    fields: normalizeEmailTemplateCopy(input.fields, { requireRequiredFields: true }) as Required<EmailTemplateCopy>,
    version: (input.existing?.version ?? 0) + 1,
    is_active: true,
    updated_by: input.actorId,
    updated_at: now,
  };
}

export async function saveEmailTemplateOverride(input: {
  supabase: SupabaseClient;
  templateKey: EmailTemplateKey;
  locale: EmailLocale;
  fields: EmailTemplateCopy;
  actorId: string | null;
}) {
  const { data: existingRows, error: existingError } = await input.supabase
    .from("email_template_overrides")
    .select("id, fields, version")
    .eq("template_key", input.templateKey)
    .eq("locale", input.locale)
    .limit(1);

  if (existingError && !["PGRST116"].includes(existingError.code ?? "")) {
    throw new Error(existingError.message);
  }

  const existing = (existingRows?.[0] ?? null) as
    | { id: string; fields: EmailTemplateCopy; version: number }
    | null;
  const upsert = buildTemplateOverrideUpsert({
    templateKey: input.templateKey,
    locale: input.locale,
    fields: input.fields,
    existing,
    actorId: input.actorId,
  });

  const { data, error } = await input.supabase
    .from("email_template_overrides")
    .upsert(upsert, { onConflict: "template_key,locale" })
    .select("id, template_key, locale, fields, version, is_active, updated_by, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);

  const { error: eventError } = await input.supabase
    .from("email_template_override_events")
    .insert({
      template_override_id: data.id,
      template_key: input.templateKey,
      locale: input.locale,
      action: "save",
      fields: upsert.fields,
      previous_fields: existing?.fields ?? null,
      version: upsert.version,
      actor_id: input.actorId,
    });

  if (eventError) throw new Error(eventError.message);

  return data as EmailTemplateOverrideRow;
}

export async function resetEmailTemplateOverride(input: {
  supabase: SupabaseClient;
  templateKey: EmailTemplateKey;
  locale: EmailLocale;
  actorId: string | null;
}) {
  const { data: existingRows, error: existingError } = await input.supabase
    .from("email_template_overrides")
    .select("id, fields, version")
    .eq("template_key", input.templateKey)
    .eq("locale", input.locale)
    .limit(1);

  if (existingError) throw new Error(existingError.message);
  const existing = (existingRows?.[0] ?? null) as
    | { id: string; fields: EmailTemplateCopy; version: number }
    | null;

  if (!existing) return null;

  const nextVersion = existing.version + 1;
  const { error: updateError } = await input.supabase
    .from("email_template_overrides")
    .update({
      is_active: false,
      version: nextVersion,
      updated_by: input.actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (updateError) throw new Error(updateError.message);

  const { error: eventError } = await input.supabase
    .from("email_template_override_events")
    .insert({
      template_override_id: existing.id,
      template_key: input.templateKey,
      locale: input.locale,
      action: "reset",
      fields: {},
      previous_fields: existing.fields,
      version: nextVersion,
      actor_id: input.actorId,
    });

  if (eventError) throw new Error(eventError.message);
  return { id: existing.id, version: nextVersion };
}

export function buildAdminTemplateTestSendInput(input: {
  to: string;
  templateKey: EmailTemplateKey;
  locale: EmailLocale;
  rendered: RenderedEmail;
}) {
  return {
    payload: {
      from: getSenderEmailAddress(),
      to: [input.to],
      replyTo: getReplyToEmailAddresses(),
      subject: `[Thinkfy QA] ${input.rendered.subject}`,
      html: input.rendered.html,
      text: input.rendered.text,
      tags: [
        { name: "template", value: input.templateKey },
        { name: "category", value: "admin_template_test" },
        { name: "locale", value: input.locale },
      ],
    },
    options: {
      idempotencyKey: `admin-template-test:${input.templateKey}:${input.locale}:${crypto.randomUUID()}`,
    },
  };
}

export async function sendAdminTemplateTestEmail(input: {
  to: string;
  templateKey: EmailTemplateKey;
  locale: EmailLocale;
  rendered: RenderedEmail;
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const sendInput = buildAdminTemplateTestSendInput(input);
  const response = await resend.emails.send(sendInput.payload, sendInput.options);
  if (response.error) throw new Error(response.error.message);
  return response.data;
}
