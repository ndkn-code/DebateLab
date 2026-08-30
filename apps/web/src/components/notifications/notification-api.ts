import {
  DEFAULT_EVENT_TYPES,
  buildDefaultNotificationPreferences,
  type NotificationCadence,
  type NotificationInboxEvent,
  type NotificationInboxSnapshot,
  type NotificationPreferenceView,
  type NotificationTopic,
  type NotificationUiOperations,
} from "./contracts";

type ApiEvent = {
  id?: unknown;
  event_type?: unknown;
  title?: unknown;
  body?: unknown;
  subject_type?: unknown;
  subject_id?: unknown;
  payload?: unknown;
  created_at?: unknown;
};

type ApiInboxItem = {
  id?: unknown;
  event_id?: unknown;
  state?: unknown;
  read_at?: unknown;
  created_at?: unknown;
  notification_events?: ApiEvent | ApiEvent[] | null;
};

type ApiPreference = {
  event_type?: unknown;
  channel?: unknown;
  enabled?: unknown;
  frequency?: unknown;
};

type ApiSettings = {
  email_enabled?: unknown;
  digest_frequency?: unknown;
  timezone?: unknown;
  quiet_hours_start?: unknown;
  quiet_hours_end?: unknown;
};

type ApiMute = {
  subject_type?: unknown;
  subject_id?: unknown;
  channel?: unknown;
  muted_until?: unknown;
};

type ApiPayload = {
  items?: ApiInboxItem[];
  unreadCount?: number;
  nextCursor?: string | null;
  settings?: ApiSettings;
  preferences?: ApiPreference[];
  mutes?: ApiMute[];
  error?: string;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function topicFor(eventType: string): NotificationTopic {
  const value = eventType.toLowerCase();
  const exact = Object.entries(DEFAULT_EVENT_TYPES).find(([, eventTypes]) =>
    eventTypes.includes(value),
  )?.[0] as NotificationTopic | undefined;
  if (exact) return exact;
  if (
    value.includes("security") ||
    value.includes("account") ||
    value.includes("billing")
  )
    return "account_security";
  if (value.includes("assignment") || value.includes("homework"))
    return "assignments";
  if (
    value.includes("teacher") ||
    value.includes("review") ||
    value.includes("feedback")
  )
    return "teacher_feedback";
  if (
    value.includes("class") ||
    value.includes("club") ||
    value.includes("schedule")
  )
    return "class_updates";
  if (value.includes("streak")) return "streak";
  if (value.includes("achievement") || value.includes("level"))
    return "achievements";
  if (value.includes("product") || value.includes("release"))
    return "product_updates";
  return "practice";
}

function safeDeepLink(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return null;
  const candidate = ["deepLink", "deep_link", "href", "path", "url"]
    .map((key) => (payload as Record<string, unknown>)[key])
    .find((value) => typeof value === "string");
  return typeof candidate === "string" &&
    candidate.startsWith("/") &&
    !candidate.startsWith("//")
    ? candidate
    : null;
}

function mapInboxItem(item: ApiInboxItem): NotificationInboxEvent | null {
  const nested = Array.isArray(item.notification_events)
    ? item.notification_events[0]
    : item.notification_events;
  if (!nested) return null;
  const id = asString(item.id);
  const eventId = asString(item.event_id, asString(nested.id));
  const eventType = asString(nested.event_type, "practice.reminder");
  if (!id || !eventId) return null;
  return {
    id,
    eventId,
    eventType,
    topic: topicFor(eventType),
    title: asString(nested.title),
    body: asString(nested.body),
    createdAt: asString(
      item.created_at,
      asString(nested.created_at, new Date(0).toISOString()),
    ),
    readAt:
      item.state === "read" && typeof item.read_at === "string"
        ? item.read_at
        : null,
    deepLink: safeDeepLink(nested.payload),
    objectType: asString(nested.subject_type) || null,
    objectId: asString(nested.subject_id) || null,
  };
}

async function request(body?: Record<string, unknown>, query = "") {
  const response = await fetch(`/api/notifications${query}`, {
    method: body ? "PATCH" : "GET",
    cache: "no-store",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok)
    throw new Error(payload.error || "Unable to update notifications.");
  return payload;
}

function cadenceFor(
  preference: ApiPreference | undefined,
  settings: ApiSettings,
): NotificationCadence {
  if (!preference || preference.enabled !== true) return "off";
  if (preference.frequency !== "digest") return "immediate";
  return settings.digest_frequency === "weekly" ? "weekly" : "daily";
}

function mapPreferences(payload: ApiPayload): NotificationPreferenceView[] {
  const settings = payload.settings ?? {};
  const timezone = asString(settings.timezone, "Asia/Ho_Chi_Minh");
  return buildDefaultNotificationPreferences(timezone).map((row) => {
    const related = (payload.preferences ?? []).filter(
      (item) =>
        typeof item.event_type === "string" &&
        topicFor(item.event_type) === row.topic,
    );
    const inApp = related.find(
      (item) => item.channel === "in_app" && item.enabled === true,
    );
    const email = related.find(
      (item) => item.channel === "email" && item.enabled === true,
    );
    const eventTypes = Array.from(
      new Set(
        related.flatMap((item) =>
          typeof item.event_type === "string" ? [item.event_type] : [],
        ),
      ),
    );
    return {
      ...row,
      eventTypes: eventTypes.length > 0 ? eventTypes : row.eventTypes,
      channels: {
        in_app:
          row.messageClass === "essential" ||
          related.length === 0 ||
          Boolean(inApp),
        email:
          row.messageClass === "essential" ||
          (settings.email_enabled === true && email?.enabled === true),
      },
      emailDeliveryMode:
        row.messageClass === "essential"
          ? "immediate"
          : cadenceFor(email, settings),
      quietHours: {
        enabled: Boolean(
          settings.quiet_hours_start && settings.quiet_hours_end,
        ),
        start: asString(settings.quiet_hours_start, "22:00"),
        end: asString(settings.quiet_hours_end, "07:00"),
      },
    };
  });
}

export const notificationApiOperations: NotificationUiOperations = {
  async listInbox(input) {
    const params = new URLSearchParams({ limit: "50" });
    if (input?.cursor) params.set("cursor", input.cursor);
    const payload = await request(undefined, `?${params.toString()}`);
    const activeMutes = (payload.mutes ?? []).filter((mute) => {
      if (mute.channel !== "all" && mute.channel !== "in_app") return false;
      return (
        typeof mute.muted_until !== "string" ||
        new Date(mute.muted_until).getTime() > Date.now()
      );
    });
    return {
      events: (payload.items ?? []).flatMap((item) => {
        const mapped = mapInboxItem(item);
        if (!mapped) return [];
        return [
          {
            ...mapped,
            muted: activeMutes.some(
              (mute) =>
                mute.subject_type === mapped.objectType &&
                mute.subject_id === mapped.objectId,
            ),
          },
        ];
      }),
      unreadCount:
        typeof payload.unreadCount === "number" ? payload.unreadCount : 0,
      nextCursor: payload.nextCursor ?? null,
    } satisfies NotificationInboxSnapshot;
  },
  async getPreferences() {
    return mapPreferences(await request());
  },
  async updatePreferences(preferences) {
    const shared = preferences[0];
    const digest = preferences.find((item) =>
      ["daily", "weekly"].includes(item.emailDeliveryMode),
    );
    await request({
      action: "settings",
      settings: {
        inAppEnabled: preferences.some((item) => item.channels.in_app),
        emailEnabled: preferences.some(
          (item) => item.messageClass === "optional" && item.channels.email,
        ),
        pushEnabled: false,
        digestFrequency: digest?.emailDeliveryMode ?? "none",
        timezone: shared?.timezone ?? "Asia/Ho_Chi_Minh",
        quietHoursStart: shared?.quietHours.enabled
          ? shared.quietHours.start
          : null,
        quietHoursEnd: shared?.quietHours.enabled
          ? shared.quietHours.end
          : null,
      },
    });
    await Promise.all(
      preferences.flatMap((item) =>
        item.eventTypes.flatMap((eventType) =>
          (["in_app", "email"] as const).map((channel) =>
            request({
              action: "preference",
              preference: {
                eventType,
                channel,
                enabled:
                  item.messageClass === "essential" || item.channels[channel],
                frequency:
                  channel === "email" &&
                  ["daily", "weekly"].includes(item.emailDeliveryMode)
                    ? "digest"
                    : "immediate",
              },
            }),
          ),
        ),
      ),
    );
    return mapPreferences(await request());
  },
  async markRead(notificationId) {
    await request({ action: "mark_read", itemId: notificationId });
  },
  async markAllRead() {
    await request({ action: "mark_all_read" });
  },
  async muteObject({ subjectType, subjectId, channel = "all" }) {
    await request({
      action: "mute_object",
      subjectType,
      subjectId,
      channel,
    });
  },
};
