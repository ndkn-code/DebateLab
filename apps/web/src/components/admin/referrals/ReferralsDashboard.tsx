"use client";

import { useTranslations } from "next-intl";
import { ChartCard, ChartEmpty, StatCard } from "@/components/data-viz";
import { FadeInItem, PageTransition, StaggeredContainer } from "@/components/shared/page-motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { Gift, Search, Trophy, UserPlus } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import type { AdminReferralsPageData, ReferralKpis, TopReferrer } from "@/lib/api/admin-referrals";
import { REFERRAL_STATUSES, type ReferralStatus } from "@/lib/referrals/admin-referrals-model";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<ReferralStatus, string> = {
  pending: "border-warning/25 bg-warning-container text-on-warning-container",
  qualified: "border-info/25 bg-info-container text-info",
  credited: "border-success/25 bg-success-container text-success-dim",
  rejected: "border-error/25 bg-error-container text-error-dim",
};

function queryHref(filters: AdminReferralsPageData["filters"], patch: Partial<{ status: string; page: number }>) {
  const query = new URLSearchParams();
  const status = patch.status ?? filters.status;
  const page = patch.page ?? filters.page;
  if (status !== "all") query.set("status", status);
  if (filters.search) query.set("search", filters.search);
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return `/dashboard/admin/referrals${suffix ? `?${suffix}` : ""}`;
}

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}

function Person({ name, email }: { name?: string; email?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-semibold text-on-surface">{name || "Unknown user"}</div>
      <div className="truncate text-xs text-on-surface-variant">{email || "—"}</div>
    </div>
  );
}

export function ReferralsDashboard({
  data,
  kpis,
  topReferrers,
  locale,
}: {
  data: AdminReferralsPageData;
  kpis: ReferralKpis;
  topReferrers: TopReferrer[];
  locale: string;
}) {
  const t = useTranslations("admin.referrals");
  const number = (value: number) => value.toLocaleString(locale);

  return (
    <PageTransition className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="type-title-lg text-on-surface">{t("title")}</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container px-3 py-1 text-xs font-semibold text-on-surface-variant">
          <UserPlus className="h-3.5 w-3.5" /> {t("readOnly")}
        </span>
      </header>

      <StaggeredContainer className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FadeInItem><StatCard label={t("kpis.total")} value={kpis.total} icon={<UserPlus className="h-4 w-4" />} /></FadeInItem>
        <FadeInItem><StatCard label={t("kpis.qualified")} value={kpis.qualified} /></FadeInItem>
        <FadeInItem><StatCard label={t("kpis.credited")} value={kpis.credited} /></FadeInItem>
        <FadeInItem><StatCard label={t("kpis.orbs")} value={kpis.orbsAwarded} icon={<Gift className="h-4 w-4" />} /></FadeInItem>
      </StaggeredContainer>

      <ChartCard title={t("leaderboard.title")}>
        {topReferrers.length === 0 ? (
          <ChartEmpty title={t("leaderboard.empty")} icon={<Trophy className="h-7 w-7" />} />
        ) : (
          <StaggeredContainer className="divide-y divide-outline-variant/25">
            {topReferrers.map((entry, index) => (
              <FadeInItem key={entry.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-3">
                <span className="font-mono text-sm font-bold text-on-surface-variant">#{index + 1}</span>
                <Person name={entry.display_name} email={entry.email} />
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums text-on-surface">{number(entry.referralCount)}</div>
                  <div className="text-xs tabular-nums text-on-surface-variant">{number(entry.orbsAwarded)} {t("orbsShort")}</div>
                </div>
              </FadeInItem>
            ))}
          </StaggeredContainer>
        )}
      </ChartCard>

      <ChartCard title={t("list.title")}>
        <div className="mb-4 flex flex-col gap-3">
          <form className="flex gap-2" method="get">
            {data.filters.status !== "all" && <input type="hidden" name="status" value={data.filters.status} />}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <Input name="search" defaultValue={data.filters.search} placeholder={t("searchPlaceholder")} className="pl-8" />
            </div>
            <Button type="submit" variant="outline">{t("search")}</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {["all", ...REFERRAL_STATUSES].map((status) => (
              <Link
                key={status}
                href={queryHref(data.filters, { status, page: 1 })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  data.filters.status === status
                    ? "border-primary/25 bg-primary text-on-primary"
                    : "border-outline-variant/40 bg-background text-on-surface-variant hover:bg-primary-container",
                )}
              >
                {t(`status.${status}`)}
              </Link>
            ))}
          </div>
        </div>

        {data.referrals.length === 0 ? (
          <ChartEmpty
            className="min-h-64"
            title={data.totalCount === 0 && !data.filters.search && data.filters.status === "all" ? t("empty.title") : t("empty.filteredTitle")}
            description={data.totalCount === 0 && !data.filters.search && data.filters.status === "all" ? t("empty.description") : t("empty.filteredDescription")}
            icon={<Gift className="h-9 w-9" />}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-225 text-left text-sm">
                <thead className="border-b border-outline-variant/35 text-xs font-bold uppercase tracking-normal text-on-surface-variant">
                  <tr><th className="px-3 py-3">{t("table.referrer")}</th><th className="px-3 py-3">{t("table.referee")}</th><th className="px-3 py-3">{t("table.status")}</th><th className="px-3 py-3">{t("table.orbs")}</th><th className="px-3 py-3">{t("table.qualified")}</th><th className="px-3 py-3">{t("table.credited")}</th><th className="px-3 py-3">{t("table.created")}</th></tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/25">
                  {data.referrals.map((referral) => (
                    <tr key={referral.id} className="hover:bg-surface-container/60">
                      <td className="px-3 py-3"><Person name={referral.referrer?.display_name} email={referral.referrer?.email} /></td>
                      <td className="px-3 py-3"><Person name={referral.referee?.display_name} email={referral.referee?.email} /></td>
                      <td className="px-3 py-3"><span className={cn("rounded-full border px-2 py-1 text-xs font-semibold", STATUS_CLASS[referral.status as ReferralStatus] ?? STATUS_CLASS.pending)}>{t(`status.${referral.status}`)}</span></td>
                      <td className="px-3 py-3 font-mono tabular-nums text-on-surface">{number(referral.referrer_orbs_awarded + referral.referee_orbs_awarded)}</td>
                      <td className="px-3 py-3 text-on-surface-variant">{formatDate(referral.qualified_at, locale)}</td>
                      <td className="px-3 py-3 text-on-surface-variant">{formatDate(referral.credited_at, locale)}</td>
                      <td className="px-3 py-3 text-on-surface-variant">{formatDate(referral.created_at, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <StaggeredContainer className="divide-y divide-outline-variant/25 md:hidden">
              {data.referrals.map((referral) => (
                <FadeInItem key={referral.id} className="space-y-3 py-4">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><Person name={referral.referrer?.display_name} email={referral.referrer?.email} /><span className="text-on-surface-variant">→</span><Person name={referral.referee?.display_name} email={referral.referee?.email} /></div>
                  <div className="flex items-center justify-between gap-2"><span className={cn("rounded-full border px-2 py-1 text-xs font-semibold", STATUS_CLASS[referral.status as ReferralStatus] ?? STATUS_CLASS.pending)}>{t(`status.${referral.status}`)}</span><span className="font-mono text-xs tabular-nums text-on-surface-variant">{number(referral.referrer_orbs_awarded + referral.referee_orbs_awarded)} {t("orbsShort")} · {formatDate(referral.created_at, locale)}</span></div>
                </FadeInItem>
              ))}
            </StaggeredContainer>
          </>
        )}

        {data.pageCount > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-outline-variant/25 pt-4">
            <span className="text-xs text-on-surface-variant">{t("pagination", { page: data.page, pages: data.pageCount })}</span>
            <div className="flex gap-2">
              {data.page > 1 && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={queryHref(data.filters, { page: data.page - 1 })}>{t("previous")}</Link>}
              {data.page < data.pageCount && <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={queryHref(data.filters, { page: data.page + 1 })}>{t("next")}</Link>}
            </div>
          </div>
        )}
      </ChartCard>
    </PageTransition>
  );
}
