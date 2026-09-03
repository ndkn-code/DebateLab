import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canAccessDuels } from "@/lib/auth/admin";
import { getActivePracticeTopics } from "@/lib/practice-topics/catalog";
import { coercePracticeLanguage } from "@/lib/practice-language";
import { DuelCreatePage } from "@/components/debates/duel-create-page";

export const metadata = {
  title: "1v1 Debate",
};

export const dynamic = "force-dynamic";

export default async function NewDebateDuelPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ room?: string; topic?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  if (user && !(await canAccessDuels(supabase, user.id))) {
    redirect("/dashboard");
  }

  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const initialTopics = await getActivePracticeTopics(
    coercePracticeLanguage(locale),
    { allowAdminFallback: true },
  );

  return (
    <DuelCreatePage
      initialTopics={initialTopics}
      initialTopicTitle={query.topic}
      initialRoomShareCode={query.room}
    />
  );
}
