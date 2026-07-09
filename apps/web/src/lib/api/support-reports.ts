import "server-only";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEV_ADMIN_PROFILE, isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import { createTypedServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_SUPPORT_REPORTS_PAGE_SIZE,
  SUPPORT_REPORT_STATUSES,
  buildSupportReportFacets,
  buildSupportReportStatusSummaryFromCounts,
  isSupportReportStatus,
  mapSupportReportRow,
  normalizeSupportReportsFilters,
  type RawSupportReportRow,
  type SupportReport,
  type SupportReportsFilters,
  type SupportReportsPageData,
  type SupportReportStatus,
} from "@/lib/support/support-reports-model";
import type { Database } from "@/types/supabase";

type SupportReportsClient = SupabaseClient<Database>;
type FilterQuery = {
  eq: (column: string, value: string) => FilterQuery;
  or: (filters: string) => FilterQuery;
};

const SUPPORT_REPORT_SELECT = `
  id,
  tally_event_id,
  tally_response_id,
  tally_submission_id,
  tally_form_id,
  tally_form_name,
  user_id,
  user_email,
  locale,
  route,
  source,
  issue_type,
  severity,
  title,
  description,
  expected_behavior,
  steps_to_reproduce,
  contact_permission,
  attachments,
  environment,
  hidden_fields,
  raw_payload,
  status,
  submitted_at,
  created_at,
  updated_at
`;

class SupportReportsAuthError extends Error {}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function emptyPageData(
  filters: SupportReportsFilters,
  pageSize: number,
  loadError: string | null
): SupportReportsPageData {
  const summary = buildSupportReportStatusSummaryFromCounts({});
  return {
    reports: [],
    filters,
    facets: {
      severities: [],
      issueTypes: [],
      sources: [],
    },
    kpis: {
      ...summary,
      totalCount: 0,
    },
    page: filters.page,
    pageSize,
    totalCount: 0,
    pageCount: 1,
    loadError,
  };
}

function escapePostgrestSearch(value: string) {
  return value.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
}

function applyTextFilters<T>(
  query: T,
  filters: SupportReportsFilters,
  options: { includeStatus?: boolean } = {}
): T {
  let next = query as unknown as FilterQuery;
  const includeStatus = options.includeStatus ?? true;

  if (includeStatus && filters.status !== "all") {
    next = next.eq("status", filters.status);
  }

  if (filters.severity !== "all") {
    next = next.eq("severity", filters.severity);
  }

  if (filters.issueType !== "all") {
    next = next.eq("issue_type", filters.issueType);
  }

  if (filters.source !== "all") {
    next = next.eq("source", filters.source);
  }

  const search = escapePostgrestSearch(filters.search);
  if (search) {
    next = next.or(
      `title.ilike.%${search}%,description.ilike.%${search}%,user_email.ilike.%${search}%`
    );
  }

  return next as unknown as T;
}

async function verifyAdmin(supabase: SupportReportsClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new SupportReportsAuthError(error.message);
  }

  const devBypassUser = user ? null : await getDevAuthBypassUserFromServerContext();
  const devAdminBypass = isDevAdminBypassEnabled();

  if (!user && !devBypassUser) {
    if (devAdminBypass) return DEV_ADMIN_PROFILE.id;
    throw new SupportReportsAuthError("Unauthorized");
  }

  const userId = user?.id ?? devBypassUser?.id ?? DEV_ADMIN_PROFILE.id;
  if (!user && devBypassUser) return userId;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new SupportReportsAuthError(profileError.message);
  }

  if (profile?.role !== "admin") {
    if (devAdminBypass) return userId;
    throw new SupportReportsAuthError("Forbidden");
  }

  return userId;
}

async function countReportsForStatus(
  supabase: SupportReportsClient,
  filters: SupportReportsFilters,
  status: SupportReportStatus
) {
  let query = supabase
    .from("support_issue_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
  query = applyTextFilters(query, filters, { includeStatus: false });
  const { count, error } = await query;

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function getStatusCounts(
  supabase: SupportReportsClient,
  filters: SupportReportsFilters
) {
  const entries = await Promise.all(
    SUPPORT_REPORT_STATUSES.map(async (status) => [
      status,
      await countReportsForStatus(supabase, filters, status),
    ] as const)
  );

  return Object.fromEntries(entries) as Record<SupportReportStatus, number>;
}

async function getFacetReports(supabase: SupportReportsClient): Promise<SupportReport[]> {
  const { data, error } = await supabase
    .from("support_issue_reports")
    .select(SUPPORT_REPORT_SELECT)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return ((data ?? []) as RawSupportReportRow[]).map(mapSupportReportRow);
}

export async function listSupportReports({
  status,
  severity,
  issueType,
  source,
  search,
  page,
  pageSize = DEFAULT_SUPPORT_REPORTS_PAGE_SIZE,
}: {
  status?: string | null;
  severity?: string | null;
  issueType?: string | null;
  source?: string | null;
  search?: string | null;
  page?: string | number | null;
  pageSize?: number;
} = {}): Promise<SupportReportsPageData> {
  const filters = normalizeSupportReportsFilters({
    status,
    severity,
    issueType,
    source,
    search,
    page,
  });
  const from = (filters.page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = await createTypedServerClient();

  try {
    await verifyAdmin(supabase);

    let listQuery = supabase
      .from("support_issue_reports")
      .select(SUPPORT_REPORT_SELECT, { count: "exact" });
    listQuery = applyTextFilters(listQuery, filters);
    listQuery = listQuery
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    const [listResult, statusCounts, facetReports] = await Promise.all([
      listQuery,
      getStatusCounts(supabase, filters),
      getFacetReports(supabase),
    ]);

    if (listResult.error) {
      throw new Error(listResult.error.message);
    }

    const totalCount = listResult.count ?? 0;
    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
    const summary = buildSupportReportStatusSummaryFromCounts(statusCounts);

    return {
      reports: ((listResult.data ?? []) as RawSupportReportRow[]).map(mapSupportReportRow),
      filters,
      facets: buildSupportReportFacets(facetReports),
      kpis: {
        ...summary,
        totalCount,
      },
      page: filters.page,
      pageSize,
      totalCount,
      pageCount,
      loadError: null,
    };
  } catch (error) {
    if (error instanceof SupportReportsAuthError) {
      throw error;
    }

    return emptyPageData(
      filters,
      pageSize,
      getErrorMessage(error, "Unable to load support reports.")
    );
  }
}

export async function getSupportReport(id: string): Promise<SupportReport | null> {
  const supabase = await createTypedServerClient();
  await verifyAdmin(supabase);

  const { data, error } = await supabase
    .from("support_issue_reports")
    .select(SUPPORT_REPORT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapSupportReportRow(data as RawSupportReportRow) : null;
}

export async function updateSupportReportStatus({
  id,
  status,
}: {
  id: string;
  status: SupportReportStatus;
}): Promise<SupportReport> {
  if (!isSupportReportStatus(status)) {
    throw new Error("Invalid support report status.");
  }

  const supabase = await createTypedServerClient();
  await verifyAdmin(supabase);

  const { data, error } = await supabase
    .from("support_issue_reports")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(SUPPORT_REPORT_SELECT)
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/reports");
  revalidatePath("/en/dashboard/admin/reports");
  revalidatePath("/vi/dashboard/admin/reports");

  return mapSupportReportRow(data as RawSupportReportRow);
}
