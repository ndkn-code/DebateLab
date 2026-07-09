"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { updateSupportReportStatus } from "@/app/actions/support-reports";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDashed,
  ClipboardList,
  Clock3,
  ExternalLink,
  Filter,
  Globe,
  Laptop,
  Loader2,
  Paperclip,
  RefreshCw,
  Search,
  User,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChartCard, ChartEmpty, StatCard } from "@/components/data-viz";
import {
  FadeInItem,
  PageTransition,
  StaggeredContainer,
} from "@/components/shared/page-motion";
import {
  SUPPORT_REPORT_STATUS_LABELS,
  SUPPORT_REPORT_STATUSES,
  buildSupportReportStatusSummaryFromCounts,
  type SupportReport,
  type SupportReportsPageData,
  type SupportReportStatus,
} from "@/lib/support/support-reports-model";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";

type FilterParam = "status" | "severity" | "issue_type" | "source";

interface Props {
  data: SupportReportsPageData;
}

const STATUS_BADGE_CLASS: Record<SupportReportStatus, string> = {
  new: "border-warning/25 bg-warning-container text-on-warning-container",
  triaged: "border-info/25 bg-info-container text-info",
  in_progress: "border-primary/25 bg-primary-container text-on-primary-container",
  resolved: "border-success/25 bg-success-container text-success-dim",
  closed: "border-outline-variant bg-surface-container text-on-surface-variant",
};

const STATUS_ICON: Record<SupportReportStatus, typeof CircleDashed> = {
  new: CircleAlert,
  triaged: ClipboardList,
  in_progress: Clock3,
  resolved: CheckCircle2,
  closed: CircleDashed,
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function titleCase(value: string | null) {
  if (!value) return "Unspecified";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusLabel(status: SupportReportStatus) {
  return SUPPORT_REPORT_STATUS_LABELS[status];
}

function shiftStatusCount(
  counts: Record<SupportReportStatus, number>,
  previous: SupportReportStatus,
  next: SupportReportStatus
) {
  if (previous === next) return counts;
  return {
    ...counts,
    [previous]: Math.max(0, counts[previous] - 1),
    [next]: counts[next] + 1,
  };
}

function StatusPill({ status }: { status: SupportReportStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit items-center gap-1.5 rounded-full border px-2 text-xs font-semibold",
        STATUS_BADGE_CLASS[status]
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {statusLabel(status)}
    </span>
  );
}

function TextBadge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "severity" | "source";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center rounded-full border px-2 text-xs font-semibold",
        tone === "severity"
          ? "border-error/20 bg-error-container text-error-dim"
          : tone === "source"
            ? "border-info/20 bg-info-container text-info"
            : "border-outline-variant bg-surface-container text-on-surface-variant"
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-8 max-w-full rounded-full border px-3 text-xs font-semibold transition-all hover:-translate-y-0.5 active:scale-[0.98]",
        active
          ? "border-primary/25 bg-primary text-on-primary shadow-sm shadow-primary/20"
          : "border-outline-variant/40 bg-background text-on-surface-variant hover:border-primary/30 hover:bg-primary-container"
      )}
    >
      <span className="block truncate">{children}</span>
    </button>
  );
}

function FilterGroup({
  label,
  values,
  activeValue,
  onSelect,
}: {
  label: string;
  values: string[];
  activeValue: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-normal text-on-surface-variant">
        <Filter className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        <FilterChip active={activeValue === "all"} onClick={() => onSelect("all")}>
          All
        </FilterChip>
        {values.map((value) => (
          <FilterChip
            key={value}
            active={activeValue === value}
            onClick={() => onSelect(value)}
          >
            {titleCase(value)}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-72 overflow-auto rounded-lg border border-outline-variant/30 bg-surface-container p-3 text-xs leading-relaxed text-on-surface-variant">
      {formatJson(value)}
    </pre>
  );
}

function DetailField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-lg border border-outline-variant/25 bg-background p-3">
      <div className="mb-1 text-xs font-bold uppercase tracking-normal text-on-surface-variant">
        {label}
      </div>
      <div
        className={cn(
          "text-sm text-on-surface",
          multiline ? "whitespace-pre-wrap leading-relaxed" : "truncate"
        )}
      >
        {value || "-"}
      </div>
    </div>
  );
}

function ReportRow({
  report,
  onSelect,
}: {
  report: SupportReport;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="grid w-full grid-cols-[minmax(0,1.5fr)_170px_160px_150px_130px_120px] items-center gap-3 border-b border-outline-variant/15 px-4 py-3 text-left text-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container/60 hover:shadow-sm active:scale-[0.998]"
    >
      <div className="min-w-0">
        <div className="truncate font-semibold text-on-surface">{report.title}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <TextBadge>{titleCase(report.issueType)}</TextBadge>
          <TextBadge tone="severity">{titleCase(report.severity)}</TextBadge>
        </div>
      </div>
      <div className="min-w-0 text-on-surface-variant">
        <div className="truncate">{report.userEmail ?? "Unknown sender"}</div>
      </div>
      <div className="min-w-0">
        <TextBadge tone="source">{titleCase(report.source)}</TextBadge>
      </div>
      <div className="min-w-0 text-on-surface-variant">
        <div className="truncate font-mono text-xs">{report.route ?? "-"}</div>
      </div>
      <div className="text-on-surface-variant">
        {formatDateTime(report.submittedAt ?? report.createdAt)}
      </div>
      <div className="flex justify-end">
        <StatusPill status={report.status} />
      </div>
    </button>
  );
}

function ReportCard({
  report,
  onSelect,
}: {
  report: SupportReport;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="block w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md active:scale-[0.995]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-on-surface">
            {report.title}
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <TextBadge>{titleCase(report.issueType)}</TextBadge>
            <TextBadge tone="severity">{titleCase(report.severity)}</TextBadge>
          </div>
        </div>
        <StatusPill status={report.status} />
      </div>
      <div className="mt-4 grid gap-2 text-xs text-on-surface-variant">
        <div className="flex min-w-0 items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <span className="truncate">{report.userEmail ?? "Unknown sender"}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="truncate font-mono">{report.route ?? "-"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-primary" />
          {formatDateTime(report.submittedAt ?? report.createdAt)}
        </div>
      </div>
    </button>
  );
}

function DetailDrawer({
  report,
  pending,
  onOpenChange,
  onStatusChange,
}: {
  report: SupportReport | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (status: SupportReportStatus) => void;
}) {
  return (
    <Sheet open={Boolean(report)} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-outline-variant bg-surface-container-lowest p-0 text-on-surface sm:max-w-2xl"
      >
        {report && (
          <>
            <SheetHeader className="border-b border-outline-variant/30 p-5 pr-12">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={report.status} />
                <TextBadge>{titleCase(report.issueType)}</TextBadge>
                <TextBadge tone="severity">{titleCase(report.severity)}</TextBadge>
                <TextBadge tone="source">{titleCase(report.source)}</TextBadge>
              </div>
              <SheetTitle className="mt-3 text-xl font-bold text-on-surface">
                {report.title}
              </SheetTitle>
            </SheetHeader>

            <div className="space-y-5 p-5">
              <div className="rounded-lg border border-outline-variant/30 bg-background p-4">
                <label
                  htmlFor="support-report-status"
                  className="mb-2 block text-xs font-bold uppercase tracking-normal text-on-surface-variant"
                >
                  Status
                </label>
                <div className="flex items-center gap-3">
                  <Select
                    id="support-report-status"
                    value={report.status}
                    disabled={pending}
                    onChange={(event) =>
                      onStatusChange(event.target.value as SupportReportStatus)
                    }
                    className="h-10"
                  >
                    {SUPPORT_REPORT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </Select>
                  {pending && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  )}
                </div>
              </div>

              <section className="grid gap-3 md:grid-cols-2">
                <DetailField label="User email" value={report.userEmail} />
                <DetailField label="User ID" value={report.userId} />
                <DetailField label="Locale" value={report.locale} />
                <DetailField label="Route" value={report.route} />
                <DetailField label="Source" value={report.source} />
                <DetailField label="Contact permission" value={report.contactPermission} />
                <DetailField
                  label="Submitted"
                  value={formatDateTime(report.submittedAt ?? report.createdAt)}
                />
                <DetailField label="Updated" value={formatDateTime(report.updatedAt)} />
              </section>

              <section className="grid gap-3">
                <DetailField
                  label="Description"
                  value={report.description}
                  multiline
                />
                <DetailField
                  label="Expected behavior"
                  value={report.expectedBehavior}
                  multiline
                />
                <DetailField
                  label="Steps to reproduce"
                  value={report.stepsToReproduce}
                  multiline
                />
              </section>

              <section className="grid gap-3 md:grid-cols-2">
                <DetailField label="Tally event" value={report.tallyEventId} />
                <DetailField label="Tally response" value={report.tallyResponseId} />
                <DetailField label="Tally submission" value={report.tallySubmissionId} />
                <DetailField label="Tally form" value={report.tallyFormId} />
                <DetailField label="Tally form name" value={report.tallyFormName} />
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-on-surface">
                  <Paperclip className="h-4 w-4 text-primary" />
                  Attachments
                </div>
                {report.attachments.length ? (
                  <div className="grid gap-2">
                    {report.attachments.map((attachment, index) => {
                      const label =
                        typeof attachment.name === "string"
                          ? attachment.name
                          : `Attachment ${index + 1}`;
                      const url =
                        typeof attachment.url === "string" ? attachment.url : null;
                      return (
                        <div
                          key={`${label}-${index}`}
                          className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-outline-variant/25 bg-background px-3 py-2 text-sm"
                        >
                          <span className="truncate text-on-surface">{label}</span>
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              Open
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-outline-variant/25 bg-background px-3 py-2 text-sm text-on-surface-variant">
                    No attachments
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-on-surface">
                  <Laptop className="h-4 w-4 text-primary" />
                  Environment
                </div>
                <JsonBlock value={report.environment} />
              </section>

              <section className="space-y-3">
                <div className="text-sm font-bold text-on-surface">Hidden fields</div>
                <JsonBlock value={report.hiddenFields} />
              </section>

              <details className="rounded-lg border border-outline-variant/30 bg-background p-3">
                <summary className="cursor-pointer text-sm font-bold text-on-surface">
                  Raw payload
                </summary>
                <div className="mt-3">
                  <JsonBlock value={report.rawPayload} />
                </div>
              </details>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function SupportReportsDashboard({ data }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reports, setReports] = useState(data.reports);
  const [statusCounts, setStatusCounts] = useState(data.kpis.statusCounts);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [pendingReportId, setPendingReportId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setReports(data.reports);
    setStatusCounts(data.kpis.statusCounts);
  }, [data.kpis.statusCounts, data.reports]);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? null,
    [reports, selectedReportId]
  );
  const kpis = useMemo(() => {
    const summary = buildSupportReportStatusSummaryFromCounts(statusCounts);
    return { ...summary, totalCount: data.kpis.totalCount };
  }, [data.kpis.totalCount, statusCounts]);

  function pushWithParam(key: FilterParam | "search" | "page", value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (key !== "page") next.set("page", "1");
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);

    const qs = next.toString();
    router.push(qs ? `/dashboard/admin/reports?${qs}` : "/dashboard/admin/reports");
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    pushWithParam("search", String(formData.get("search") ?? "").trim());
  }

  function handleStatusChange(id: string, nextStatus: SupportReportStatus) {
    const previous = reports.find((report) => report.id === id);
    if (!previous || previous.status === nextStatus) return;

    setPendingReportId(id);
    setReports((current) =>
      current.map((report) =>
        report.id === id ? { ...report, status: nextStatus } : report
      )
    );
    setStatusCounts((current) =>
      shiftStatusCount(current, previous.status, nextStatus)
    );

    startTransition(async () => {
      try {
        const updated = await updateSupportReportStatus({
          id,
          status: nextStatus,
        });
        setReports((current) =>
          current.map((report) => (report.id === id ? updated : report))
        );
        toast.success("Report status updated");
        router.refresh();
      } catch (error) {
        setReports((current) =>
          current.map((report) => (report.id === id ? previous : report))
        );
        setStatusCounts((current) =>
          shiftStatusCount(current, nextStatus, previous.status)
        );
        toast.error(
          error instanceof Error ? error.message : "Unable to update report status"
        );
      } finally {
        setPendingReportId(null);
      }
    });
  }

  const statusValues = SUPPORT_REPORT_STATUSES.map((status) => ({
    status,
    label: statusLabel(status),
    value: kpis.statusCounts[status],
    icon: STATUS_ICON[status],
  }));

  return (
    <PageTransition className="min-h-full bg-surface-container text-on-surface-variant">
      <header className="border-b border-sidebar-muted/15 bg-sidebar px-5 py-5 text-sidebar-foreground md:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-normal text-sidebar-foreground md:text-3xl">
              Question / Bug Reports
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="primary">{data.totalCount} matching</Badge>
              <Badge variant="warning">{kpis.openCount} open</Badge>
              <Badge variant="success">{kpis.resolvedCount} done</Badge>
            </div>
          </div>
          <Button
            variant="outline"
            className="h-9 gap-2 self-start rounded-lg"
            onClick={() => router.refresh()}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      <main className="space-y-6 px-5 py-5 md:px-7">
        {data.loadError && (
          <div className="rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm text-error-dim">
            {data.loadError}
          </div>
        )}

        <StaggeredContainer className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard
            icon={<AlertCircle className="h-5 w-5" />}
            label="Open queue"
            value={kpis.openCount}
          />
          {statusValues.map((metric) => {
            const Icon = metric.icon;
            return (
              <StatCard
                key={metric.status}
                icon={<Icon className="h-5 w-5" />}
                label={metric.label}
                value={metric.value}
              />
            );
          })}
        </StaggeredContainer>

        <FadeInItem>
          <ChartCard
            className="rounded-lg"
            title="Report filters"
            actions={
              <Badge variant="outline" className="h-6">
                Page {data.page} / {data.pageCount}
              </Badge>
            }
          >
            <div className="space-y-4">
              <form
                onSubmit={handleSearchSubmit}
                className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_auto]"
              >
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                  <Input
                    name="search"
                    defaultValue={data.filters.search}
                    placeholder="Search title, description, or email"
                    className="h-10 pl-9"
                  />
                </label>
                <Button type="submit" className="h-10 gap-2">
                  <Search className="h-4 w-4" />
                  Search
                </Button>
              </form>

              <div className="grid gap-4 xl:grid-cols-2">
                <FilterGroup
                  label="Status"
                  activeValue={data.filters.status}
                  values={[...SUPPORT_REPORT_STATUSES]}
                  onSelect={(value) => pushWithParam("status", value)}
                />
                <FilterGroup
                  label="Severity"
                  activeValue={data.filters.severity}
                  values={data.facets.severities}
                  onSelect={(value) => pushWithParam("severity", value)}
                />
                <FilterGroup
                  label="Issue type"
                  activeValue={data.filters.issueType}
                  values={data.facets.issueTypes}
                  onSelect={(value) => pushWithParam("issue_type", value)}
                />
                <FilterGroup
                  label="Source"
                  activeValue={data.filters.source}
                  values={data.facets.sources}
                  onSelect={(value) => pushWithParam("source", value)}
                />
              </div>
            </div>
          </ChartCard>
        </FadeInItem>

        <FadeInItem>
          <ChartCard
            className="rounded-lg"
            title="Triage queue"
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => pushWithParam("page", String(data.page - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page >= data.pageCount}
                  onClick={() => pushWithParam("page", String(data.page + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            }
          >
            {reports.length ? (
              <>
                <div className="hidden overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest md:block">
                  <div className="grid grid-cols-[minmax(0,1.5fr)_170px_160px_150px_130px_120px] gap-3 border-b border-outline-variant/20 bg-surface-container px-4 py-2 text-xs font-bold uppercase tracking-normal text-on-surface-variant">
                    <div>Report</div>
                    <div>Sender</div>
                    <div>Source</div>
                    <div>Route</div>
                    <div>Submitted</div>
                    <div className="text-right">Status</div>
                  </div>
                  <StaggeredContainer>
                    {reports.map((report) => (
                      <FadeInItem key={report.id}>
                        <ReportRow
                          report={report}
                          onSelect={() => setSelectedReportId(report.id)}
                        />
                      </FadeInItem>
                    ))}
                  </StaggeredContainer>
                </div>

                <StaggeredContainer className="grid gap-3 md:hidden">
                  {reports.map((report) => (
                    <FadeInItem key={report.id}>
                      <ReportCard
                        report={report}
                        onSelect={() => setSelectedReportId(report.id)}
                      />
                    </FadeInItem>
                  ))}
                </StaggeredContainer>
              </>
            ) : (
              <ChartEmpty
                title="No reports match these filters"
                description="Clear a filter or search term to widen the queue."
              />
            )}
          </ChartCard>
        </FadeInItem>
      </main>

      <DetailDrawer
        report={selectedReport}
        pending={pendingReportId === selectedReport?.id}
        onOpenChange={(open) => {
          if (!open) setSelectedReportId(null);
        }}
        onStatusChange={(status) => {
          if (selectedReport) handleStatusChange(selectedReport.id, status);
        }}
      />
    </PageTransition>
  );
}
