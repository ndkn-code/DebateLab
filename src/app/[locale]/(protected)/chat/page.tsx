import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getConversations } from "@/lib/api/chat";
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

  return (
    <ChatShell
      conversations={conversations}
      initialMessage={params.message}
      initialConversationId={params.conversationId}
      context={params.context}
      contextId={params.contextId}
    />
  );
}
