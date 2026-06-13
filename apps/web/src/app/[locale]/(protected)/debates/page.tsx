import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccessDuels } from "@/lib/auth/admin";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import { DuelHubPage } from "@/components/debates/duel-hub-page";

export const metadata = {
  title: "1v1 Debate Arena",
};

export const dynamic = "force-dynamic";

export default async function DebateHubRoute() {
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

  const isAdmin = user ? await canAccessDuels(supabase, user.id) : true;
  return <DuelHubPage isAdmin={isAdmin} />;
}
