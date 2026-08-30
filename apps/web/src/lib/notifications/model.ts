import {
  EMAIL_SENDER_STREAMS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_DIGEST_FREQUENCIES,
  NOTIFICATION_FREQUENCIES,
  NOTIFICATION_IMPORTANCES,
  NOTIFICATION_INBOX_STATES,
  type LegacyNotificationPreferences,
  type NormalizedNotificationConsent,
} from "./contracts";

export {
  notificationDeliveryJobSchema,
  notificationEventInputSchema,
  notificationInboxItemSchema,
  notificationMuteSchema,
  notificationPreferenceSchema,
  notificationUserSettingsSchema,
} from "./contracts";
export type {
  LegacyNotificationPreferences,
  NormalizedNotificationConsent,
} from "./contracts";

export const LEGACY_EMAIL_EVENT_TYPES = [
  "welcome",
  "onboarding_nudge",
  "practice_reminder",
  "streak_rescue",
  "winback",
  "weekly_progress",
  "achievement",
  "course_nudge",
  "club_invitation",
] as const;

const reminderOnlyEventTypes = new Set([
  "practice_reminder",
  "streak_rescue",
  "course_nudge",
]);
const practiceEventTypes = new Set([
  "practice_reminder",
  "winback",
  "course_nudge",
]);
const streakEventTypes = new Set(["streak_rescue"]);
const achievementEventTypes = new Set(["weekly_progress", "achievement"]);

function isEnabled(value: boolean | null | undefined, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Converts the existing profile JSON preferences into explicit rows. Missing
 * global email consent stays opted out, matching the current lifecycle email
 * eligibility rule instead of silently granting consent during migration.
 */
export function mapLegacyNotificationPreferences(
  legacy: LegacyNotificationPreferences | null | undefined,
): NormalizedNotificationConsent {
  const source = legacy ?? {};
  const globalEmailEnabled = isEnabled(source.email_notifications, false);
  const scope = source.email_opt_in_scope ?? "all";
  const practiceEnabled = isEnabled(source.practice_reminders, true);
  const streakEnabled = isEnabled(source.streak_reminders, true);
  const achievementEnabled = isEnabled(source.achievement_updates, true);

  const preferences: NormalizedNotificationConsent["preferences"] = [];
  for (const eventType of LEGACY_EMAIL_EVENT_TYPES) {
    const eventSpecificEnabled = practiceEventTypes.has(eventType)
      ? practiceEnabled
      : streakEventTypes.has(eventType)
        ? streakEnabled
        : achievementEventTypes.has(eventType)
          ? achievementEnabled
          : true;
    const scopeAllowsEmail =
      scope !== "reminders_only" || reminderOnlyEventTypes.has(eventType);

    preferences.push(
      { eventType, channel: "in_app", enabled: true, frequency: "immediate" },
      {
        eventType,
        channel: "email",
        enabled: globalEmailEnabled && scopeAllowsEmail && eventSpecificEnabled,
        frequency: "immediate",
      },
      { eventType, channel: "push", enabled: false, frequency: "immediate" },
    );
  }

  return {
    settings: {
      inAppEnabled: true,
      emailEnabled: globalEmailEnabled,
      pushEnabled: false,
      digestFrequency: "none",
      timezone: "Asia/Ho_Chi_Minh",
      quietHoursStart: null,
      quietHoursEnd: null,
    },
    preferences,
  };
}

export function buildNotificationIdempotencyKey(
  eventId: string,
  recipientId: string,
  channel: (typeof NOTIFICATION_CHANNELS)[number],
) {
  return `notification:${eventId}:${recipientId}:${channel}`;
}

/** Matches complete_notification_delivery_job's bounded exponential backoff. */
export function computeDeliveryRetryDelaySeconds(attemptCount: number) {
  const safeAttemptCount = Math.max(0, Math.min(10, Math.trunc(attemptCount)));
  return Math.min(3_600, Math.max(30, 2 ** safeAttemptCount * 30));
}

export function isDeliveryLeaseActive(
  leaseExpiresAt: string | null | undefined,
  now = new Date(),
) {
  return Boolean(
    leaseExpiresAt && new Date(leaseExpiresAt).getTime() > now.getTime(),
  );
}

export function canRetryDeliveryJob(
  status: (typeof NOTIFICATION_DELIVERY_STATUSES)[number],
  attemptCount: number,
  maxAttempts = 5,
) {
  return (
    ["pending", "failed"].includes(status) &&
    attemptCount < Math.max(1, maxAttempts)
  );
}

export const notificationContractConstants = {
  channels: NOTIFICATION_CHANNELS,
  frequencies: NOTIFICATION_FREQUENCIES,
  importances: NOTIFICATION_IMPORTANCES,
  inboxStates: NOTIFICATION_INBOX_STATES,
  deliveryStatuses: NOTIFICATION_DELIVERY_STATUSES,
  digestFrequencies: NOTIFICATION_DIGEST_FREQUENCIES,
  senderStreams: EMAIL_SENDER_STREAMS,
} as const;
