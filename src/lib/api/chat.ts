import { createClient } from "@/lib/supabase/server";
import type { ChatConversation, ChatMessage } from "@/types/database";

export interface ConversationWithPreview extends ChatConversation {
  preview?: string;
}

export async function getConversations(
  userId: string
): Promise<ConversationWithPreview[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chat_conversations")
    .select("id, user_id, title, context_type, context_id, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error) {
    return [];
  }

  const conversations = (data ?? []) as ConversationWithPreview[];
  if (conversations.length === 0) {
    return conversations;
  }

  const conversationIds = conversations.map((conversation) => conversation.id);
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("conversation_id, content, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .limit(200);

  const previewByConversation = new Map<string, string>();
  for (const message of messages ?? []) {
    if (previewByConversation.has(message.conversation_id)) continue;
    const normalized = message.content.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    previewByConversation.set(
      message.conversation_id,
      normalized.length > 88 ? `${normalized.slice(0, 85)}...` : normalized
    );
  }

  return conversations.map((conversation) => ({
    ...conversation,
    preview: previewByConversation.get(conversation.id),
  }));
}

export async function getConversation(
  conversationId: string,
  userId: string
): Promise<{ conversation: ChatConversation; messages: ChatMessage[] } | null> {
  const supabase = await createClient();

  // Fetch conversation and messages in parallel
  const [convRes, msgRes] = await Promise.all([
    supabase
      .from("chat_conversations")
      .select("id, user_id, title, context_type, context_id, created_at, updated_at")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .single(),
    supabase
      .from("chat_messages")
      .select("id, conversation_id, role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
  ]);

  if (!convRes.data) return null;

  return {
    conversation: convRes.data as ChatConversation,
    messages: (msgRes.data ?? []) as ChatMessage[],
  };
}

export async function deleteConversation(
  conversationId: string,
  userId: string
) {
  const supabase = await createClient();

  // Delete messages first
  await supabase
    .from("chat_messages")
    .delete()
    .eq("conversation_id", conversationId);

  // Delete conversation
  const { error } = await supabase
    .from("chat_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) throw error;
}
