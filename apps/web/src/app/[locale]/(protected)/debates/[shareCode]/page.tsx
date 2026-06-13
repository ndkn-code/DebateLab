import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccessDuels } from "@/lib/auth/admin";
import { DuelRoomPage } from "@/components/debates/duel-room-page";

export const metadata = {
  title: "Debate Duel",
};

export default async function DebateDuelRoomPage({
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

  return <DuelRoomPage shareCode={shareCode} />;
}
