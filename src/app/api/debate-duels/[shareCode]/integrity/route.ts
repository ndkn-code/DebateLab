import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { recordDebateDuelIntegrityEvent } from "@/lib/api/debate-duels";

type IntegrityBody = {
  actionType?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ shareCode: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json(
        { error: "1v1 Debate is coming soon." },
        { status: 403 }
      );
    }

    const body = (await req.json()) as IntegrityBody;
    if (!body.actionType?.trim()) {
      return NextResponse.json(
        { error: "Action type is required." },
        { status: 400 }
      );
    }

    const { shareCode } = await context.params;
    const result = await recordDebateDuelIntegrityEvent({
      shareCode,
      userId: user.id,
      actionType: body.actionType.trim(),
      metadata: body.metadata ?? {},
      source: "client",
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to log integrity event.";
    const status = message.includes("participant required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
