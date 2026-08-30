import { NextRequest, NextResponse } from "next/server";

import { getConversations } from "@/lib/api/chat";
import {
  ChatProductContextError,
  resolveServerActiveChatProduct,
} from "@/lib/api/chat-product-context";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { IELTS_ENABLED } from "@/lib/features";
import { getActiveSubject } from "@/lib/subject/server";

export const dynamic = "force-dynamic";

async function resolveProduct(
  request: NextRequest,
  auth: Awaited<ReturnType<typeof requireRequestAuth>> & { ok: true },
) {
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

export async function GET(request: NextRequest) {
  const auth = await requireRequestAuth(request, { allowDevBypass: false });
  if (!auth.ok) return auth.errorResponse;

  try {
    const productContext = await resolveProduct(request, auth);
    const conversations = await getConversations(auth.user.id, productContext);
    return NextResponse.json({ productContext, conversations });
  } catch (error) {
    if (error instanceof ChatProductContextError) {
      return NextResponse.json(
        { error: "Coach product context mismatch.", code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Unable to load coach conversations." },
      { status: 500 },
    );
  }
}
