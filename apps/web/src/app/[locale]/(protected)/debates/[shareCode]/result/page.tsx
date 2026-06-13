import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccessDuels } from "@/lib/auth/admin";
import { DuelResultPage } from "@/components/debates/duel-result-page";

export const metadata = {
  title: "Debate Duel Result",
};

export default async function DebateDuelResultRoute({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  if (!(await canAccessDuels(supabase, user.id))) {
    redirect("/dashboard");
  }

  const { shareCode } = await params;

  return <DuelResultPage shareCode={shareCode} />;
}
