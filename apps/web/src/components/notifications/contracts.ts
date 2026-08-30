/**
 * UI-side adapter for the notification V2 contract. The backend contract is
 * merged separately; keep API wire parsing in notification-api.ts so database
 * row shapes never leak into presentation components.
 */
export type NotificationTopic =
  | "practice"
  | "streak"
  | "achievements"
  | "assignments"
  | "teacher_feedback"
  | "class_updates"
  | "product_updates"
  | "account_security";

export type NotificationMessageClass =
  | "transactional"
  | "operational"
  | "lifecycle"
  | "marketing";

export type NotificationChannel = "in_app" | "email" | "push";
export type EmailDeliveryMode = "immediate" | "digest";
export type NotificationDigestFrequency = "none" | "daily" | "weekly";
export type NotificationCadence = "immediate" | "daily" | "weekly" | "off";

export interface NotificationEventV1 {
  eventKey: string;
  eventType: string;
  title: string;
  body: string;
  messageClass: NotificationMessageClass;
  topic?: string | null;
  recipientIds: string[];
  payload: Record<string, unknown>;
  importance: "low" | "normal" | "high" | "critical";
  source: string;
  actorId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  enqueueDeliveryJobs: boolean;
}

export interface NotificationPreferenceV1 {
  id?: string;
  userId: string;
  eventType: string;
  channel: NotificationChannel;
  enabled: boolean;
  frequency: EmailDeliveryMode;
  updatedAt?: string;
}

export interface NotificationQuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export interface NotificationInboxEvent {
  id: string;
  eventId: string;
  eventType: string;
  topic: NotificationTopic;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  deepLink: string | null;
  objectType: string | null;
  objectId: string | null;
  muted?: boolean;
}

export interface NotificationPreferenceView {
  topic: NotificationTopic;
  eventTypes: string[];
  messageClass: "optional" | "essential";
  channels: Pick<Record<NotificationChannel, boolean>, "in_app" | "email">;
  emailDeliveryMode: NotificationCadence;
  timezone: string;
  quietHours: NotificationQuietHours;
}

export type NotificationInboxFilter = "all" | "unread" | "learning" | "classes";

export interface NotificationInboxSnapshot {
  events: NotificationInboxEvent[];
  unreadCount: number;
  nextCursor?: string | null;
}

export interface NotificationUiOperations {
  getPreferences: () => Promise<NotificationPreferenceView[]>;
  updatePreferences: (
    preferences: NotificationPreferenceView[],
  ) => Promise<NotificationPreferenceView[]>;
  listInbox: (input?: {
    cursor?: string | null;
  }) => Promise<NotificationInboxSnapshot>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  muteObject: (input: {
    subjectType: string;
    subjectId: string;
    channel?: NotificationChannel | "all";
  }) => Promise<void>;
}

export const EMPTY_NOTIFICATION_INBOX: NotificationInboxSnapshot = {
  events: [],
  unreadCount: 0,
  nextCursor: null,
};

export const NOTIFICATION_TOPICS: NotificationTopic[] = [
  "practice",
  "streak",
  "achievements",
  "assignments",
  "teacher_feedback",
  "class_updates",
  "product_updates",
  "account_security",
];

export const DEFAULT_EVENT_TYPES: Record<NotificationTopic, string[]> = {
  practice: [
    "welcome",
    "onboarding_nudge",
    "practice_reminder",
    "winback",
    "course_nudge",
  ],
  streak: ["streak_rescue"],
  achievements: ["weekly_progress", "achievement"],
  assignments: [
    "assignment_published",
    "assignment_due_soon",
    "assignment_returned",
    "resubmission_requested",
    "result_published",
  ],
  teacher_feedback: ["teacher_feedback"],
  class_updates: ["class_announcement", "club_invitation"],
  product_updates: ["product_updates"],
  account_security: ["account_security"],
};

export function buildDefaultNotificationPreferences(
  timezone: string,
): NotificationPreferenceView[] {
  return NOTIFICATION_TOPICS.map((topic) => {
    const essential = topic === "account_security";
    return {
      topic,
      eventTypes: DEFAULT_EVENT_TYPES[topic],
      messageClass: essential ? "essential" : "optional",
      channels: { in_app: true, email: essential },
      emailDeliveryMode: essential ? "immediate" : "off",
      timezone,
      quietHours: { enabled: false, start: "22:00", end: "07:00" },
    };
  });
}
