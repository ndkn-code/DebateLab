import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingContent } from "@/components/landing/landing-content";
import { getLandingCopy, type LandingLocale } from "@/components/landing/copy";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const landingLocale: LandingLocale = locale === "en" ? "en" : "vi";
  const copy = getLandingCopy(landingLocale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="landing-light min-h-screen bg-background text-on-surface [color-scheme:light]">
      <LandingNavbar copy={copy} isLoggedIn={!!user} locale={landingLocale} />
      <LandingContent copy={copy} isLoggedIn={!!user} locale={landingLocale} />
    </main>
  );
}
