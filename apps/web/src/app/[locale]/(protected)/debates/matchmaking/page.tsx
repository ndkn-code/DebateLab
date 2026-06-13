import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccessDuels } from "@/lib/auth/admin";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import { getActivePracticeTopics } from "@/lib/practice-topics/catalog";
import { coercePracticeLanguage } from "@/lib/practice-language";
import { DuelMatchmakingPage } from "@/components/debates/duel-matchmaking-page";

export const metadata = {
  title: "Find a Debate Match",
};

export const dynamic = "force-dynamic";

export default async function DebateMatchmakingRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devAuthBypassUser = user
    ? null
    : await getDevAuthBypassUserFromServerContext();

  if (!user && !devAuthBypassUser) {
    redirect("/auth/login");
  }

  if (user && !(await canAccessDuels(supabase, user.id))) {
    redirect("/dashboard");
  }

  const { locale } = await params;
  const initialTopics = await getActivePracticeTopics(
    coercePracticeLanguage(locale),
    { allowAdminFallback: true }
  );

  return <DuelMatchmakingPage initialTopics={initialTopics} />;
}
