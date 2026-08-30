import {
  notificationDeliveryJobSchema,
  notificationInboxItemSchema,
  notificationMuteSchema,
  notificationPreferenceSchema,
  notificationUserSettingsSchema,
  type NotificationDeliveryJob,
  type NotificationEventInput,
  type NotificationInboxItem,
  type NotificationPreference,
  type NotificationUserSettings,
} from "./contracts";
import {
  buildNotificationIdempotencyKey,
  type LegacyNotificationPreferences,
} from "./model";
import { mapLegacyNotificationPreferences } from "./model";

export type NotificationDbError = { message: string; code?: string };
export type NotificationDbResult<T> = {
  data: T | null;
  error: NotificationDbError | null;
};

/** Minimal Supabase-compatible surface, intentionally independent of generated DB types. */
export interface NotificationQueryBuilder<T = unknown> extends PromiseLike<
  NotificationDbResult<T>
> {
  select(columns?: string): NotificationQueryBuilder<T>;
  eq(column: string, value: unknown): NotificationQueryBuilder<T>;
  lt(column: string, value: unknown): NotificationQueryBuilder<T>;
  order(
    column: string,
    options?: { ascending?: boolean },
  ): NotificationQueryBuilder<T>;
  limit(count: number): NotificationQueryBuilder<T>;
  update(values: unknown): NotificationQueryBuilder<T>;
  upsert(
    values: unknown,
    options?: { onConflict?: string },
  ): NotificationQueryBuilder<T>;
  single(): PromiseLike<NotificationDbResult<T>>;
}

export interface NotificationDbClient {
  from(table: string): NotificationQueryBuilder;
  rpc<T = unknown>(
    name: string,
    args?: Record<string, unknown>,
  ): PromiseLike<NotificationDbResult<T>>;
}

function requireData<T>(result: NotificationDbResult<T>, operation: string): T {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  if (result.data === null || result.data === undefined)
    throw new Error(`${operation}: empty response`);
  return result.data;
}

function parseInboxItem(raw: Record<string, unknown>): NotificationInboxItem {
  return notificationInboxItemSchema.parse({
    id: raw.id,
    eventId: raw.event_id,
    recipientId: raw.recipient_id,
    state: raw.state,
    readAt: raw.read_at ?? null,
    archivedAt: raw.archived_at ?? null,
    createdAt: raw.created_at,
  });
}

function parseDeliveryJob(
  raw: Record<string, unknown>,
): NotificationDeliveryJob {
  return notificationDeliveryJobSchema.parse({
    id: raw.id,
    inboxItemId: raw.inbox_item_id,
    eventId: raw.event_id,
    recipientId: raw.recipient_id,
    channel: raw.channel,
    status: raw.status,
    idempotencyKey: raw.idempotency_key,
    payload: raw.payload ?? {},
    attempts: raw.attempts,
    maxAttempts: raw.max_attempts,
    availableAt: raw.available_at,
    lockedAt: raw.locked_at ?? null,
    leaseToken: raw.lease_token ?? null,
    leaseExpiresAt: raw.lease_expires_at ?? null,
    providerMessageId: raw.provider_message_id ?? null,
    lastError: raw.last_error ?? null,
    completedAt: raw.completed_at ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  });
}

function parsePreference(raw: Record<string, unknown>): NotificationPreference {
  return notificationPreferenceSchema.parse({
    id: raw.id,
    userId: raw.user_id,
    eventType: raw.event_type,
    channel: raw.channel,
    enabled: raw.enabled,
    frequency: raw.frequency,
    updatedAt: raw.updated_at,
  });
}

function parseUserSettings(
  raw: Record<string, unknown>,
): NotificationUserSettings {
  return notificationUserSettingsSchema.parse({
    userId: raw.user_id,
    inAppEnabled: raw.in_app_enabled,
    emailEnabled: raw.email_enabled,
    pushEnabled: raw.push_enabled,
    digestFrequency: raw.digest_frequency,
    timezone: raw.timezone,
    quietHoursStart: raw.quiet_hours_start ?? null,
    quietHoursEnd: raw.quiet_hours_end ?? null,
    updatedAt: raw.updated_at,
  });
}

export async function listNotificationInboxItems(
  db: NotificationDbClient,
  userId: string,
  options: { limit?: number; unreadOnly?: boolean } = {},
) {
  const page = await listNotificationInboxPage(db, userId, options);
  return page.items;
}

export async function listNotificationInboxPage(
  db: NotificationDbClient,
  userId: string,
  options: {
    limit?: number;
    unreadOnly?: boolean;
    beforeCreatedAt?: string;
  } = {},
) {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
  let query = db
    .from("notification_inbox_items")
    .select("id,event_id,recipient_id,state,read_at,archived_at,created_at")
    .eq("recipient_id", userId);
  if (options.unreadOnly) query = query.eq("state", "unread");
  if (options.beforeCreatedAt)
    query = query.lt("created_at", options.beforeCreatedAt);
  const result = await query
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = requireData<unknown[]>(
    result as NotificationDbResult<unknown[]>,
    "list notification inbox",
  );
  const items = rows.map((raw) =>
    parseInboxItem(raw as Record<string, unknown>),
  );
  return {
    items,
    nextCursor:
      items.length === limit
        ? (items[items.length - 1]?.createdAt ?? null)
        : null,
  };
}

export async function markNotificationInboxItemRead(
  db: NotificationDbClient,
  userId: string,
  itemId: string,
  readAt = new Date().toISOString(),
) {
  const result = await db
    .from("notification_inbox_items")
    .update({ state: "read", read_at: readAt })
    .eq("id", itemId)
    .eq("recipient_id", userId)
    .select("id,event_id,recipient_id,state,read_at,archived_at,created_at")
    .single();
  return parseInboxItem(
    requireData(result, "mark notification read") as Record<string, unknown>,
  );
}

export async function markAllNotificationInboxItemsRead(
  db: NotificationDbClient,
  userId: string,
  readAt = new Date().toISOString(),
) {
  const result = await db
    .from("notification_inbox_items")
    .update({ state: "read", read_at: readAt })
    .eq("recipient_id", userId)
    .eq("state", "unread");
  if (result.error)
    throw new Error(`mark all notifications read: ${result.error.message}`);
  return true;
}

export async function muteNotificationEventType(
  db: NotificationDbClient,
  userId: string,
  eventType: string,
  channel: "email" | "push" | "in_app" = "email",
) {
  return upsertNotificationPreference(db, {
    userId,
    eventType,
    channel,
    enabled: false,
    frequency: "immediate",
  });
}

export async function muteNotificationSubject(
  db: NotificationDbClient,
  input: {
    userId: string;
    subjectType: string;
    subjectId: string;
    channel?: "all" | "email" | "push" | "in_app";
    mutedUntil?: string | null;
  },
) {
  const result = await db
    .from("notification_mutes")
    .upsert(
      {
        user_id: input.userId,
        subject_type: input.subjectType,
        subject_id: input.subjectId,
        channel: input.channel ?? "all",
        muted_until: input.mutedUntil ?? null,
      },
      { onConflict: "user_id,subject_type,subject_id,channel" },
    )
    .select("id,user_id,subject_type,subject_id,channel,muted_until")
    .single();
  const raw = requireData(result, "mute notification subject") as Record<
    string,
    unknown
  >;
  return notificationMuteSchema.parse({
    id: raw.id,
    userId: raw.user_id,
    subjectType: raw.subject_type,
    subjectId: raw.subject_id,
    channel: raw.channel,
    mutedUntil: raw.muted_until ?? null,
  });
}

export async function upsertNotificationPreference(
  db: NotificationDbClient,
  input: NotificationPreference,
) {
  const result = await db
    .from("notification_preferences")
    .upsert(
      {
        user_id: input.userId,
        event_type: input.eventType,
        channel: input.channel,
        enabled: input.enabled,
        frequency: input.frequency,
      },
      { onConflict: "user_id,event_type,channel" },
    )
    .select("id,user_id,event_type,channel,enabled,frequency,updated_at")
    .single();
  return parsePreference(
    requireData(result, "upsert notification preference") as Record<
      string,
      unknown
    >,
  );
}

export async function upsertNotificationUserSettings(
  db: NotificationDbClient,
  input: NotificationUserSettings,
) {
  const result = await db
    .from("notification_user_settings")
    .upsert(
      {
        user_id: input.userId,
        in_app_enabled: input.inAppEnabled,
        email_enabled: input.emailEnabled,
        push_enabled: input.pushEnabled,
        digest_frequency: input.digestFrequency,
        timezone: input.timezone,
        quiet_hours_start: input.quietHoursStart ?? null,
        quiet_hours_end: input.quietHoursEnd ?? null,
      },
      { onConflict: "user_id" },
    )
    .select(
      "user_id,in_app_enabled,email_enabled,push_enabled,digest_frequency,timezone,quiet_hours_start,quiet_hours_end,updated_at",
    )
    .single();
  return parseUserSettings(
    requireData(result, "upsert notification settings") as Record<
      string,
      unknown
    >,
  );
}

export async function migrateLegacyNotificationPreferences(
  db: NotificationDbClient,
  userId: string,
  legacy: LegacyNotificationPreferences | null | undefined,
) {
  const mapped = mapLegacyNotificationPreferences(legacy);
  const settings = await upsertNotificationUserSettings(db, {
    userId,
    ...mapped.settings,
  });
  const preferences = await Promise.all(
    mapped.preferences.map((preference) =>
      upsertNotificationPreference(db, { userId, ...preference }),
    ),
  );
  return { settings, preferences };
}

export async function enqueueNotificationEvent(
  db: NotificationDbClient,
  input: NotificationEventInput,
) {
  const result = await db.rpc<string>("enqueue_notification_event", {
    p_event_key: input.eventKey,
    p_event_type: input.eventType,
    p_title: input.title,
    p_body: input.body,
    p_message_class: input.messageClass,
    p_topic: input.topic ?? null,
    p_recipient_ids: input.recipientIds,
    p_payload: input.payload,
    p_importance: input.importance,
    p_source: input.source,
    p_actor_id: input.actorId ?? null,
    p_subject_type: input.subjectType ?? null,
    p_subject_id: input.subjectId ?? null,
    p_enqueue_delivery_jobs: input.enqueueDeliveryJobs,
  });
  return requireData(result, "enqueue notification event");
}

export async function claimNotificationDeliveryJobs(
  db: NotificationDbClient,
  options: { limit?: number; leaseSeconds?: number } = {},
) {
  const result = await db.rpc<unknown[]>("claim_notification_delivery_jobs", {
    p_limit: options.limit ?? 50,
    p_lease_seconds: options.leaseSeconds ?? 300,
  });
  return requireData(result, "claim notification delivery jobs").map((raw) =>
    parseDeliveryJob(raw as Record<string, unknown>),
  );
}

export async function claimNotificationDeliveryJob(
  db: NotificationDbClient,
  jobId: string,
  leaseSeconds = 300,
) {
  const result = await db.rpc<unknown>("claim_notification_delivery_job", {
    p_job_id: jobId,
    p_lease_seconds: leaseSeconds,
  });
  return parseDeliveryJob(
    requireData(result, "claim notification delivery job") as Record<
      string,
      unknown
    >,
  );
}

export async function reclaimNotificationDeliveryJobs(
  db: NotificationDbClient,
  options: { limit?: number; maxAttempts?: number } = {},
) {
  const result = await db.rpc<number>("reclaim_notification_delivery_jobs", {
    p_limit: options.limit ?? 100,
    p_max_attempts: options.maxAttempts ?? 5,
  });
  return requireData(result, "reclaim notification delivery jobs");
}

export async function completeNotificationDeliveryJob(
  db: NotificationDbClient,
  input: {
    jobId: string;
    leaseToken: string;
    success: boolean;
    error?: string | null;
    providerMessageId?: string | null;
  },
) {
  const result = await db.rpc<unknown[]>("complete_notification_delivery_job", {
    p_job_id: input.jobId,
    p_lease_token: input.leaseToken,
    p_success: input.success,
    p_error: input.error ?? null,
    p_provider_message_id: input.providerMessageId ?? null,
  });
  const rows = requireData(result, "complete notification delivery job");
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row)
    throw new Error("complete notification delivery job: empty response");
  return parseDeliveryJob(row as Record<string, unknown>);
}

export { buildNotificationIdempotencyKey };
