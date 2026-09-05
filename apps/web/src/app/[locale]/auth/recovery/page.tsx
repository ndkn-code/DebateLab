import { AccessRecovery } from "@/components/auth/access-recovery";
import { recoveryDestination } from "@/lib/protected-shell/recovery";

export const dynamic = "force-dynamic";

export default async function RecoveryPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const next = typeof query.next === "string" ? query.next : undefined;
  return <AccessRecovery locale={locale} next={recoveryDestination(next, locale)} />;
}
