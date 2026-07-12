export const REFERRAL_STATUSES = ["pending", "qualified", "credited", "rejected"] as const;

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const DEFAULT_REFERRALS_PAGE_SIZE = 20;

export interface AdminReferralFilters {
  status: ReferralStatus | "all";
  search: string;
  page: number;
}

export interface ReferralAggregateRow {
  referrerId: string;
  status: string;
  referrerOrbsAwarded: number;
  refereeOrbsAwarded: number;
}

export interface ReferralKpis {
  total: number;
  qualified: number;
  credited: number;
  orbsAwarded: number;
}

export interface TopReferrerAggregate {
  referrerId: string;
  referralCount: number;
  orbsAwarded: number;
}

export function isReferralStatus(value: unknown): value is ReferralStatus {
  return typeof value === "string" && REFERRAL_STATUSES.includes(value as ReferralStatus);
}

export function normalizeAdminReferralFilters(input: {
  status?: string | null;
  search?: string | null;
  page?: string | number | null;
} = {}): AdminReferralFilters {
  const rawPage = typeof input.page === "number" ? input.page : Number.parseInt(input.page ?? "1", 10);
  return {
    status: isReferralStatus(input.status) ? input.status : "all",
    search: (input.search ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1,
  };
}

export function buildReferralKpis(rows: readonly ReferralAggregateRow[]): ReferralKpis {
  return rows.reduce<ReferralKpis>(
    (result, row) => ({
      total: result.total + 1,
      qualified: result.qualified + (row.status === "qualified" || row.status === "credited" ? 1 : 0),
      credited: result.credited + (row.status === "credited" ? 1 : 0),
      orbsAwarded:
        result.orbsAwarded + row.referrerOrbsAwarded + row.refereeOrbsAwarded,
    }),
    { total: 0, qualified: 0, credited: 0, orbsAwarded: 0 },
  );
}

export function buildTopReferrerAggregates(
  rows: readonly ReferralAggregateRow[],
  limit: number,
): TopReferrerAggregate[] {
  const grouped = new Map<string, TopReferrerAggregate>();
  for (const row of rows) {
    const current = grouped.get(row.referrerId) ?? {
      referrerId: row.referrerId,
      referralCount: 0,
      orbsAwarded: 0,
    };
    current.referralCount += 1;
    current.orbsAwarded += row.referrerOrbsAwarded;
    grouped.set(row.referrerId, current);
  }

  return [...grouped.values()]
    .sort((a, b) => b.referralCount - a.referralCount || b.orbsAwarded - a.orbsAwarded || a.referrerId.localeCompare(b.referrerId))
    .slice(0, Math.max(0, Math.floor(limit)));
}
