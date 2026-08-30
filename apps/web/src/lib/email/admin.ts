import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailStatus } from "@/lib/email/types";

export interface EmailAdminKpi {
  key: string;
  label: string;
  value: number;
  tone: "neutral" | "success" | "warning" | "error";
}

export interface EmailTrendPoint {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  delayed: number;
  failed: number;
}

export interface EmailTemplatePerformance {
  templateKey: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
}

export interface EmailMessageAdminRow {
  id: string;
  toEmail: string;
  templateKey: string;
  category: string;
  locale: string;
  subject: string;
  status: string;
  errorMessage: string | null;
  skipReason: string | null;
  createdAt: string;
  streakMismatch: boolean;
}

export interface EmailWebhookAdminRow {
  id: string;
  eventType: string;
  resendEmailId: string | null;
  receivedAt: string;
  errorMessage: string | null;
}

export interface EmailCronAdminRow {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  candidateUsers: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  errorMessage: string | null;
}

export interface EmailSuppressionAdminRow {
  id: string;
  email: string;
  category: string | null;
  reason: string;
  source: string;
  createdAt: string;
}

export interface EmailDomainSummary {
  name: string;
  status: string;
  sending: string;
  receiving: string;
  openTracking: boolean | null;
  clickTracking: boolean | null;
}

export interface EmailAdminDashboardData {
  kpis: EmailAdminKpi[];
  trend: EmailTrendPoint[];
  templatePerformance: EmailTemplatePerformance[];
  recentMessages: EmailMessageAdminRow[];
  webhookEvents: EmailWebhookAdminRow[];
  cronRuns: EmailCronAdminRow[];
  suppressions: EmailSuppressionAdminRow[];
  domain: EmailDomainSummary;
  domains: EmailDomainSummary[];
  health: {
    accepted: number;
    delivered: number;
    delayed: number;
    bounced: number;
    complained: number;
    deliveryRate: number;
    delayedRate: number;
    bounceRate: number;
    complaintRate: number;
    complaintState: "healthy" | "warning" | "critical";
    bounceState: "healthy" | "warning" | "critical";
  };
}

interface EmailMessageRow {
  id: string;
  to_email: string;
  template_key: string;
  category: string;
  locale: string;
  subject: string;
  status: EmailStatus;
  sent_at: string | null;
  delayed_at: string | null;
  error_message: string | null;
  skip_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startDate(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

function isStatus(row: EmailMessageRow, statuses: EmailStatus[]) {
  return statuses.includes(row.status);
}

function countStatus(rows: EmailMessageRow[], statuses: EmailStatus[]) {
  return rows.filter((row) => isStatus(row, statuses)).length;
}

function buildTrend(rows: EmailMessageRow[]) {
  const points = new Map<string, EmailTrendPoint>();
  for (let index = 13; index >= 0; index -= 1) {
    const key = dateKey(new Date(Date.now() - index * 86_400_000));
    points.set(key, {
      date: key,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      delayed: 0,
      failed: 0,
    });
  }

  for (const row of rows) {
    const key = row.created_at.slice(0, 10);
    const point = points.get(key);
    if (!point) continue;

    if (row.sent_at) point.sent += 1;
    if (["delivered", "opened", "clicked"].includes(row.status))
      point.delivered += 1;
    if (["opened", "clicked"].includes(row.status)) point.opened += 1;
    if (row.status === "clicked") point.clicked += 1;
    if (row.delayed_at) {
      const delayedPoint = points.get(dateKey(new Date(row.delayed_at)));
      if (delayedPoint) delayedPoint.delayed += 1;
    }
    if (["failed", "bounced", "complained", "suppressed"].includes(row.status))
      point.failed += 1;
  }

  return Array.from(points.values());
}

function buildTemplatePerformance(rows: EmailMessageRow[]) {
  const map = new Map<string, EmailTemplatePerformance>();

  for (const row of rows) {
    const current = map.get(row.template_key) ?? {
      templateKey: row.template_key,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
    };

    if (row.sent_at) current.sent += 1;
    if (["delivered", "opened", "clicked"].includes(row.status))
      current.delivered += 1;
    if (["opened", "clicked"].includes(row.status)) current.opened += 1;
    if (row.status === "clicked") current.clicked += 1;
    if (["failed", "bounced", "complained", "suppressed"].includes(row.status))
      current.failed += 1;
    map.set(row.template_key, current);
  }

  return Array.from(map.values())
    .sort(
      (a, b) => b.sent - a.sent || a.templateKey.localeCompare(b.templateKey),
    )
    .slice(0, 8);
}

function fallbackDomainSummary(name = "unavailable"): EmailDomainSummary {
  return {
    name,
    status: "unknown",
    sending: "unknown",
    receiving: "unknown",
    openTracking: null,
    clickTracking: null,
  };
}

async function loadRecentMessages(supabase: SupabaseClient, since: string) {
  const rows: EmailMessageRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("email_messages")
      .select(
        "id, to_email, template_key, category, locale, subject, status, sent_at, delayed_at, error_message, skip_reason, metadata, created_at",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as EmailMessageRow[]));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return rows;
}

function percent(numerator: number, denominator: number) {
  return denominator > 0
    ? Math.round((numerator / denominator) * 10_000) / 100
    : 0;
}

async function getDomainSummaries() {
  const expectedDomains = ["notifications.thinkfy.net", "updates.thinkfy.net"];
  if (!process.env.RESEND_API_KEY) {
    return expectedDomains.map((name) => fallbackDomainSummary(name));
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const response = (await resend.domains.list()) as unknown as {
      data?: unknown;
      error?: { message?: string };
    };

    if (response.error) {
      return expectedDomains.map((name) => fallbackDomainSummary(name));
    }

    const rawData = response.data as
      | Array<Record<string, unknown>>
      | { data?: Array<Record<string, unknown>> }
      | undefined;
    const domains = Array.isArray(rawData) ? rawData : (rawData?.data ?? []);
    return expectedDomains.map((expectedName) => {
      const domain = domains.find((item) => item.name === expectedName);
      if (!domain) return fallbackDomainSummary(expectedName);
      const capabilities =
        typeof domain.capabilities === "object" && domain.capabilities !== null
          ? (domain.capabilities as Record<string, unknown>)
          : {};
      return {
        name: String(domain.name ?? expectedName),
        status: String(domain.status ?? "unknown"),
        sending: String(capabilities.sending ?? domain.sending ?? "unknown"),
        receiving: String(
          capabilities.receiving ?? domain.receiving ?? "unknown",
        ),
        openTracking:
          typeof domain.open_tracking === "boolean"
            ? domain.open_tracking
            : typeof domain.openTracking === "boolean"
              ? domain.openTracking
              : null,
        clickTracking:
          typeof domain.click_tracking === "boolean"
            ? domain.click_tracking
            : typeof domain.clickTracking === "boolean"
              ? domain.clickTracking
              : null,
      };
    });
  } catch {
    return expectedDomains.map((name) => fallbackDomainSummary(name));
  }
}

export async function getEmailAdminDashboardData(
  supabase: SupabaseClient,
): Promise<EmailAdminDashboardData> {
  const since = startDate(30).toISOString();
  const [messages, webhooksRes, cronRes, suppressionsRes, domains] =
    await Promise.all([
      loadRecentMessages(supabase, since),
      supabase
        .from("email_webhook_events")
        .select("id, event_type, resend_email_id, received_at, error_message")
        .order("received_at", { ascending: false })
        .limit(12),
      supabase
        .from("email_cron_runs")
        .select(
          "id, status, started_at, finished_at, candidate_users, sent_count, skipped_count, failed_count, error_message",
        )
        .order("started_at", { ascending: false })
        .limit(8),
      supabase
        .from("email_suppressions")
        .select("id, email, category, reason, source, created_at")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(12),
      getDomainSummaries(),
    ]);

  if (webhooksRes.error) throw new Error(webhooksRes.error.message);
  if (cronRes.error) throw new Error(cronRes.error.message);
  if (suppressionsRes.error) throw new Error(suppressionsRes.error.message);

  const accepted = messages.filter((message) => message.sent_at).length;
  const delivered = countStatus(messages, ["delivered", "opened", "clicked"]);
  const delayed = messages.filter((message) => message.delayed_at).length;
  const bounced = countStatus(messages, ["bounced"]);
  const complained = countStatus(messages, ["complained"]);
  const bounceRate = percent(bounced, accepted);
  const complaintRate = percent(complained, accepted);
  const kpis: EmailAdminKpi[] = [
    { key: "sent", label: "Accepted", value: accepted, tone: "neutral" },
    { key: "delivered", label: "Delivered", value: delivered, tone: "success" },
    {
      key: "delayed",
      label: "Delayed",
      value: delayed,
      tone: delayed > 0 ? "warning" : "success",
    },
    {
      key: "opened",
      label: "Opened",
      value: countStatus(messages, ["opened", "clicked"]),
      tone: "neutral",
    },
    {
      key: "clicked",
      label: "Clicked",
      value: countStatus(messages, ["clicked"]),
      tone: "success",
    },
    {
      key: "bounced",
      label: "Bounced",
      value: countStatus(messages, ["bounced"]),
      tone: "warning",
    },
    {
      key: "failed",
      label: "Failed",
      value: countStatus(messages, ["failed"]),
      tone: "error",
    },
    {
      key: "suppressed",
      label: "Suppressed",
      value: countStatus(messages, ["suppressed", "complained"]),
      tone: "warning",
    },
  ];

  return {
    kpis,
    trend: buildTrend(messages),
    templatePerformance: buildTemplatePerformance(messages),
    recentMessages: messages.slice(0, 20).map((message) => ({
      id: message.id,
      toEmail: message.to_email,
      templateKey: message.template_key,
      category: message.category,
      locale: message.locale,
      subject: message.subject,
      status: message.status,
      errorMessage: message.error_message,
      skipReason: message.skip_reason,
      createdAt: message.created_at,
      streakMismatch: Boolean(message.metadata?.streakMismatch),
    })),
    webhookEvents: (webhooksRes.data ?? []).map((event) => ({
      id: event.id,
      eventType: event.event_type,
      resendEmailId: event.resend_email_id,
      receivedAt: event.received_at,
      errorMessage: event.error_message,
    })),
    cronRuns: (cronRes.data ?? []).map((run) => ({
      id: run.id,
      status: run.status,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      candidateUsers: run.candidate_users,
      sentCount: run.sent_count,
      skippedCount: run.skipped_count,
      failedCount: run.failed_count,
      errorMessage: run.error_message,
    })),
    suppressions: (suppressionsRes.data ?? []).map((suppression) => ({
      id: suppression.id,
      email: suppression.email,
      category: suppression.category ?? null,
      reason: suppression.reason,
      source: suppression.source,
      createdAt: suppression.created_at,
    })),
    domain: domains[0] ?? fallbackDomainSummary(),
    domains,
    health: {
      accepted,
      delivered,
      delayed,
      bounced,
      complained,
      deliveryRate: percent(delivered, accepted),
      delayedRate: percent(delayed, accepted),
      bounceRate,
      complaintRate,
      complaintState:
        complaintRate >= 0.3
          ? "critical"
          : complaintRate >= 0.1
            ? "warning"
            : "healthy",
      bounceState:
        bounceRate >= 5 ? "critical" : bounceRate >= 2 ? "warning" : "healthy",
    },
  };
}
