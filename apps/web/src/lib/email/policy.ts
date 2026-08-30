import type {
  EmailSenderStream,
  EmailTemplateKey,
  NotificationMessageClass,
  NotificationTopic,
} from "@/lib/email/types";

export interface EmailTemplatePolicy {
  messageClass: NotificationMessageClass;
  topic: NotificationTopic;
  senderStream: EmailSenderStream;
  optional: boolean;
}

export const EMAIL_TEMPLATE_POLICY: Record<
  EmailTemplateKey,
  EmailTemplatePolicy
> = {
  welcome: {
    messageClass: "lifecycle",
    topic: "onboarding",
    senderStream: "updates",
    optional: true,
  },
  onboarding_nudge: {
    messageClass: "lifecycle",
    topic: "onboarding",
    senderStream: "updates",
    optional: true,
  },
  practice_reminder: {
    messageClass: "lifecycle",
    topic: "practice",
    senderStream: "updates",
    optional: true,
  },
  streak_rescue: {
    messageClass: "lifecycle",
    topic: "streak",
    senderStream: "updates",
    optional: true,
  },
  winback: {
    messageClass: "lifecycle",
    topic: "practice",
    senderStream: "updates",
    optional: true,
  },
  weekly_progress: {
    messageClass: "lifecycle",
    topic: "progress",
    senderStream: "updates",
    optional: true,
  },
  achievement: {
    messageClass: "lifecycle",
    topic: "achievement",
    senderStream: "updates",
    optional: true,
  },
  course_nudge: {
    messageClass: "lifecycle",
    topic: "course",
    senderStream: "updates",
    optional: true,
  },
  club_invitation: {
    messageClass: "operational",
    topic: "club_invitation",
    senderStream: "notifications",
    optional: false,
  },
};

export function resolveCandidatePolicy(input: {
  templateKey: EmailTemplateKey;
  messageClass?: NotificationMessageClass;
  topic?: NotificationTopic;
  senderStream?: EmailSenderStream;
}): EmailTemplatePolicy {
  const fallback = EMAIL_TEMPLATE_POLICY[input.templateKey];
  const messageClass = input.messageClass ?? fallback.messageClass;
  return {
    messageClass,
    topic: input.topic ?? fallback.topic,
    senderStream: input.senderStream ?? fallback.senderStream,
    optional: messageClass === "lifecycle" || messageClass === "marketing",
  };
}

export function emailListId(topic: NotificationTopic) {
  return `${topic}.notifications.thinkfy.net`;
}
