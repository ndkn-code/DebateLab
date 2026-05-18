import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import { getConversations } from "@/lib/api/chat";
import {
  getCoachContextEnvelope,
  getCoachProfile,
} from "@/lib/api/coach-profile";
import { coercePracticeLanguage } from "@/lib/practice-language";
import { ChatShell } from "@/components/chat/chat-shell";

export const metadata = {
  title: "AI Coach",
};
export const dynamic = "force-dynamic";

async function ChatPayload({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ message?: string; conversationId?: string; context?: string; contextId?: string }>;
}) {
  const { locale } = await params;
  const practiceLanguage = coercePracticeLanguage(locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devAuthBypassUser = user
    ? null
    : await getDevAuthBypassUserFromServerContext();

  if (!user && !devAuthBypassUser) redirect("/auth/login");
  const userId = user?.id ?? devAuthBypassUser!.id;

  const conversations = user ? await getConversations(user.id) : [];
  const query = await searchParams;
  const normalizedContext =
    query.context === "dashboard-home" ? "coach-home" : query.context;
  const coachProfile = await getCoachProfile(userId, practiceLanguage);
  const initialEnvelope = await getCoachContextEnvelope({
    userId,
    profile: coachProfile,
    contextType: normalizedContext,
    contextId: query.contextId,
    message: query.message,
    practiceLanguage,
  });

  return (
    <ChatShell
      conversations={conversations}
      initialMessage={query.message}
      initialConversationId={query.conversationId}
      context={normalizedContext}
      contextId={query.contextId}
      initialCoachProfile={coachProfile}
      initialCoachEnvelope={initialEnvelope}
    />
  );
}

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ message?: string; conversationId?: string; context?: string; contextId?: string }>;
}) {
  return await ChatPayload({ params, searchParams });
}
