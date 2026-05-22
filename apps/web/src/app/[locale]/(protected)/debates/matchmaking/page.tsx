import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import { DuelMatchmakingPage } from "@/components/debates/duel-matchmaking-page";

export const metadata = {
  title: "Find a Debate Match",
};

export const dynamic = "force-dynamic";

export default async function DebateMatchmakingRoute() {
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

  if (user && !(await isAdminUser(supabase, user.id))) {
    redirect("/dashboard");
  }

  return <DuelMatchmakingPage />;
}
