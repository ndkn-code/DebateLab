import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { DuelCreatePage } from "@/components/debates/duel-create-page";

export const metadata = {
  title: "1v1 Debate",
};

export default async function NewDebateDuelPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; topic?: string }>;
}) {
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

  const params = await searchParams;

  return (
    <DuelCreatePage
      initialTopicTitle={params.topic}
      initialRoomShareCode={params.room}
    />
  );
}
