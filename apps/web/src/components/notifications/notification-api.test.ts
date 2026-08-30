import assert from "node:assert/strict";

import { notificationApiOperations } from "./notification-api";

const originalFetch = globalThis.fetch;
const requests: Array<{ url: string; body: unknown }> = [];

globalThis.fetch = (async (input, init) => {
  requests.push({
    url: String(input),
    body: init?.body ? JSON.parse(String(init.body)) : null,
  });
  if (init?.method === "PATCH") {
    return Response.json({ ok: true });
  }
  return Response.json({
    unreadCount: 1,
    nextCursor: null,
    items: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        event_id: "22222222-2222-4222-8222-222222222222",
        state: "unread",
        read_at: null,
        created_at: "2026-08-30T12:00:00.000Z",
        notification_events: {
          id: "22222222-2222-4222-8222-222222222222",
          event_type: "teacher.feedback_published",
          title: "Feedback ready",
          body: "Open the review.",
          subject_type: "assignment",
          subject_id: "assignment-1",
          payload: { deepLink: "/ielts/assigned", url: "https://unsafe.test" },
          created_at: "2026-08-30T12:00:00.000Z",
        },
      },
    ],
    settings: {
      email_enabled: true,
      digest_frequency: "weekly",
      timezone: "Asia/Ho_Chi_Minh",
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
    },
    preferences: [
      {
        event_type: "practice",
        channel: "email",
        enabled: true,
        frequency: "digest",
      },
    ],
    mutes: [
      {
        subject_type: "assignment",
        subject_id: "assignment-1",
        channel: "all",
        muted_until: null,
      },
    ],
  });
}) as typeof fetch;

async function main() {
  try {
    const inbox = await notificationApiOperations.listInbox();
    assert.equal(inbox.unreadCount, 1);
    assert.equal(inbox.events[0]?.topic, "teacher_feedback");
    assert.equal(inbox.events[0]?.deepLink, "/ielts/assigned");
    assert.equal(inbox.events[0]?.muted, true);

    const preferences = await notificationApiOperations.getPreferences();
    assert.equal(
      preferences.find((item) => item.topic === "practice")?.emailDeliveryMode,
      "weekly",
    );

    const practice = preferences.find((item) => item.topic === "practice")!;
    const assignments = preferences.find(
      (item) => item.topic === "assignments",
    )!;
    await notificationApiOperations.updatePreferences([
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
    const settingsRequest = requests.find(
      (item) =>
        typeof item.body === "object" &&
        item.body !== null &&
        (item.body as { action?: string }).action === "settings",
    );
    assert.equal(
      (
        settingsRequest?.body as {
          settings?: { digestFrequency?: string };
        }
      ).settings?.digestFrequency,
      "daily",
    );
    assert.ok(
      requests.some(
        (item) =>
          typeof item.body === "object" &&
          item.body !== null &&
          (item.body as { preference?: { eventType?: string } }).preference
            ?.eventType === "assignment_published",
      ),
    );

    await notificationApiOperations.muteObject({
      subjectType: "assignment",
      subjectId: "assignment-1",
    });
    assert.deepEqual(requests.at(-1)?.body, {
      action: "mute_object",
      subjectType: "assignment",
      subjectId: "assignment-1",
      channel: "all",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void main()
  .then(() => console.log("notification API adapter tests passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
