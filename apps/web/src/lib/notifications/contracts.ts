import { z } from "zod";

export const NOTIFICATION_CHANNELS = ["in_app", "email", "push"] as const;
export const NOTIFICATION_FREQUENCIES = ["immediate", "digest"] as const;
export const NOTIFICATION_IMPORTANCES = [
  "low",
  "normal",
  "high",
  "critical",
] as const;
export const NOTIFICATION_INBOX_STATES = [
  "unread",
  "read",
  "archived",
] as const;
export const NOTIFICATION_DELIVERY_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "dead_letter",
] as const;
export const NOTIFICATION_DIGEST_FREQUENCIES = [
  "none",
  "daily",
  "weekly",
] as const;
export const EMAIL_MESSAGE_CLASSES = [
  "transactional",
  "operational",
  "lifecycle",
  "marketing",
] as const;
export const EMAIL_SENDER_STREAMS = ["notifications", "updates"] as const;
export const NOTIFICATION_TOPICS = [
  "account_security",
  "class_assignment",
  "class_due",
  "class_returned",
  "class_result",
  "class_announcement",
  "club_invitation",
  "onboarding",
  "practice",
  "streak",
  "course",
  "progress",
  "achievement",
  "product_updates",
] as const;

const uuid = z.string().uuid();
const nullableUuid = uuid.nullable().optional();
const nonEmptyText = (max: number) => z.string().trim().min(1).max(max);
const ianaTimeZone = nonEmptyText(100).refine((value) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}, "Invalid IANA timezone");
const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "Invalid time of day");

export const notificationEventInputSchema = z
  .object({
    eventKey: nonEmptyText(500),
    eventType: nonEmptyText(120),
    title: nonEmptyText(500),
    body: nonEmptyText(20_000),
    messageClass: z.enum(EMAIL_MESSAGE_CLASSES).default("operational"),
    topic: z.string().trim().max(120).nullable().optional(),
    recipientIds: z.array(uuid).min(1),
    payload: z.record(z.string(), z.unknown()).default({}),
    importance: z.enum(NOTIFICATION_IMPORTANCES).default("normal"),
    source: nonEmptyText(80).default("app"),
    actorId: nullableUuid,
    subjectType: z.string().trim().max(120).nullable().optional(),
    subjectId: z.string().trim().max(500).nullable().optional(),
    enqueueDeliveryJobs: z.boolean().default(true),
  })
  .strict();

export const notificationInboxItemSchema = z
  .object({
    id: uuid,
    eventId: uuid,
    recipientId: uuid,
    state: z.enum(NOTIFICATION_INBOX_STATES),
    readAt: z.string().datetime({ offset: true }).nullable(),
    archivedAt: z.string().datetime({ offset: true }).nullable().optional(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const notificationDeliveryJobSchema = z
  .object({
    id: uuid,
    inboxItemId: uuid,
    eventId: uuid,
    recipientId: uuid,
    channel: z.enum(NOTIFICATION_CHANNELS),
    status: z.enum(NOTIFICATION_DELIVERY_STATUSES),
    idempotencyKey: nonEmptyText(500),
    payload: z.record(z.string(), z.unknown()),
    attempts: z.number().int().nonnegative(),
    maxAttempts: z.number().int().positive(),
    availableAt: z.string().datetime({ offset: true }),
    lockedAt: z.string().datetime({ offset: true }).nullable().optional(),
    leaseToken: uuid.nullable().optional(),
    leaseExpiresAt: z.string().datetime({ offset: true }).nullable().optional(),
    providerMessageId: z.string().nullable().optional(),
    lastError: z.string().nullable().optional(),
    completedAt: z.string().datetime({ offset: true }).nullable().optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const notificationPreferenceSchema = z
  .object({
    id: uuid.optional(),
    userId: uuid,
    eventType: nonEmptyText(120),
    channel: z.enum(NOTIFICATION_CHANNELS),
    enabled: z.boolean(),
    frequency: z.enum(NOTIFICATION_FREQUENCIES),
    updatedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export const notificationUserSettingsSchema = z
  .object({
    userId: uuid,
    inAppEnabled: z.boolean(),
    emailEnabled: z.boolean(),
    pushEnabled: z.boolean(),
    digestFrequency: z.enum(NOTIFICATION_DIGEST_FREQUENCIES),
    timezone: ianaTimeZone,
    quietHoursStart: timeOfDay.nullable().optional(),
    quietHoursEnd: timeOfDay.nullable().optional(),
    updatedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export const notificationMuteSchema = z
  .object({
    id: uuid.optional(),
    userId: uuid,
    subjectType: nonEmptyText(120),
    subjectId: nonEmptyText(500),
    channel: z.enum(["all", ...NOTIFICATION_CHANNELS]).default("all"),
    mutedUntil: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict();

export type NotificationEventInput = z.infer<
  typeof notificationEventInputSchema
>;
export type NotificationInboxItem = z.infer<typeof notificationInboxItemSchema>;
export type NotificationDeliveryJob = z.infer<
  typeof notificationDeliveryJobSchema
>;
export type NotificationPreference = z.infer<
  typeof notificationPreferenceSchema
>;
export type NotificationUserSettings = z.infer<
  typeof notificationUserSettingsSchema
>;
export type NotificationMute = z.infer<typeof notificationMuteSchema>;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationDeliveryStatus =
  (typeof NOTIFICATION_DELIVERY_STATUSES)[number];
export type NotificationMessageClass = (typeof EMAIL_MESSAGE_CLASSES)[number];
export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number];
export type NotificationEventV1 = NotificationEventInput;
export type NotificationPreferenceV1 = NotificationPreference;
export type EmailDeliveryMode = (typeof NOTIFICATION_FREQUENCIES)[number];

export type LegacyNotificationPreferences = {
  email_notifications?: boolean | null;
  email_opt_in_scope?: "all" | "reminders_only" | null;
  practice_reminders?: boolean | null;
  streak_reminders?: boolean | null;
  achievement_updates?: boolean | null;
};

export type NormalizedNotificationConsent = {
  settings: Omit<NotificationUserSettings, "userId" | "updatedAt">;
  preferences: Array<
    Omit<NotificationPreference, "id" | "userId" | "updatedAt">
  >;
};
