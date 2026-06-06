"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  MousePointerClick,
  RefreshCw,
  Send,
  ShieldCheck,
  TrendingUp,
} from "@/components/ui/icons";
import { EmailTemplateEditor } from "@/components/admin/emails/EmailTemplateEditor";
import type { EmailAdminDashboardData, EmailAdminKpi } from "@/lib/email/admin";
import { cn } from "@/lib/utils";

interface Props {
  data: EmailAdminDashboardData;
}

const toneClass: Record<EmailAdminKpi["tone"], string> = {
  neutral: "border-outline-variant/40 bg-surface-container-lowest text-primary",
  success: "border-secondary/20 bg-secondary-container/50 text-secondary-dim",
  warning: "border-warning/25 bg-surface-container text-on-surface-variant",
  error: "border-error/20 bg-error-container/60 text-error-dim",
};

const statusClass: Record<string, string> = {
  queued: "bg-surface-container text-on-surface-variant",
  skipped: "bg-surface-container text-on-surface-variant",
  started: "bg-primary-container text-primary-dim",
  success: "bg-secondary-container text-secondary-dim",
  error: "bg-error-container text-error-dim",
  sent: "bg-primary-container text-primary-dim",
  scheduled: "bg-primary-container text-primary-dim",
  delivered: "bg-secondary-container text-secondary-dim",
  opened: "bg-surface-container text-on-surface-variant",
  clicked: "bg-secondary-container text-secondary-dim",
  bounced: "bg-surface-container text-on-surface-variant",
  complained: "bg-error-container text-error-dim",
  failed: "bg-error-container text-error-dim",
  suppressed: "bg-surface-container text-on-surface-variant",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function KpiIcon({ kpiKey }: { kpiKey: string }) {
  if (kpiKey === "sent") return <Send className="h-5 w-5" />;
  if (kpiKey === "delivered") return <CheckCircle2 className="h-5 w-5" />;
  if (kpiKey === "opened") return <Activity className="h-5 w-5" />;
  if (kpiKey === "clicked") return <MousePointerClick className="h-5 w-5" />;
  if (kpiKey === "failed" || kpiKey === "bounced") return <AlertTriangle className="h-5 w-5" />;
  if (kpiKey === "suppressed") return <ShieldCheck className="h-5 w-5" />;
  return <Mail className="h-5 w-5" />;
}

export function EmailMonitorDashboard({ data }: Props) {
  const [activeTab, setActiveTab] = useState<"monitor" | "templates">("monitor");
  const maxTrend = Math.max(
    1,
    ...data.trend.map((point) => Math.max(point.sent, point.delivered, point.opened, point.clicked, point.failed))
  );

  return (
    <div className="mx-auto max-w-7xl min-w-0 space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">
            Email Monitor
          </h1>
          <p className="mt-1 w-full max-w-[calc(100vw-2rem)] text-sm leading-6 text-on-surface-variant sm:max-w-2xl">
            Monitor email delivery, engagement, and system health for Thinkfy emails via Resend.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="inline-flex h-11 items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-4 text-sm font-semibold text-on-surface-variant shadow-token-card">
            <CalendarDays className="h-4 w-4 text-primary" />
            Last 14 days
          </div>
          <div className="inline-flex h-11 items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-4 text-sm font-semibold text-on-surface-variant shadow-token-card">
            <RefreshCw className="h-4 w-4 text-primary" />
            Refresh
          </div>
        </div>
      </div>

      <div className="inline-flex rounded-lg border border-outline-variant/50 bg-surface-container-low p-1">
        {[
          { key: "monitor", label: "Monitor" },
          { key: "templates", label: "Templates" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as "monitor" | "templates")}
            className={cn(
              "h-9 rounded-md px-5 text-sm font-bold transition-colors",
              activeTab === tab.key
                ? "bg-primary text-on-primary shadow-sm shadow-primary/20"
                : "text-on-surface-variant hover:bg-surface-container-lowest"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "templates" ? (
        <EmailTemplateEditor />
      ) : (
        <>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {data.kpis.map((kpi) => (
          <div
            key={kpi.key}
            className="min-w-0 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-token-card"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-full border ${toneClass[kpi.tone]}`}>
                <KpiIcon kpiKey={kpi.key} />
              </div>
              <p className="text-sm font-semibold text-on-surface-variant">{kpi.label}</p>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-on-surface">{kpi.value.toLocaleString()}</p>
            <p className="mt-3 text-xs font-semibold text-on-surface-variant">
              <span className={kpi.tone === "error" || kpi.tone === "warning" ? "text-error-dim" : "text-secondary-dim"}>
                {kpi.tone === "error" || kpi.tone === "warning" ? "Risk tracked" : "Healthy"}
              </span>{" "}
              vs current window
            </p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="min-w-0 rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-token-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-on-surface">Delivery health</h2>
              <p className="text-sm text-on-surface-variant">Last 14 days across user lifecycle sends.</p>
            </div>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-6 flex h-56 items-end gap-2 border-b border-outline-variant/50 pb-3">
            {data.trend.map((point) => (
              <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-44 w-full items-end justify-center gap-1">
                  <span className="w-2 rounded-t bg-primary" style={{ height: `${Math.max(3, (point.sent / maxTrend) * 100)}%` }} />
                  <span className="w-2 rounded-t bg-secondary" style={{ height: `${Math.max(3, (point.delivered / maxTrend) * 100)}%` }} />
                  <span className="w-2 rounded-t bg-surface-container-high" style={{ height: `${Math.max(3, (point.opened / maxTrend) * 100)}%` }} />
                  <span className="w-2 rounded-t bg-error" style={{ height: `${Math.max(3, (point.failed / maxTrend) * 100)}%` }} />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground">{point.date.slice(5)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-on-surface-variant">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Sent</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-secondary" /> Delivered</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-surface-container-high" /> Opened</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-error" /> Failed</span>
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-3xl border border-outline-variant/40 bg-surface-container-lowest shadow-token-card">
          <div className="flex items-center justify-between border-b border-outline-variant/40 px-5 py-4">
            <h2 className="text-lg font-bold text-on-surface">Template performance</h2>
            <span className="text-xs font-bold text-primary">View all</span>
          </div>
          <div className="overflow-x-auto">
            {data.templatePerformance.length === 0 ? (
              <p className="m-5 rounded-2xl bg-surface-container p-4 text-sm text-on-surface-variant">
                No template sends yet.
              </p>
            ) : (
              <table className="min-w-[560px] text-left text-sm">
                <thead className="bg-surface-container text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-bold">Template</th>
                    <th className="px-4 py-3 font-bold">Sent</th>
                    <th className="px-4 py-3 font-bold">Delivered</th>
                    <th className="px-4 py-3 font-bold">Open rate</th>
                    <th className="px-4 py-3 font-bold">Click rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {data.templatePerformance.map((template) => {
                    const openRate = template.sent > 0 ? Math.round((template.opened / template.sent) * 100) : 0;
                    const clickRate = template.sent > 0 ? Math.round((template.clicked / template.sent) * 100) : 0;
                    const deliveredRate = template.sent > 0 ? Math.round((template.delivered / template.sent) * 100) : 0;

                    return (
                      <tr key={template.templateKey}>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-on-surface">{template.templateKey.replaceAll("_", " ")}</p>
                          <p className="text-xs text-muted-foreground">{template.templateKey}</p>
                        </td>
                        <td className="px-4 py-4 text-on-surface-variant">{template.sent.toLocaleString()}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-on-surface">{template.delivered.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{deliveredRate}%</p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className="w-10 text-xs font-semibold text-on-surface">{openRate}%</span>
                            <span className="h-1.5 w-16 rounded-full bg-surface-container">
                              <span className="block h-1.5 rounded-full bg-primary" style={{ width: `${openRate}%` }} />
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className="w-10 text-xs font-semibold text-on-surface">{clickRate}%</span>
                            <span className="h-1.5 w-16 rounded-full bg-surface-container">
                              <span className="block h-1.5 rounded-full bg-primary" style={{ width: `${clickRate}%` }} />
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="min-w-0 overflow-hidden rounded-3xl border border-outline-variant/40 bg-surface-container-lowest shadow-token-card">
          <div className="border-b border-outline-variant/40 px-5 py-4">
            <h2 className="text-lg font-bold text-on-surface">Recent sends</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-container text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-bold">Recipient</th>
                  <th className="px-5 py-3 font-bold">Template</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {data.recentMessages.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-on-surface-variant">
                      No sends have been recorded yet.
                    </td>
                  </tr>
                ) : (
                  data.recentMessages.map((message) => (
                    <tr key={message.id}>
                      <td className="max-w-[220px] truncate px-5 py-4 text-on-surface">{message.toEmail}</td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-on-surface">{message.templateKey.replaceAll("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">{message.locale} · {message.category}</p>
                        {message.streakMismatch ? (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">
                            <AlertTriangle className="h-3 w-3" />
                            Streak repaired
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass[message.status] ?? statusClass.queued}`}>
                          {message.status}
                        </span>
                        {message.errorMessage || message.skipReason ? (
                          <p className="mt-1 max-w-[240px] truncate text-xs text-muted-foreground">
                            {message.errorMessage ?? message.skipReason}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-on-surface-variant">{formatDate(message.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-token-card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-on-surface">Webhook health</h2>
              <CheckCircle2 className="h-5 w-5 text-secondary" />
            </div>
            <div className="mt-4 space-y-3">
              {data.webhookEvents.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No webhook errors or events yet.</p>
              ) : (
                data.webhookEvents.slice(0, 5).map((event) => (
                  <div key={event.id} className="rounded-2xl bg-surface-container-low p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-on-surface">{event.eventType}</p>
                      <span className="text-xs text-muted-foreground">{formatDate(event.receivedAt)}</span>
                    </div>
                    {event.errorMessage ? <p className="mt-1 text-xs text-error-dim">{event.errorMessage}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-token-card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-on-surface">Cron run history</h2>
              <Clock3 className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-4 space-y-3">
              {data.cronRuns.length === 0 ? (
                <p className="text-sm text-on-surface-variant">Email dispatch has not run yet.</p>
              ) : (
                data.cronRuns.slice(0, 5).map((run) => (
                  <div key={run.id} className="rounded-2xl bg-surface-container-low p-3">
                    <div className="flex items-center justify-between">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass[run.status] ?? statusClass.queued}`}>
                        {run.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(run.startedAt)}</span>
                    </div>
                    <p className="mt-2 text-xs text-on-surface-variant">
                      {run.sentCount} sent · {run.skippedCount} skipped · {run.failedCount} failed
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-token-card">
            <h2 className="text-lg font-bold text-on-surface">Suppression list</h2>
            <div className="mt-4 space-y-3">
              {data.suppressions.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No active suppressions.</p>
              ) : (
                data.suppressions.slice(0, 5).map((suppression) => (
                  <div key={suppression.id} className="rounded-2xl bg-surface-container-low p-3">
                    <p className="truncate text-sm font-semibold text-on-surface">{suppression.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {suppression.reason} · {suppression.category ?? "all streams"} · {suppression.source}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-token-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-on-surface">Domain summary</h2>
                <p className="mt-1 text-sm font-semibold text-secondary-dim">
                  {data.domain.name} {data.domain.status}
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-secondary" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl bg-surface-container-low p-3">
                <p className="font-bold text-muted-foreground">Sending</p>
                <p className="mt-1 font-semibold text-on-surface">{data.domain.sending}</p>
              </div>
              <div className="rounded-2xl bg-surface-container-low p-3">
                <p className="font-bold text-muted-foreground">Receiving</p>
                <p className="mt-1 font-semibold text-on-surface">{data.domain.receiving}</p>
              </div>
              <div className="rounded-2xl bg-surface-container-low p-3">
                <p className="font-bold text-muted-foreground">Open tracking</p>
                <p className="mt-1 font-semibold text-on-surface">
                  {data.domain.openTracking === null ? "Unknown" : data.domain.openTracking ? "Enabled" : "Disabled"}
                </p>
              </div>
              <div className="rounded-2xl bg-surface-container-low p-3">
                <p className="font-bold text-muted-foreground">Click tracking</p>
                <p className="mt-1 font-semibold text-on-surface">
                  {data.domain.clickTracking === null ? "Unknown" : data.domain.clickTracking ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
        </>
      )}
    </div>
  );
}
