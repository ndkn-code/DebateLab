import { createClient } from "@/lib/supabase/server";
import type { ChatConversation, ChatMessage } from "@/types/database";

export interface ConversationWithPreview extends ChatConversation {
  preview?: string;
}

export type ChatProductContext = "debate" | "ielts";

export async function getConversations(
  userId: string,
  productContext: ChatProductContext = "debate",
): Promise<ConversationWithPreview[]> {
  const supabase = await createClient();
  const { data: rpcConversations, error: rpcError } = await supabase.rpc(
    "get_chat_sidebar_payload",
    { p_product_context: productContext },
  );

  if (!rpcError && Array.isArray(rpcConversations)) {
    return rpcConversations as ConversationWithPreview[];
  }

  const { data, error } = await supabase
    .from("chat_conversations")
    .select(
      "id, user_id, title, product_context, context_type, context_id, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("product_context", productContext)
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
      normalized.length > 88 ? `${normalized.slice(0, 85)}...` : normalized,
    );
  }

  return conversations.map((conversation) => ({
    ...conversation,
    preview: previewByConversation.get(conversation.id),
  }));
}

export async function getConversation(
  conversationId: string,
  userId: string,
  productContext: ChatProductContext = "debate",
): Promise<{ conversation: ChatConversation; messages: ChatMessage[] } | null> {
  const supabase = await createClient();

  // Fetch conversation and messages in parallel
  const [convRes, msgRes] = await Promise.all([
    supabase
      .from("chat_conversations")
      .select(
        "id, user_id, title, product_context, context_type, context_id, created_at, updated_at",
      )
      .eq("id", conversationId)
      .eq("user_id", userId)
      .eq("product_context", productContext)
      .single(),
    supabase
      .from("chat_messages")
      .select("id, conversation_id, role, content, metadata, created_at")
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
  userId: string,
  productContext: ChatProductContext = "debate",
) {
  const supabase = await createClient();
  const { data: ownedConversation, error: lookupError } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .eq("product_context", productContext)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!ownedConversation) return false;

  // Messages cascade only after product-scoped ownership is proven.
  const { error } = await supabase
    .from("chat_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId)
    .eq("product_context", productContext);

  if (error) throw error;
  return true;
}
