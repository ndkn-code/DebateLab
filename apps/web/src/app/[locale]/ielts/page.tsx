import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { IeltsLanding } from "@/components/landing/ielts/IeltsLanding";
import { resolveSignedInIeltsEntry } from "@/lib/api/ielts/entry-repository";
import { createTypedServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "IELTS preparation",
};

export default async function IeltsLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(await resolveSignedInIeltsEntry(user.id, supabase));
  }

  return <IeltsLanding locale={locale === "vi" ? "vi" : "en"} />;
}
