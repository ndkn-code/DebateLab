import assert from "node:assert/strict";

import { createNotificationApiOperations } from "./notification-api";

type Row = Record<string, unknown>;

const inbox = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    event_id: "22222222-2222-4222-8222-222222222222",
    state: "unread",
    read_at: null,
    created_at: "2026-08-30T12:00:00.000Z",
    notification_events: {
      id: "22222222-2222-4222-8222-222222222222",
      event_type: "teacher_feedback",
      title: "Feedback ready",
      body: "Open the review.",
      subject_type: "assignment",
      subject_id: "assignment-1",
      payload: { deepLink: "/ielts/assigned", url: "https://unsafe.test" },
      created_at: "2026-08-30T12:00:00.000Z",
    },
  },
];

const state = {
  settings: {
    email_enabled: true,
    digest_frequency: "weekly",
    timezone: "Asia/Ho_Chi_Minh",
    quiet_hours_start: "22:00",
    quiet_hours_end: "07:00",
  } as Row,
  preferences: [
    {
      event_type: "practice_reminder",
      channel: "email",
      enabled: true,
      frequency: "digest",
    },
  ] as Row[],
  mutes: [
    {
      subject_type: "assignment",
      subject_id: "assignment-1",
      channel: "all",
      muted_until: null,
    },
  ] as Row[],
  writes: [] as Array<{ table: string; operation: string; value: Row }>,
};

class FakeQuery implements PromiseLike<{
  data: unknown;
  error: null;
  count?: number;
}> {
  private operation = "select";
  private value: Row = {};
  private countOnly = false;

  constructor(private readonly table: string) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    this.countOnly = options?.head === true;
    return this;
  }

  eq() {
    return this;
  }

  neq() {
    return this;
  }

  lt() {
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return this;
  }

  update(value: Row) {
    this.operation = "update";
    this.value = value;
    return this;
  }

  upsert(value: Row) {
    this.operation = "upsert";
    this.value = value;
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.run(true));
  }

  private run(single = false) {
    if (this.operation !== "select") {
      state.writes.push({
        table: this.table,
        operation: this.operation,
        value: this.value,
      });
      if (this.table === "notification_user_settings")
        state.settings = { ...state.settings, ...this.value };
      if (this.table === "notification_preferences") {
        const key = `${this.value.event_type}:${this.value.channel}`;
        state.preferences = state.preferences.filter(
          (row) => `${row.event_type}:${row.channel}` !== key,
        );
        state.preferences.push(this.value);
      }
      if (this.table === "notification_mutes") state.mutes.push(this.value);
      return { data: null, error: null };
    }

    if (this.table === "notification_inbox_items") {
      if (this.countOnly) return { data: null, error: null, count: 1 };
      return { data: inbox, error: null };
    }
    if (this.table === "notification_user_settings")
      return { data: single ? state.settings : [state.settings], error: null };
    if (this.table === "notification_preferences")
      return { data: state.preferences, error: null };
    if (this.table === "notification_mutes")
      return { data: state.mutes, error: null };
    if (this.table === "profiles")
      return { data: single ? { preferences: {} } : [], error: null };
    return { data: single ? null : [], error: null };
  }

  then<
    TResult1 = { data: unknown; error: null; count?: number },
    TResult2 = never,
  >(
    onfulfilled?:
      | ((value: {
          data: unknown;
          error: null;
          count?: number;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

const fakeClient = {
  auth: {
    getUser: async () => ({
      data: { user: { id: "33333333-3333-4333-8333-333333333333" } },
      error: null,
    }),
  },
  from: (table: string) => new FakeQuery(table),
};

async function main() {
  const operations = createNotificationApiOperations(() => fakeClient as never);
  const snapshot = await operations.listInbox();
  assert.equal(snapshot.unreadCount, 1);
  assert.equal(snapshot.events[0]?.topic, "teacher_feedback");
  assert.equal(snapshot.events[0]?.deepLink, "/ielts/assigned");
  assert.equal(snapshot.events[0]?.muted, true);

  const preferences = await operations.getPreferences();
  assert.equal(
    preferences.find((item) => item.topic === "practice")?.emailDeliveryMode,
    "weekly",
  );

  const practice = preferences.find((item) => item.topic === "practice")!;
  const assignments = preferences.find((item) => item.topic === "assignments")!;
  await operations.updatePreferences([
    {
      ...practice,
      channels: { ...practice.channels, email: true },
      emailDeliveryMode: "daily",
    },
    {
      ...assignments,
      channels: { ...assignments.channels, email: true },
      emailDeliveryMode: "weekly",
    },
  ]);
  const settingsWrite = state.writes.find(
    (write) => write.table === "notification_user_settings",
  );
  assert.equal(settingsWrite?.value.digest_frequency, "daily");
  assert.ok(
    state.writes.some(
      (write) =>
        write.table === "notification_preferences" &&
        write.value.event_type === "assignment_published",
    ),
  );

  await operations.markRead(inbox[0].id);
  await operations.markAllRead();
  await operations.muteObject({
    subjectType: "assignment",
    subjectId: "assignment-1",
  });
  assert.ok(
    state.writes.some(
      (write) =>
        write.table === "notification_mutes" &&
        write.value.subject_id === "assignment-1",
    ),
  );
}

void main()
  .then(() => console.log("notification browser adapter tests passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
