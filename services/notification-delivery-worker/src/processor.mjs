import { createClient } from "@supabase/supabase-js";
import { parseDeliveryJobRow } from "./contracts.mjs";
import { buildEmailContent, isEmailAllowed } from "./content.mjs";
import { sendResendEmail } from "./provider.mjs";

export class NonRetryableNotificationError extends Error {
  constructor(message) {
    super(message);
    this.name = "NonRetryableNotificationError";
  }
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function createProductionDependencies() {
  const supabase = createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  return { supabase, sendEmail: sendResendEmail };
}

let productionDependencies;
function dependencies() {
  productionDependencies ??= createProductionDependencies();
  return productionDependencies;
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] ?? null : data;
}

async function getJob(supabase, jobId) {
  const result = await supabase
    .from("notification_delivery_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data ? parseDeliveryJobRow(result.data) : null;
}

async function claimJob(supabase, message) {
  if (message.leaseToken) {
    const current = await getJob(supabase, message.jobId);
    if (!current || current.status !== "processing" || current.lease_token !== message.leaseToken) {
      throw new NonRetryableNotificationError("NOTIFICATION_DELIVERY_LEASE_NOT_FOUND");
    }
    return current;
  }
  const result = await supabase.rpc("claim_notification_delivery_job", {
    p_job_id: message.jobId,
    p_lease_seconds: Number(process.env.NOTIFICATION_DELIVERY_LEASE_SECONDS || 300),
  });
  if (result.error) {
    if (result.error.message.includes("NOTIFICATION_DELIVERY_JOB_NOT_CLAIMABLE")) {
      throw new NonRetryableNotificationError(result.error.message);
    }
    throw new Error(result.error.message);
  }
  const row = firstRow(result.data);
  if (!row) throw new NonRetryableNotificationError("NOTIFICATION_DELIVERY_JOB_NOT_CLAIMABLE");
  return parseDeliveryJobRow(row);
}

// Preference/mute reads are kept separate because subject-scoped mutes need
// event data before their query can be safely parameterized.
async function getDeliveryContext(supabase, job) {
  const eventResult = await supabase.from("notification_events").select("*").eq("id", job.event_id).single();
  const recipientResult = await supabase.from("profiles").select("id,email,display_name,preferences").eq("id", job.recipient_id).single();
  if (eventResult.error || !eventResult.data) throw new Error(eventResult.error?.message || "Notification event not found.");
  if (recipientResult.error || !recipientResult.data) throw new Error(recipientResult.error?.message || "Notification recipient not found.");
  const [settingsResult, preferenceResult, mutesResult] = await Promise.all([
    supabase.from("notification_user_settings").select("in_app_enabled,email_enabled,push_enabled").eq("user_id", job.recipient_id).maybeSingle(),
    supabase.from("notification_preferences").select("enabled,frequency").eq("user_id", job.recipient_id).eq("event_type", eventResult.data.event_type).eq("channel", job.channel).maybeSingle(),
    eventResult.data.subject_type && eventResult.data.subject_id
      ? supabase.from("notification_mutes").select("id").eq("user_id", job.recipient_id).eq("subject_type", eventResult.data.subject_type).eq("subject_id", eventResult.data.subject_id).in("channel", ["all", job.channel]).or(`muted_until.is.null,muted_until.gt.${new Date().toISOString()}`).limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (settingsResult.error) throw new Error(settingsResult.error.message);
  if (preferenceResult.error) throw new Error(preferenceResult.error.message);
  if (mutesResult.error) throw new Error(mutesResult.error.message);
  return {
    event: eventResult.data,
    recipient: recipientResult.data,
    settings: settingsResult.data,
    preference: preferenceResult.data,
    mutes: mutesResult.data ?? [],
  };
}

async function isSuppressed(supabase, email, category) {
  const result = await supabase
    .from("email_suppressions")
    .select("category")
    .ilike("email", email)
    .eq("active", true)
    .limit(20);
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []).some((row) => row.category === null || row.category === category);
}

async function insertEmailAudit(supabase, event, recipient, job, content) {
  const senderStream = event.message_class === "lifecycle" || event.message_class === "marketing" ? "updates" : "notifications";
  const result = await supabase.from("email_messages").insert({
    user_id: recipient.id,
    to_email: recipient.email,
    from_email: senderStream === "updates" ? (process.env.RESEND_LIFECYCLE_FROM || "Thinkfy Updates <hello@updates.thinkfy.net>") : (process.env.RESEND_TRANSACTIONAL_FROM || "Thinkfy Notifications <hello@notifications.thinkfy.net>"),
    reply_to: ["support@thinkfy.net"],
    template_key: content.templateKey,
    category: content.category,
    locale: content.locale,
    subject: content.subject,
    status: "queued",
    send_key: job.idempotency_key,
    variables: event.payload?.variables ?? {},
    tags: { template: content.templateKey, category: content.category, locale: content.locale, stream: senderStream },
    message_class: event.message_class,
    sender_stream: senderStream,
    notification_event_id: event.id,
    metadata: { notificationEventId: event.id, notificationDeliveryJobId: job.id, notificationTopic: event.topic },
  }).select("id").single();
  if (!result.error) return { id: result.data?.id, duplicate: false };
  if (result.error.code !== "23505") throw new Error(result.error.message);
  const existing = await supabase.from("email_messages").select("id,status,resend_email_id").eq("send_key", job.idempotency_key).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.status && ["sent", "delivered", "opened", "clicked"].includes(existing.data.status)) return { id: existing.data.id, duplicate: true, completed: true };
  return { id: existing.data?.id ?? null, duplicate: Boolean(existing.data?.id), completed: false };
}

async function updateEmailAudit(supabase, id, patch) {
  const result = await supabase.from("email_messages").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

async function processClaimedJob(job, injectedDependencies) {
  const { supabase, sendEmail } = injectedDependencies;
  const leaseToken = job.lease_token;
  if (!leaseToken) throw new Error("NOTIFICATION_DELIVERY_LEASE_MISSING");
  try {
    const context = await getDeliveryContext(supabase, job);
    const channelAllowed = job.channel === "in_app"
      ? context.settings?.in_app_enabled !== false && context.preference?.enabled !== false
      : job.channel === "email"
        ? isEmailAllowed({
            event: context.event,
            settings: context.settings,
            preference: context.preference,
            emailSendingEnabled: process.env.EMAILS_ENABLED !== "false",
            updatesSendingEnabled: process.env.NOTIFICATIONS_V2_EMAIL_ENABLED !== "false",
          })
        : context.settings?.push_enabled === true && context.preference?.enabled !== false;
    if (context.mutes.length || !channelAllowed) {
      const completion = await supabase.rpc("complete_notification_delivery_job", { p_job_id: job.id, p_lease_token: leaseToken, p_success: true, p_error: null, p_provider_message_id: null });
      if (completion.error) throw new Error(completion.error.message);
      return { outcome: "skipped", reason: "preference_disabled" };
    }
    if (job.channel === "in_app") {
      const completion = await supabase.rpc("complete_notification_delivery_job", { p_job_id: job.id, p_lease_token: leaseToken, p_success: true, p_error: null, p_provider_message_id: null });
      if (completion.error) throw new Error(completion.error.message);
      return { outcome: "completed", reason: "inbox_materialized" };
    }
    if (job.channel === "push") throw new Error("Push delivery is not configured.");
    if (!context.recipient.email) throw new Error("Notification recipient has no email address.");
    const content = buildEmailContent(context.event, context.recipient, job, process.env.APP_URL || "https://thinkfy.net");
    if (await isSuppressed(supabase, context.recipient.email, content.category)) {
      const completion = await supabase.rpc("complete_notification_delivery_job", { p_job_id: job.id, p_lease_token: leaseToken, p_success: true, p_error: null, p_provider_message_id: null });
      if (completion.error) throw new Error(completion.error.message);
      return { outcome: "skipped", reason: "email_suppressed" };
    }
    const audit = await insertEmailAudit(supabase, context.event, context.recipient, job, content);
    if (audit.completed) {
      const completion = await supabase.rpc("complete_notification_delivery_job", { p_job_id: job.id, p_lease_token: leaseToken, p_success: true, p_provider_message_id: null });
      if (completion.error) throw new Error(completion.error.message);
      return { outcome: "completed", reason: "duplicate_send_key" };
    }
    let provider;
    try {
      provider = await sendEmail({ event: context.event, recipient: context.recipient, content, job });
    } catch (error) {
      if (audit.id) {
        const retryable = error instanceof Error && error.retryable === true;
        try {
          await updateEmailAudit(supabase, audit.id, {
            status: retryable ? "delayed" : "failed",
            error_message: error instanceof Error ? error.message : "Notification provider failed.",
            ...(retryable ? { delayed_at: new Date().toISOString() } : { failed_at: new Date().toISOString() }),
          });
        } catch (auditError) {
          console.error("Could not update notification email audit after provider failure", {
            error: auditError instanceof Error ? auditError.message : "Unknown audit error",
            jobId: job.id,
          });
        }
      }
      throw error;
    }
    if (audit.id) await updateEmailAudit(supabase, audit.id, { status: "sent", resend_email_id: provider.providerMessageId, sent_at: new Date().toISOString() });
    const completion = await supabase.rpc("complete_notification_delivery_job", { p_job_id: job.id, p_lease_token: leaseToken, p_success: true, p_provider_message_id: provider.providerMessageId });
    if (completion.error) throw new Error(completion.error.message);
    return { outcome: "completed", providerMessageId: provider.providerMessageId };
  } catch (error) {
    if (error instanceof NonRetryableNotificationError) throw error;
    try {
      const completion = await supabase.rpc("complete_notification_delivery_job", { p_job_id: job.id, p_lease_token: leaseToken, p_success: false, p_error: error instanceof Error ? error.message : "Notification delivery failed." });
      if (completion.error) throw new Error(completion.error.message);
      return { outcome: "failed", reason: error instanceof Error ? error.message : "Notification delivery failed." };
    } catch (completionError) {
      throw completionError;
    }
  }
}

export async function processNotificationMessage(message, injectedDependencies) {
  const resolvedDependencies = injectedDependencies ?? dependencies();
  const job = await claimJob(resolvedDependencies.supabase, message);
  return processClaimedJob(job, resolvedDependencies);
}

export async function reconcileNotificationMessages(message, injectedDependencies) {
  const resolvedDependencies = injectedDependencies ?? dependencies();
  const numericLimit = Number(message.limit);
  const numericLeaseSeconds = Number(message.leaseSeconds);
  const limit = Number.isFinite(numericLimit) ? Math.max(1, Math.min(Math.trunc(numericLimit), 25)) : 25;
  const leaseSeconds = Number.isFinite(numericLeaseSeconds) ? Math.max(30, Math.min(Math.trunc(numericLeaseSeconds), 300)) : 300;
  const result = await resolvedDependencies.supabase.rpc("claim_notification_delivery_jobs", {
    p_limit: limit,
    p_lease_seconds: leaseSeconds,
  });
  if (result.error) throw new Error(result.error.message);
  const jobs = (Array.isArray(result.data) ? result.data : []).map(parseDeliveryJobRow);
  const outcomes = { claimed: jobs.length, completed: 0, skipped: 0, failed: 0 };
  for (const job of jobs) {
    const outcome = await processClaimedJob(job, resolvedDependencies);
    if (outcome.outcome === "completed") outcomes.completed += 1;
    else if (outcome.outcome === "skipped") outcomes.skipped += 1;
    else outcomes.failed += 1;
  }
  return { ...outcomes, followUpExpected: jobs.length === limit };
}
