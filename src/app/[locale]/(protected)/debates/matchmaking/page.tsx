import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { DuelMatchmakingPage } from "@/components/debates/duel-matchmaking-page";

export const metadata = {
  title: "Find a Debate Match",
};

export default async function DebateMatchmakingRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  if (!(await isAdminUser(supabase, user.id))) {
    redirect("/dashboard");
  }

  return <DuelMatchmakingPage />;
}
