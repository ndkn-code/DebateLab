import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DuelCreatePage } from "@/components/debates/duel-create-page";

export const metadata = {
  title: "1v1 Debate",
};

export default async function NewDebateDuelPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const params = await searchParams;

  return <DuelCreatePage initialTopicTitle={params.topic} />;
}
