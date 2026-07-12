import "server-only";

import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { createTypedServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/supabase";
import {
  DEFAULT_REFERRALS_PAGE_SIZE,
  buildReferralKpis,
  buildTopReferrerAggregates,
  normalizeAdminReferralFilters,
  type AdminReferralFilters,
  type ReferralKpis,
  type ReferralStatus,
} from "@/lib/referrals/admin-referrals-model";

type ReferralRow = Tables<"referrals">;
type ProfileSummary = Pick<Tables<"profiles">, "id" | "display_name" | "email">;

export interface AdminReferral extends ReferralRow {
  referrer: ProfileSummary | null;
  referee: ProfileSummary | null;
}

export interface AdminReferralsPageData {
  referrals: AdminReferral[];
  filters: AdminReferralFilters;
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount: number;
}

export interface TopReferrer extends ProfileSummary {
  referralCount: number;
  orbsAwarded: number;
}

async function verifyAdmin(): Promise<void> {
  if (isDevAdminBypassEnabled()) return;
  const session = await createTypedServerClient();
  const { data: { user }, error: userError } = await session.auth.getUser();
  if (userError || !user) throw new Error("referrals-admin: unauthorized");
  const { data: profile, error: profileError } = await session
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profileError || profile?.role !== "admin") throw new Error("referrals-admin: forbidden");
}

function escapeSearch(value: string): string {
  return value.replace(/[%_,()]/g, " ").replace(/\s+/g, " ").trim();
}

async function loadProfiles(ids: readonly string[]): Promise<Map<string, ProfileSummary>> {
  if (ids.length === 0) return new Map();
  const admin = createTypedAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name, email")
    .in("id", [...new Set(ids)]);
  if (error) throw new Error(`referrals-admin(profiles): ${error.message}`);
  return new Map((data ?? []).map((profile) => [profile.id, profile]));
}

export async function listReferrals({
  status,
  search,
  page,
  pageSize = DEFAULT_REFERRALS_PAGE_SIZE,
}: {
  status?: string | null;
  search?: string | null;
  page?: string | number | null;
  pageSize?: number;
} = {}): Promise<AdminReferralsPageData> {
  await verifyAdmin();
  const filters = normalizeAdminReferralFilters({ status, search, page });
  const admin = createTypedAdminClient();
  let matchingProfileIds: string[] | null = null;

  if (filters.search) {
    const term = escapeSearch(filters.search);
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .or(`email.ilike.%${term}%,display_name.ilike.%${term}%`)
      .limit(500);
    if (error) throw new Error(`referrals-admin(search): ${error.message}`);
    matchingProfileIds = (data ?? []).map((profile) => profile.id);
    if (matchingProfileIds.length === 0) {
      return { referrals: [], filters, page: filters.page, pageSize, pageCount: 1, totalCount: 0 };
    }
  }

  let query = admin
    .from("referrals")
    .select("id, referrer_id, referee_id, status, referrer_orbs_awarded, referee_orbs_awarded, qualified_at, credited_at, created_at", { count: "exact" });
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (matchingProfileIds) {
    const ids = matchingProfileIds.join(",");
    query = query.or(`referrer_id.in.(${ids}),referee_id.in.(${ids})`);
  }

  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const from = (filters.page - 1) * safePageSize;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + safePageSize - 1);
  if (error) throw new Error(`referrals-admin(list): ${error.message}`);

  const rows = data ?? [];
  const profiles = await loadProfiles(rows.flatMap((row) => [row.referrer_id, row.referee_id]));
  const referrals = rows.map((row) => ({
    ...row,
    referrer: profiles.get(row.referrer_id) ?? null,
    referee: profiles.get(row.referee_id) ?? null,
  }));
  const totalCount = count ?? 0;
  return {
    referrals,
    filters,
    page: filters.page,
    pageSize: safePageSize,
    pageCount: Math.max(1, Math.ceil(totalCount / safePageSize)),
    totalCount,
  };
}

async function loadAggregateRows() {
  const admin = createTypedAdminClient();
  const { data, error } = await admin
    .from("referrals")
    .select("referrer_id, status, referrer_orbs_awarded, referee_orbs_awarded")
    .limit(10000);
  if (error) throw new Error(`referrals-admin(aggregates): ${error.message}`);
  return (data ?? []).map((row) => ({
    referrerId: row.referrer_id,
    status: row.status,
    referrerOrbsAwarded: row.referrer_orbs_awarded,
    refereeOrbsAwarded: row.referee_orbs_awarded,
  }));
}

export async function getReferralKpis(): Promise<ReferralKpis> {
  await verifyAdmin();
  const admin = createTypedAdminClient();
  const [rows, ledgerResult] = await Promise.all([
    loadAggregateRows(),
    admin
      .from("orb_transactions")
      .select("amount")
      .in("type", ["referral_reward", "referral_bonus"])
      .limit(20000),
  ]);
  if (ledgerResult.error) {
    throw new Error(`referrals-admin(orb-ledger): ${ledgerResult.error.message}`);
  }
  const kpis = buildReferralKpis(rows);
  return {
    ...kpis,
    orbsAwarded: (ledgerResult.data ?? []).reduce((sum, transaction) => sum + transaction.amount, 0),
  };
}

export async function getTopReferrers({ limit = 5 }: { limit?: number } = {}): Promise<TopReferrer[]> {
  await verifyAdmin();
  const aggregates = buildTopReferrerAggregates(await loadAggregateRows(), limit);
  const profiles = await loadProfiles(aggregates.map((entry) => entry.referrerId));
  return aggregates.map((entry) => {
    const profile = profiles.get(entry.referrerId);
    return {
      id: entry.referrerId,
      display_name: profile?.display_name ?? "Unknown user",
      email: profile?.email ?? null,
      referralCount: entry.referralCount,
      orbsAwarded: entry.orbsAwarded,
    };
  });
}

export type { ReferralKpis, ReferralStatus };
