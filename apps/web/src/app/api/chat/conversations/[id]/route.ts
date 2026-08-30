import { NextRequest, NextResponse } from "next/server";
import {
  ChatProductContextError,
  resolveServerActiveChatProduct,
} from "@/lib/api/chat-product-context";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { IELTS_ENABLED } from "@/lib/features";
import { getActiveSubject } from "@/lib/subject/server";

type AuthSuccess = Awaited<ReturnType<typeof requireRequestAuth>> & {
  ok: true;
};

async function resolveProduct(request: NextRequest, auth: AuthSuccess) {
  const role = await auth.supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (role.error) throw role.error;
  const activeProduct = await getActiveSubject({
    ieltsAccessible: IELTS_ENABLED || role.data?.role === "admin",
  });
  return resolveServerActiveChatProduct({
    activeProduct,
    requestedProduct: request.nextUrl.searchParams.get("productContext"),
  });
}

function errorResponse(error: unknown) {
  if (error instanceof ChatProductContextError) {
    return NextResponse.json(
      { error: "Coach product context mismatch.", code: error.code },
      { status: error.status },
    );
  }
  if (process.env.NODE_ENV === "development") {
    console.error("Coach conversation operation failed:", error);
  }
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRequestAuth(req, { allowDevBypass: false });

    if (!auth.ok) {
      return auth.errorResponse;
    }

    const [{ id }, productContext] = await Promise.all([
      params,
      resolveProduct(req, auth),
    ]);
    const { supabase, user } = auth;
    const conversationResult = await supabase
      .from("chat_conversations")
      .select(
        "id, user_id, title, product_context, context_type, context_id, created_at, updated_at",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("product_context", productContext)
      .maybeSingle();

    if (conversationResult.error) throw conversationResult.error;
    if (!conversationResult.data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch messages
    const messages = await supabase
      .from("chat_messages")
      .select("id, conversation_id, role, content, metadata, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(100);
    if (messages.error) throw messages.error;

    return NextResponse.json({
      productContext,
      conversation: conversationResult.data,
      messages: messages.data ?? [],
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRequestAuth(req, { allowDevBypass: false });
  if (!auth.ok) return auth.errorResponse;

  try {
    const [{ id }, productContext] = await Promise.all([
      params,
      resolveProduct(req, auth),
    ]);
    const owned = await auth.supabase
      .from("chat_conversations")
      .select("id")
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .eq("product_context", productContext)
      .maybeSingle();
    if (owned.error) throw owned.error;
    if (!owned.data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const deleted = await auth.supabase
      .from("chat_conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .eq("product_context", productContext);
    if (deleted.error) throw deleted.error;
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
