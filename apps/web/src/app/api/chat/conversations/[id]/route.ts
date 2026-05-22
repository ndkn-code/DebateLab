import { NextRequest, NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/api/request-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireRequestAuth(req, { allowDevBypass: false });

    if (!auth.ok) {
      return auth.errorResponse;
    }

    const { supabase, user } = auth;
    // Verify ownership
    const { data: conversation } = await supabase
      .from("chat_conversations")
      .select("id, user_id, title, context_type, context_id, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch messages
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("id, conversation_id, role, content, metadata, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(100);

    return NextResponse.json({
      conversation,
      messages: messages ?? [],
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error("Failed to load conversation:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
