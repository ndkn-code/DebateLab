"use server";

import { createClient } from "@/lib/supabase/server";
import { deleteConversation } from "@/lib/api/chat";
import { revalidatePath } from "next/cache";

export async function deleteConversationAction(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  await deleteConversation(conversationId, user.id);
  revalidatePath("/chat");
}
