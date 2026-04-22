import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getConversations } from "@/lib/api/chat";
import {
  getCoachContextEnvelope,
  getCoachProfile,
} from "@/lib/api/coach-profile";
import { ChatShell } from "@/components/chat/chat-shell";

export const metadata = {
  title: "AI Coach",
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; conversationId?: string; context?: string; contextId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const conversations = await getConversations(user.id);
  const params = await searchParams;
  const normalizedContext =
    params.context === "dashboard-home" ? "coach-home" : params.context;
  const coachProfile = await getCoachProfile(user.id);
  const initialEnvelope = await getCoachContextEnvelope({
    userId: user.id,
    profile: coachProfile,
    contextType: normalizedContext,
    contextId: params.contextId,
    message: params.message,
  });

  return (
    <ChatShell
      conversations={conversations}
      initialMessage={params.message}
      initialConversationId={params.conversationId}
      context={normalizedContext}
      contextId={params.contextId}
      initialCoachProfile={coachProfile}
      initialCoachEnvelope={initialEnvelope}
    />
  );
}
