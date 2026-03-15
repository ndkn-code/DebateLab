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
    .select("*")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch conversations:", error);
    return [];
  }
  return (data ?? []) as ConversationWithPreview[];
}

export async function getConversation(
  conversationId: string,
  userId: string
): Promise<{ conversation: ChatConversation; messages: ChatMessage[] } | null> {
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (!conversation) return null;

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return {
    conversation: conversation as ChatConversation,
    messages: (messages ?? []) as ChatMessage[],
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
