import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingContent } from "@/components/landing/landing-content";
import { LandingLightThemeLock } from "@/components/landing/landing-light-theme-lock";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="landing-light min-h-screen bg-[#F7FAFE] text-[#0B1424] [color-scheme:light]">
      <LandingLightThemeLock />
      <LandingNavbar isLoggedIn={!!user} />
      <LandingContent isLoggedIn={!!user} />
    </main>
  );
}
