import { ReferralsDashboard } from "@/components/admin/referrals/ReferralsDashboard";
import { getReferralKpis, getTopReferrers, listReferrals } from "@/lib/api/admin-referrals";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin - Referrals" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminReferralsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [data, kpis, topReferrers] = await Promise.all([
    listReferrals({ status: first(query.status), search: first(query.search) ?? first(query.q), page: first(query.page) }),
    getReferralKpis(),
    getTopReferrers({ limit: 5 }),
  ]);
  return <ReferralsDashboard data={data} kpis={kpis} topReferrers={topReferrers} locale={locale} />;
}
