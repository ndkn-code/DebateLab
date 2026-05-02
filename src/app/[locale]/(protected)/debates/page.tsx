import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { DuelHubPage } from "@/components/debates/duel-hub-page";

export const metadata = {
  title: "1v1 Debate Arena",
};

export default async function DebateHubRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const isAdmin = await isAdminUser(supabase, user.id);
  return <DuelHubPage isAdmin={isAdmin} />;
}
