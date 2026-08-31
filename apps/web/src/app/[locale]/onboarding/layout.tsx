import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AgeAssuranceGate } from "@/components/legal/age-assurance-gate";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { asPublicLocale } from "@/lib/public-site";
import type { AgeAssuranceStatus } from "@/app/actions/age-assurance";

export const metadata = {
  title: "Welcome to Thinkfy",
};

export default async function OnboardingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = asPublicLocale(rawLocale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const admin = tryCreateAdminClient();
  const [{ data: profile }, { data: assurance }] = await Promise.all([
    supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single(),
    admin
      ? admin
          .from("user_age_assurance")
          .select("consent_status")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (profile?.onboarding_completed) {
    redirect("/dashboard");
  }

  const status = (assurance?.consent_status ??
    null) as AgeAssuranceStatus | null;
  const mayContinue =
    status === "adult_attested" || status === "guardian_granted";

  return mayContinue ? (
    <div className="min-h-[100dvh] bg-background">{children}</div>
  ) : (
    <AgeAssuranceGate locale={locale} initialStatus={status} />
  );
}
