import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildTemplateVariables,
  EMAIL_TEMPLATE_META,
} from "@/lib/email/templates";
import { dispatchEmailCandidate } from "@/lib/email/dispatch";
import { buildUnsubscribeLinks } from "@/lib/email/unsubscribe";
import { EMAIL_TEMPLATE_KEYS } from "@/lib/email/types";
import type {
  EmailCategory,
  EmailLocale,
  EmailTemplateKey,
  NotificationTopic,
} from "@/lib/email/types";
import type { NotificationDeliveryJob } from "./contracts";

type EventRow = {
  id: string;
  event_type: string;
  title: string;
  body: string;
  message_class: "transactional" | "operational" | "lifecycle" | "marketing";
  topic: string | null;
  subject_type: string | null;
  subject_id: string | null;
  payload: Record<string, unknown> | null;
};

type RecipientRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  preferences: Record<string, unknown> | null;
};

function isTemplateKey(value: unknown): value is EmailTemplateKey {
  return (
    typeof value === "string" &&
    EMAIL_TEMPLATE_KEYS.includes(value as EmailTemplateKey)
  );
}

async function channelStillEnabled(
  db: SupabaseClient,
  job: NotificationDeliveryJob,
  event: EventRow,
) {
  const [
    { data: settings, error: settingsError },
    { data: preference, error: preferenceError },
    { data: mutes, error: muteError },
  ] = await Promise.all([
    db
      .from("notification_user_settings")
      .select("in_app_enabled,email_enabled,push_enabled")
      .eq("user_id", job.recipientId)
      .maybeSingle(),
    db
      .from("notification_preferences")
      .select("enabled,frequency")
      .eq("user_id", job.recipientId)
      .eq("event_type", event.event_type)
      .eq("channel", job.channel)
      .maybeSingle(),
    event.subject_type && event.subject_id
      ? db
          .from("notification_mutes")
          .select("id")
          .eq("user_id", job.recipientId)
          .eq("subject_type", event.subject_type)
          .eq("subject_id", event.subject_id)
          .in("channel", ["all", job.channel])
          .or(`muted_until.is.null,muted_until.gt.${new Date().toISOString()}`)
          .limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (settingsError) throw new Error(settingsError.message);
  if (preferenceError) throw new Error(preferenceError.message);
  if (muteError) throw new Error(muteError.message);
  if (mutes?.length) return false;
  const globalEnabled =
    job.channel === "in_app"
      ? settings?.in_app_enabled !== false
      : job.channel === "email"
        ? event.message_class === "transactional" ||
          settings?.email_enabled === true
        : settings?.push_enabled === true;
  return globalEnabled && preference?.enabled !== false;
}

function buildQueuedEmailCandidate(
  event: EventRow,
  recipient: RecipientRow,
  job: NotificationDeliveryJob,
) {
  const payload = event.payload ?? {};
  const templateKey = isTemplateKey(payload.templateKey)
    ? payload.templateKey
    : isTemplateKey(event.event_type)
      ? event.event_type
      : null;
  if (!templateKey) {
    throw new Error(
      `Notification event ${event.event_type} has no supported email template.`,
    );
  }
  if (!recipient.email)
    throw new Error("Notification recipient has no email address.");
  const locale: EmailLocale =
    payload.locale === "en" || recipient.preferences?.preferred_locale === "en"
      ? "en"
      : "vi";
  const category: EmailCategory = EMAIL_TEMPLATE_META[templateKey].category;
  const variables = buildTemplateVariables(templateKey, {
    userName:
      recipient.display_name || recipient.email.split("@")[0] || "debater",
    locale,
  });
  const variableOverrides: Record<string, unknown> =
    payload.variables &&
    typeof payload.variables === "object" &&
    !Array.isArray(payload.variables)
      ? (payload.variables as Record<string, unknown>)
      : {};
  Object.assign(variables, variableOverrides);
  variables.headline =
    typeof variableOverrides.headline === "string"
      ? variableOverrides.headline
      : event.title;
  variables.body =
    typeof variableOverrides.body === "string"
      ? variableOverrides.body
      : event.body;
  if (
    event.message_class === "lifecycle" ||
    event.message_class === "marketing"
  ) {
    const unsubscribe = buildUnsubscribeLinks({
      email: recipient.email,
      userId: recipient.id,
      category,
      templateKey,
    });
    variables.unsubscribeUrl = unsubscribe.unsubscribeUrl;
    variables.oneClickUnsubscribeUrl = unsubscribe.oneClickUnsubscribeUrl;
  } else {
    variables.unsubscribeUrl = undefined;
    variables.oneClickUnsubscribeUrl = undefined;
  }

  return {
    userId: recipient.id,
    toEmail: recipient.email,
    templateKey,
    category,
    locale,
    sendKey: job.idempotencyKey,
    subject: event.title,
    variables,
    messageClass: event.message_class,
    topic: (event.topic ?? undefined) as NotificationTopic | undefined,
    senderStream:
      event.message_class === "transactional" ||
      event.message_class === "operational"
        ? ("notifications" as const)
        : ("updates" as const),
    metadata: {
      notificationEventId: event.id,
      notificationDeliveryJobId: job.id,
    },
  };
}

export async function processNotificationDeliveryJob(
  db: SupabaseClient,
  job: NotificationDeliveryJob,
) {
  const [
    { data: event, error: eventError },
    { data: recipient, error: recipientError },
  ] = await Promise.all([
    db
      .from("notification_events")
      .select(
        "id,event_type,title,body,message_class,topic,subject_type,subject_id,payload",
      )
      .eq("id", job.eventId)
      .single(),
    db
      .from("profiles")
      .select("id,email,display_name,preferences")
      .eq("id", job.recipientId)
      .single(),
  ]);
  if (eventError || !event)
    throw new Error(eventError?.message ?? "Notification event not found.");
  if (recipientError || !recipient)
    throw new Error(
      recipientError?.message ?? "Notification recipient not found.",
    );
  const typedEvent = event as EventRow;
  if (!(await channelStillEnabled(db, job, typedEvent))) {
    return {
      success: true,
      providerMessageId: null,
      reason: "preference_disabled",
    };
  }
  if (job.channel === "in_app") {
    return {
      success: true,
      providerMessageId: null,
      reason: "inbox_materialized",
    };
  }
  if (job.channel === "push") {
    throw new Error("Push delivery is not configured.");
  }
  const outcome = await dispatchEmailCandidate({
    supabase: db,
    candidate: buildQueuedEmailCandidate(
      typedEvent,
      recipient as RecipientRow,
      job,
    ),
  });
  if (outcome.failed)
    throw new Error(outcome.reason ?? "Email delivery failed.");
  if (
    outcome.skipped &&
    !["active_suppression", "duplicate_send_key"].includes(outcome.reason ?? "")
  ) {
    throw new Error(outcome.reason ?? "Email delivery skipped.");
  }
  return { success: true, providerMessageId: null, reason: outcome.reason };
}
