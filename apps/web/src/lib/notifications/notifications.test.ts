import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildNotificationIdempotencyKey,
  canRetryDeliveryJob,
  computeDeliveryRetryDelaySeconds,
  isDeliveryLeaseActive,
  mapLegacyNotificationPreferences,
} from "./model";
import {
  claimNotificationDeliveryJob,
  completeNotificationDeliveryJob,
  enqueueNotificationEvent,
  listNotificationInboxPage,
  listNotificationInboxItems,
  markAllNotificationInboxItemsRead,
  markNotificationInboxItemRead,
  muteNotificationEventType,
  muteNotificationSubject,
  type NotificationDbClient,
  type NotificationDbResult,
} from "./repository";

const userId = "00000000-0000-4000-8000-000000000001";
const eventId = "00000000-0000-4000-8000-000000000002";
const inboxId = "00000000-0000-4000-8000-000000000003";
const jobId = "00000000-0000-4000-8000-000000000004";
const leaseToken = "00000000-0000-4000-8000-000000000005";
const timestamp = "2026-08-30T12:00:00.000Z";

const migratedOff = mapLegacyNotificationPreferences({});
assert.equal(migratedOff.settings.emailEnabled, false);
assert.equal(migratedOff.preferences.length, 27);
assert.equal(
  migratedOff.preferences.filter(
    (preference) => preference.channel === "email" && preference.enabled,
  ).length,
  0,
);

const remindersOnly = mapLegacyNotificationPreferences({
  email_notifications: true,
  email_opt_in_scope: "reminders_only",
  practice_reminders: false,
  streak_reminders: true,
  achievement_updates: true,
});
const emailPreference = (eventType: string) =>
  remindersOnly.preferences.find(
    (preference) =>
      preference.eventType === eventType && preference.channel === "email",
  );
assert.equal(emailPreference("practice_reminder")?.enabled, false);
assert.equal(emailPreference("streak_rescue")?.enabled, true);
assert.equal(emailPreference("course_nudge")?.enabled, false);
assert.equal(emailPreference("weekly_progress")?.enabled, false);
assert.equal(remindersOnly.settings.timezone, "Asia/Ho_Chi_Minh");

assert.equal(
  buildNotificationIdempotencyKey(eventId, userId, "email"),
  `notification:${eventId}:${userId}:email`,
);
assert.equal(computeDeliveryRetryDelaySeconds(0), 30);
assert.equal(computeDeliveryRetryDelaySeconds(1), 60);
assert.equal(computeDeliveryRetryDelaySeconds(10), 3_600);
assert.equal(computeDeliveryRetryDelaySeconds(-4), 30);
assert.equal(canRetryDeliveryJob("failed", 4), true);
assert.equal(canRetryDeliveryJob("failed", 5), false);
assert.equal(canRetryDeliveryJob("completed", 0), false);
assert.equal(
  isDeliveryLeaseActive(timestamp, new Date("2026-08-30T11:59:00.000Z")),
  true,
);
assert.equal(
  isDeliveryLeaseActive(timestamp, new Date("2026-08-30T12:00:00.000Z")),
  false,
);

const inboxRow = {
  id: inboxId,
  event_id: eventId,
  recipient_id: userId,
  state: "unread",
  read_at: null,
  archived_at: null,
  created_at: timestamp,
};
const jobRow = {
  id: jobId,
  inbox_item_id: inboxId,
  event_id: eventId,
  recipient_id: userId,
  channel: "email",
  status: "processing",
  idempotency_key: buildNotificationIdempotencyKey(eventId, userId, "email"),
  payload: {},
  attempts: 1,
  max_attempts: 5,
  available_at: timestamp,
  locked_at: timestamp,
  lease_token: leaseToken,
  lease_expires_at: "2026-08-30T12:05:00.000Z",
  provider_message_id: null,
  completed_at: null,
  last_error: null,
  created_at: timestamp,
  updated_at: timestamp,
};
const preferenceRow = {
  id: jobId,
  user_id: userId,
  event_type: "practice_reminder",
  channel: "email",
  enabled: false,
  frequency: "immediate",
  updated_at: timestamp,
};
const muteRow = {
  id: jobId,
  user_id: userId,
  subject_type: "club",
  subject_id: "00000000-0000-4000-8000-000000000010",
  channel: "all",
  muted_until: null,
};

const calls: Array<{ kind: string; value: unknown }> = [];
function fakeQuery(result: NotificationDbResult<unknown>) {
  const query = {
    select(columns?: string) {
      calls.push({ kind: "select", value: columns });
      return query;
    },
    eq(column: string, value: unknown) {
      calls.push({ kind: `eq:${column}`, value });
      return query;
    },
    lt(column: string, value: unknown) {
      calls.push({ kind: `lt:${column}`, value });
      return query;
    },
    order(column: string, options?: { ascending?: boolean }) {
      calls.push({ kind: `order:${column}`, value: options });
      return query;
    },
    limit(value: number) {
      calls.push({ kind: "limit", value });
      return query;
    },
    update(value: unknown) {
      calls.push({ kind: "update", value });
      return query;
    },
    upsert(value: unknown, options?: { onConflict?: string }) {
      calls.push({ kind: "upsert", value: { value, options } });
      return query;
    },
    single() {
      return Promise.resolve({
        data:
          result.data && Array.isArray(result.data)
            ? result.data[0]
            : result.data,
        error: result.error,
      });
    },
    then(
      onFulfilled: (value: NotificationDbResult<unknown>) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return query;
}

const db = {
  from(table: string) {
    calls.push({ kind: "from", value: table });
    if (table === "notification_preferences")
      return fakeQuery({ data: preferenceRow, error: null });
    if (table === "notification_mutes")
      return fakeQuery({ data: muteRow, error: null });
    return fakeQuery({ data: [inboxRow], error: null });
  },
  rpc(name: string, args?: Record<string, unknown>) {
    calls.push({ kind: `rpc:${name}`, value: args });
    if (name === "enqueue_notification_event")
      return Promise.resolve({ data: eventId, error: null });
    if (name === "claim_notification_delivery_job")
      return Promise.resolve({ data: jobRow, error: null });
    return Promise.resolve({ data: [jobRow], error: null });
  },
} as unknown as NotificationDbClient;

async function runRepositoryAssertions() {
  const inboxItems = await listNotificationInboxItems(db, userId, {
    unreadOnly: true,
    limit: 200,
  });
  assert.equal(inboxItems.length, 1);
  assert.deepEqual(
    calls.find((call) => call.kind === "eq:recipient_id")?.value,
    userId,
  );
  assert.equal(calls.find((call) => call.kind === "eq:state")?.value, "unread");
  assert.equal(calls.find((call) => call.kind === "limit")?.value, 100);
  await listNotificationInboxPage(db, userId, {
    beforeCreatedAt: timestamp,
    limit: 1,
  });
  assert.equal(
    calls.find((call) => call.kind === "lt:created_at")?.value,
    timestamp,
  );
  await markNotificationInboxItemRead(db, userId, inboxId, timestamp);
  assert.deepEqual(calls.find((call) => call.kind === "update")?.value, {
    state: "read",
    read_at: timestamp,
  });
  await markAllNotificationInboxItemsRead(db, userId, timestamp);
  await muteNotificationEventType(db, userId, "practice_reminder");
  const muted = await muteNotificationSubject(db, {
    userId,
    subjectType: "club",
    subjectId: muteRow.subject_id,
  });
  assert.equal(muted.subjectId, muteRow.subject_id);

  await enqueueNotificationEvent(db, {
    eventKey: "debate:123:created",
    eventType: "debate_created",
    title: "New debate",
    body: "A debate is ready.",
    messageClass: "operational",
    recipientIds: [userId],
    payload: {},
    importance: "normal",
    source: "app",
    actorId: undefined,
    subjectType: undefined,
    subjectId: undefined,
    enqueueDeliveryJobs: true,
  });
  const enqueueCall = calls.find(
    (call) => call.kind === "rpc:enqueue_notification_event",
  );
  assert.deepEqual(
    (enqueueCall?.value as Record<string, unknown>).p_recipient_ids,
    [userId],
  );

  const claimed = await claimNotificationDeliveryJob(db, jobId, 120);
  assert.equal(claimed.id, jobId);
  const claimCall = calls.find(
    (call) => call.kind === "rpc:claim_notification_delivery_job",
  );
  assert.equal((claimCall?.value as Record<string, unknown>).p_job_id, jobId);
  const completed = await completeNotificationDeliveryJob(db, {
    jobId,
    leaseToken,
    success: true,
    providerMessageId: "provider-123",
  });
  assert.equal(completed.id, jobId);
}

const migrationRoot = process.cwd().endsWith(join("apps", "web"))
  ? join("..", "..")
  : ".";
const migration = readFileSync(
  join(
    process.cwd(),
    migrationRoot,
    "supabase/migrations/20260830060000_notification_v2_foundation.sql",
  ),
  "utf8",
);
for (const table of [
  "notification_events",
  "notification_inbox_items",
  "notification_preferences",
  "notification_mutes",
  "notification_user_settings",
  "notification_delivery_jobs",
]) {
  assert.match(
    migration,
    new RegExp(`alter table public\\.${table} enable row level security`),
  );
}
assert.match(migration, /recipient_id = auth\.uid\(\)/);
assert.match(migration, /user_id = auth\.uid\(\)/);
assert.match(
  migration,
  /create policy "No direct notification delivery job access" on public\.notification_delivery_jobs\s+for all to authenticated using \(false\) with check \(false\)/,
);
assert.match(
  migration,
  /grant update \(state, read_at, archived_at\) on public\.notification_inbox_items to authenticated/,
);
assert.match(
  migration,
  /revoke all on function public\.claim_notification_delivery_job\(uuid, integer\) from public, anon, authenticated/,
);
assert.match(
  migration,
  /create or replace function public\.claim_notification_delivery_job\(\s*p_job_id uuid/,
);
assert.match(
  migration,
  /status in \('pending', 'processing', 'completed', 'failed', 'dead_letter'\)/,
);
assert.match(migration, /max_attempts integer not null default 5/);
assert.match(
  migration,
  /event_id uuid not null references public\.notification_events/,
);
assert.match(
  migration,
  /recipient_id uuid not null references public\.profiles/,
);
assert.match(migration, /payload jsonb not null default '\{\}'::jsonb/);
assert.match(migration, /message_class text not null default 'operational'/);
assert.match(migration, /topic text/);
assert.match(
  migration,
  /when 'email' then[\s\S]*coalesce\(\(select s\.email_enabled[\s\S]*false\)/,
);
assert.match(
  migration,
  /notification_event_id uuid references public\.notification_events/,
);
assert.match(migration, /message_class text/);
assert.match(migration, /sender_stream text/);
assert.match(migration, /delayed_at timestamptz/);
assert.match(migration, /last_provider_event_at timestamptz/);
assert.match(
  migration,
  /sender_stream is null or sender_stream in \('notifications', 'updates'\)/,
);
assert.match(migration, /on conflict \(event_key\) do nothing/);
assert.match(migration, /Snapshot legacy profile consent/);
assert.match(
  migration,
  /jsonb_typeof\(p\.preferences -> 'email_notifications'\)/,
);
assert.match(migration, /email_scope <> 'reminders_only'/);
assert.match(migration, /lms_notification_v2_dual_write/);
assert.match(migration, /false,\s+'operational',\s+'lms_notification'/);
assert.match(migration, /notification_delivery_available_at/);
assert.match(migration, /digest_frequency/);
assert.match(migration, /quiet_hours_start/);

runRepositoryAssertions()
  .then(() =>
    console.log(
      "notification contracts, repository, and migration tests passed",
    ),
  )
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
