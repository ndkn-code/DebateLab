export const SUPPORT_REPORT_STATUSES = [
  "new",
  "triaged",
  "in_progress",
  "resolved",
  "closed",
] as const;

export type SupportReportStatus = (typeof SUPPORT_REPORT_STATUSES)[number];

export const SUPPORT_REPORT_STATUS_LABELS: Record<SupportReportStatus, string> = {
  new: "New",
  triaged: "Triaged",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const SUPPORT_REPORT_OPEN_STATUSES = [
  "new",
  "triaged",
  "in_progress",
] as const satisfies readonly SupportReportStatus[];

export const SUPPORT_REPORT_DONE_STATUSES = [
  "resolved",
  "closed",
] as const satisfies readonly SupportReportStatus[];

export const DEFAULT_SUPPORT_REPORTS_PAGE_SIZE = 12;

export interface RawSupportReportRow {
  id: string;
  tally_event_id: string;
  tally_response_id: string | null;
  tally_submission_id: string | null;
  tally_form_id: string | null;
  tally_form_name: string | null;
  user_id: string | null;
  user_email: string | null;
  locale: string | null;
  route: string | null;
  source: string | null;
  issue_type: string | null;
  severity: string | null;
  title: string | null;
  description: string | null;
  expected_behavior: string | null;
  steps_to_reproduce: string | null;
  contact_permission: string | null;
  attachments: unknown;
  environment: unknown;
  hidden_fields: unknown;
  raw_payload: unknown;
  status: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportReport {
  id: string;
  tallyEventId: string;
  tallyResponseId: string | null;
  tallySubmissionId: string | null;
  tallyFormId: string | null;
  tallyFormName: string | null;
  userId: string | null;
  userEmail: string | null;
  locale: string | null;
  route: string | null;
  source: string;
  issueType: string | null;
  severity: string | null;
  title: string;
  description: string | null;
  expectedBehavior: string | null;
  stepsToReproduce: string | null;
  contactPermission: string | null;
  attachments: Record<string, unknown>[];
  environment: Record<string, unknown>;
  hiddenFields: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
  status: SupportReportStatus;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportReportsFilters {
  status: SupportReportStatus | "all";
  severity: string;
  issueType: string;
  source: string;
  search: string;
  page: number;
}

export interface SupportReportsFacets {
  severities: string[];
  issueTypes: string[];
  sources: string[];
}

export interface SupportReportStatusSummary {
  statusCounts: Record<SupportReportStatus, number>;
  openCount: number;
  resolvedCount: number;
}

export interface SupportReportsKpis extends SupportReportStatusSummary {
  totalCount: number;
}

export interface SupportReportsPageData {
  reports: SupportReport[];
  filters: SupportReportsFilters;
  facets: SupportReportsFacets;
  kpis: SupportReportsKpis;
  page: number;
  pageSize: number;
  totalCount: number;
  pageCount: number;
  loadError: string | null;
}

const STATUS_SET = new Set<string>(SUPPORT_REPORT_STATUSES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeFacetValue(value: string | null | undefined) {
  return normalizeNullableText(value) ?? "all";
}

function normalizePage(value: string | number | null | undefined) {
  const page = Number(value ?? 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function normalizeSearch(value: string | null | undefined) {
  return value?.trim().slice(0, 160) ?? "";
}

export function isSupportReportStatus(value: unknown): value is SupportReportStatus {
  return typeof value === "string" && STATUS_SET.has(value);
}

export function normalizeSupportReportStatus(
  value: string | null | undefined
): SupportReportStatus | "all" {
  if (value === "all" || value == null || value === "") return "all";
  return isSupportReportStatus(value) ? value : "all";
}

export function normalizeSupportReportsFilters(
  input: Partial<Record<"status" | "severity" | "issueType" | "source" | "search" | "page", string | number | null | undefined>>
): SupportReportsFilters {
  return {
    status: normalizeSupportReportStatus(typeof input.status === "number" ? String(input.status) : input.status),
    severity: normalizeFacetValue(typeof input.severity === "number" ? String(input.severity) : input.severity),
    issueType: normalizeFacetValue(typeof input.issueType === "number" ? String(input.issueType) : input.issueType),
    source: normalizeFacetValue(typeof input.source === "number" ? String(input.source) : input.source),
    search: normalizeSearch(typeof input.search === "number" ? String(input.search) : input.search),
    page: normalizePage(input.page),
  };
}

export function mapSupportReportRow(row: RawSupportReportRow): SupportReport {
  const description = normalizeNullableText(row.description);
  const issueType = normalizeNullableText(row.issue_type);
  const title =
    normalizeNullableText(row.title) ??
    description?.split(/\r?\n/).find((line) => line.trim())?.trim().slice(0, 160) ??
    issueType ??
    "Support issue report";

  return {
    id: row.id,
    tallyEventId: row.tally_event_id,
    tallyResponseId: row.tally_response_id,
    tallySubmissionId: row.tally_submission_id,
    tallyFormId: row.tally_form_id,
    tallyFormName: row.tally_form_name,
    userId: row.user_id,
    userEmail: normalizeNullableText(row.user_email),
    locale: normalizeNullableText(row.locale),
    route: normalizeNullableText(row.route),
    source: normalizeNullableText(row.source) ?? "tally",
    issueType,
    severity: normalizeNullableText(row.severity),
    title,
    description,
    expectedBehavior: normalizeNullableText(row.expected_behavior),
    stepsToReproduce: normalizeNullableText(row.steps_to_reproduce),
    contactPermission: normalizeNullableText(row.contact_permission),
    attachments: toRecordArray(row.attachments),
    environment: toRecord(row.environment),
    hiddenFields: toRecord(row.hidden_fields),
    rawPayload: toRecord(row.raw_payload),
    status: isSupportReportStatus(row.status) ? row.status : "new",
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildSupportReportStatusSummaryFromCounts(
  counts: Partial<Record<SupportReportStatus, number>>
): SupportReportStatusSummary {
  const statusCounts = SUPPORT_REPORT_STATUSES.reduce(
    (acc, status) => {
      acc[status] = Math.max(0, Math.floor(counts[status] ?? 0));
      return acc;
    },
    {} as Record<SupportReportStatus, number>
  );

  return {
    statusCounts,
    openCount: SUPPORT_REPORT_OPEN_STATUSES.reduce(
      (sum, status) => sum + statusCounts[status],
      0
    ),
    resolvedCount: SUPPORT_REPORT_DONE_STATUSES.reduce(
      (sum, status) => sum + statusCounts[status],
      0
    ),
  };
}

export function summarizeSupportReportStatuses(
  reports: Array<{ status: SupportReportStatus }>
): SupportReportStatusSummary {
  const counts = SUPPORT_REPORT_STATUSES.reduce(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    {} as Record<SupportReportStatus, number>
  );

  for (const report of reports) {
    counts[report.status] += 1;
  }

  return buildSupportReportStatusSummaryFromCounts(counts);
}

export function buildSupportReportFacets(reports: SupportReport[]): SupportReportsFacets {
  const collect = (getValue: (report: SupportReport) => string | null) =>
    [...new Set(reports.map(getValue).filter((value): value is string => Boolean(value)))]
      .sort((a, b) => a.localeCompare(b));

  return {
    severities: collect((report) => report.severity),
    issueTypes: collect((report) => report.issueType),
    sources: collect((report) => report.source),
  };
}

export function filterSupportReports(
  reports: SupportReport[],
  filters: SupportReportsFilters
) {
  const query = filters.search.toLowerCase();

  return reports.filter((report) => {
    if (filters.status !== "all" && report.status !== filters.status) return false;
    if (filters.severity !== "all" && report.severity !== filters.severity) return false;
    if (filters.issueType !== "all" && report.issueType !== filters.issueType) return false;
    if (filters.source !== "all" && report.source !== filters.source) return false;
    if (!query) return true;

    const haystack = [
      report.title,
      report.description,
      report.userEmail,
      report.route,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function buildSupportReportsViewModel({
  reports,
  filters,
  pageSize = DEFAULT_SUPPORT_REPORTS_PAGE_SIZE,
}: {
  reports: SupportReport[];
  filters: SupportReportsFilters;
  pageSize?: number;
}): SupportReportsPageData {
  const filtered = filterSupportReports(reports, filters);
  const totalCount = filtered.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(filters.page, pageCount);
  const start = (page - 1) * pageSize;
  const pagedReports = filtered.slice(start, start + pageSize);
  const statusSummary = summarizeSupportReportStatuses(filtered);

  return {
    reports: pagedReports,
    filters: { ...filters, page },
    facets: buildSupportReportFacets(reports),
    kpis: {
      ...statusSummary,
      totalCount,
    },
    page,
    pageSize,
    totalCount,
    pageCount,
    loadError: null,
  };
}
