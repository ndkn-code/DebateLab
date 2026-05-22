import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import { DuelCreatePage } from "@/components/debates/duel-create-page";

export const metadata = {
  title: "1v1 Debate",
};

export const dynamic = "force-dynamic";

export default async function NewDebateDuelPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; topic?: string }>;
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

  if (user && !(await isAdminUser(supabase, user.id))) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <DuelCreatePage
      initialTopicTitle={params.topic}
      initialRoomShareCode={params.room}
    />
  );
}
