import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LandingV3 } from "@/components/landing/v3";
import { getLandingV3Copy, type LandingLocale } from "@/components/landing/v3/copy";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const landingLocale: LandingLocale = locale === "en" ? "en" : "vi";
  const copy = getLandingV3Copy(landingLocale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="landing-light min-h-screen bg-background text-on-surface [color-scheme:light]">
      <LandingV3 copy={copy} isLoggedIn={!!user} locale={landingLocale} />
    </main>
  );
}
