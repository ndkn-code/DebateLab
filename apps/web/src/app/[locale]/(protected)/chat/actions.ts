"use server";

import { createClient } from "@/lib/supabase/server";
import { deleteConversation } from "@/lib/api/chat";
import { IELTS_ENABLED } from "@/lib/features";
import { getActiveSubject } from "@/lib/subject/server";
import { revalidatePath } from "next/cache";

export async function deleteConversationAction(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const role = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (role.error) throw role.error;
  const productContext = await getActiveSubject({
    ieltsAccessible: IELTS_ENABLED || role.data?.role === "admin",
  });
  await deleteConversation(conversationId, user.id, productContext);
  revalidatePath("/chat");
}
