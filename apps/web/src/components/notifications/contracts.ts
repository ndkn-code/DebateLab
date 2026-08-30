/**
 * Presentation adapter for the frozen notification contract names.
 *
 * The notification service package is not present at this checkpoint. Keep this
 * file narrow so integration can replace these declarations with imports from
 * the canonical package without changing the UI components.
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

export type NotificationMessageClass = "optional" | "essential";

export type NotificationChannel = "in_app" | "email";

export type EmailDeliveryMode = "immediate" | "daily" | "weekly" | "off";

export interface NotificationQuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

export interface NotificationEventV1 {
  id: string;
  topic: NotificationTopic;
  messageClass: NotificationMessageClass;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  deepLink: string | null;
  objectType: string | null;
  objectId: string | null;
  actorLabel?: string | null;
}

export interface NotificationPreferenceV1 {
  topic: NotificationTopic;
  messageClass: NotificationMessageClass;
  channels: Record<NotificationChannel, boolean>;
  emailDeliveryMode: EmailDeliveryMode;
  timezone: string;
  quietHours: NotificationQuietHours;
}

export type NotificationInboxFilter = "all" | "unread" | "learning" | "classes";

export interface NotificationInboxSnapshot {
  events: NotificationEventV1[];
  unreadCount: number;
}

export interface NotificationUiOperations {
  getPreferences: () => Promise<NotificationPreferenceV1[]>;
  updatePreferences: (
    preferences: NotificationPreferenceV1[],
  ) => Promise<NotificationPreferenceV1[]>;
  listInbox: (input?: {
    filter?: NotificationInboxFilter;
    cursor?: string | null;
  }) => Promise<NotificationInboxSnapshot>;
  getUnreadCount: () => Promise<number>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  muteObject: (input: {
    objectType: string;
    objectId: string;
  }) => Promise<void>;
}

export const EMPTY_NOTIFICATION_INBOX: NotificationInboxSnapshot = {
  events: [],
  unreadCount: 0,
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

export function buildDefaultNotificationPreferences(
  timezone: string,
): NotificationPreferenceV1[] {
  return NOTIFICATION_TOPICS.map((topic) => {
    const essential = topic === "account_security";
    return {
      topic,
      messageClass: essential ? "essential" : "optional",
      channels: { in_app: true, email: essential },
      emailDeliveryMode: essential ? "immediate" : "off",
      timezone,
      quietHours: { enabled: false, start: "22:00", end: "07:00" },
    };
  });
}
