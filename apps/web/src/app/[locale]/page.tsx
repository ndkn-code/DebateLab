import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingContent } from "@/components/landing/landing-content";

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
    <main className="bg-background text-on-surface">
      <LandingNavbar isLoggedIn={!!user} />
      <LandingContent isLoggedIn={!!user} />
    </main>
  );
}
