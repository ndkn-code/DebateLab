import type { EmailStatus } from "@/lib/email/types";

const STATUS_RANK: Record<EmailStatus, number> = {
  queued: 0,
  skipped: 0,
  scheduled: 1,
  sent: 2,
  delivered: 3,
  opened: 4,
  clicked: 5,
  failed: 10,
  bounced: 11,
  suppressed: 12,
  complained: 13,
};

const EVENT_STATUS: Record<string, EmailStatus> = {
  "email.scheduled": "scheduled",
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.suppressed": "suppressed",
};

const STATUS_TIMESTAMP: Partial<Record<EmailStatus, string>> = {
  sent: "sent_at",
  scheduled: "sent_at",
  delivered: "delivered_at",
  opened: "opened_at",
  clicked: "clicked_at",
  bounced: "bounced_at",
  complained: "complained_at",
  failed: "failed_at",
  suppressed: "suppressed_at",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPayloadData(payload: Record<string, unknown>) {
  const data = payload.data;
  return isRecord(data) ? data : {};
}

export function getResendEventType(payload: Record<string, unknown>) {
  return getString(payload.type) || getString(payload.event) || "unknown";
}

export function getResendEmailId(payload: Record<string, unknown>) {
  const data = getPayloadData(payload);
  const nestedEmail = isRecord(data.email) ? data.email : {};

  return (
    getString(data.email_id) ||
    getString(data.emailId) ||
    getString(data.id) ||
    getString(nestedEmail.id) ||
    getString(nestedEmail.email_id)
  );
}

export function getResendRecipientEmail(payload: Record<string, unknown>) {
  const data = getPayloadData(payload);
  const candidate = data.to;

  if (Array.isArray(candidate)) {
    return getString(candidate[0]);
  }

  return getString(candidate) || getString(data.email);
}

export function shouldApplyProviderStatus(
  currentStatus: EmailStatus | string | null | undefined,
  nextStatus: EmailStatus
) {
  const current = (currentStatus ?? "queued") as EmailStatus;
  return (STATUS_RANK[nextStatus] ?? 0) >= (STATUS_RANK[current] ?? 0);
}

export function buildProviderStatusPatch(input: {
  eventType: string;
  currentStatus?: string | null;
  now?: Date;
}) {
  const nextStatus = EVENT_STATUS[input.eventType];
  if (!nextStatus || !shouldApplyProviderStatus(input.currentStatus, nextStatus)) {
    return {
      status: null,
      patch: {
        last_provider_event: input.eventType,
        updated_at: (input.now ?? new Date()).toISOString(),
      } as Record<string, unknown>,
    };
  }

  const now = (input.now ?? new Date()).toISOString();
  const patch: Record<string, unknown> = {
    status: nextStatus,
    last_provider_event: input.eventType,
    updated_at: now,
  };
  const timestampColumn = STATUS_TIMESTAMP[nextStatus];

  if (timestampColumn) {
    patch[timestampColumn] = now;
  }

  return { status: nextStatus, patch };
}

export function isSuppressionEvent(eventType: string) {
  return eventType === "email.bounced" || eventType === "email.complained" || eventType === "email.suppressed";
}

export function getSuppressionReason(eventType: string) {
  if (eventType === "email.complained") return "complaint";
  if (eventType === "email.suppressed") return "provider_suppressed";
  return "bounce";
}
