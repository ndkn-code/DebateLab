import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
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
};

export type NotificationClientFactory = () => SupabaseClient;

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
  const eventType = asString(nested.event_type, "practice_reminder");
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

function errorMessage(error: { message?: string } | null, fallback: string) {
  return error?.message || fallback;
}

async function authenticatedClient(clientFactory: NotificationClientFactory) {
  const db = clientFactory();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user)
    throw new Error(errorMessage(error, "Sign in to manage notifications."));
  return { db, userId: user.id };
}

async function loadPayload(
  clientFactory: NotificationClientFactory,
  cursor?: string | null,
): Promise<ApiPayload> {
  const { db, userId } = await authenticatedClient(clientFactory);
  const limit = 50;
  let inboxQuery = db
    .from("notification_inbox_items")
    .select(
      "id,event_id,state,read_at,archived_at,created_at,notification_events(id,event_type,title,body,importance,source,subject_type,subject_id,payload,created_at)",
    )
    .eq("recipient_id", userId)
    .neq("state", "archived")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (cursor) inboxQuery = inboxQuery.lt("created_at", cursor);

  const [inbox, unread, settings, preferences, mutes] = await Promise.all([
    inboxQuery,
    db
      .from("notification_inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("state", "unread"),
    db
      .from("notification_user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    db
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .order("event_type"),
    db
      .from("notification_mutes")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
  ]);
  const error =
    inbox.error ||
    unread.error ||
    settings.error ||
    preferences.error ||
    mutes.error;
  if (error) throw new Error(error.message);
  const items = (inbox.data ?? []) as ApiInboxItem[];
  return {
    items,
    unreadCount: unread.count ?? 0,
    nextCursor:
      items.length === limit
        ? asString(items[items.length - 1]?.created_at) || null
        : null,
    settings: (settings.data ?? {
      in_app_enabled: true,
      email_enabled: false,
      push_enabled: false,
      digest_frequency: "none",
      timezone: "Asia/Ho_Chi_Minh",
      quiet_hours_start: null,
      quiet_hours_end: null,
    }) as ApiSettings,
    preferences: (preferences.data ?? []) as ApiPreference[],
    mutes: (mutes.data ?? []) as ApiMute[],
  };
}

async function requireWrite(
  promise: PromiseLike<{ error: { message?: string } | null }>,
  fallback: string,
) {
  const result = await promise;
  if (result.error) throw new Error(errorMessage(result.error, fallback));
}

export function createNotificationApiOperations(
  clientFactory: NotificationClientFactory = () =>
    createClient() as SupabaseClient,
): NotificationUiOperations {
  return {
    async listInbox(input) {
      const payload = await loadPayload(clientFactory, input?.cursor);
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
        unreadCount: payload.unreadCount ?? 0,
        nextCursor: payload.nextCursor ?? null,
      } satisfies NotificationInboxSnapshot;
    },
    async getPreferences() {
      return mapPreferences(await loadPayload(clientFactory));
    },
    async updatePreferences(preferences) {
      const { db, userId } = await authenticatedClient(clientFactory);
      const shared = preferences[0];
      const digest = preferences.find((item) =>
        ["daily", "weekly"].includes(item.emailDeliveryMode),
      );
      const now = new Date().toISOString();
      await requireWrite(
        db.from("notification_user_settings").upsert(
          {
            user_id: userId,
            in_app_enabled: preferences.some((item) => item.channels.in_app),
            email_enabled: preferences.some(
              (item) => item.messageClass === "optional" && item.channels.email,
            ),
            push_enabled: false,
            digest_frequency: digest?.emailDeliveryMode ?? "none",
            timezone: shared?.timezone ?? "Asia/Ho_Chi_Minh",
            quiet_hours_start: shared?.quietHours.enabled
              ? shared.quietHours.start
              : null,
            quiet_hours_end: shared?.quietHours.enabled
              ? shared.quietHours.end
              : null,
            updated_at: now,
          },
          { onConflict: "user_id" },
        ),
        "Unable to save notification settings.",
      );

      const profile = await db
        .from("profiles")
        .select("preferences")
        .eq("id", userId)
        .maybeSingle();
      if (profile.error) throw new Error(profile.error.message);
      const legacy =
        profile.data?.preferences &&
        typeof profile.data.preferences === "object" &&
        !Array.isArray(profile.data.preferences)
          ? profile.data.preferences
          : {};
      await requireWrite(
        db
          .from("profiles")
          .update({
            preferences: {
              ...legacy,
              email_notifications: preferences.some(
                (item) =>
                  item.messageClass === "optional" && item.channels.email,
              ),
            },
          })
          .eq("id", userId),
        "Unable to sync notification settings.",
      );

      await Promise.all(
        preferences.flatMap((item) =>
          item.eventTypes.flatMap((eventType) =>
            (["in_app", "email"] as const).map((channel) =>
              requireWrite(
                db.from("notification_preferences").upsert(
                  {
                    user_id: userId,
                    event_type: eventType,
                    channel,
                    enabled:
                      item.messageClass === "essential" ||
                      item.channels[channel],
                    frequency:
                      channel === "email" &&
                      ["daily", "weekly"].includes(item.emailDeliveryMode)
                        ? "digest"
                        : "immediate",
                    updated_at: now,
                  },
                  { onConflict: "user_id,event_type,channel" },
                ),
                "Unable to save a notification topic.",
              ),
            ),
          ),
        ),
      );
      return mapPreferences(await loadPayload(clientFactory));
    },
    async markRead(notificationId) {
      const { db, userId } = await authenticatedClient(clientFactory);
      await requireWrite(
        db
          .from("notification_inbox_items")
          .update({ state: "read", read_at: new Date().toISOString() })
          .eq("id", notificationId)
          .eq("recipient_id", userId),
        "Unable to mark the notification as read.",
      );
    },
    async markAllRead() {
      const { db, userId } = await authenticatedClient(clientFactory);
      await requireWrite(
        db
          .from("notification_inbox_items")
          .update({ state: "read", read_at: new Date().toISOString() })
          .eq("recipient_id", userId)
          .eq("state", "unread"),
        "Unable to mark notifications as read.",
      );
    },
    async muteObject({ subjectType, subjectId, channel = "all" }) {
      const { db, userId } = await authenticatedClient(clientFactory);
      await requireWrite(
        db.from("notification_mutes").upsert(
          {
            user_id: userId,
            subject_type: subjectType,
            subject_id: subjectId,
            channel,
            muted_until: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,subject_type,subject_id,channel" },
        ),
        "Unable to mute this notification source.",
      );
    },
  };
}

export const notificationApiOperations = createNotificationApiOperations();
