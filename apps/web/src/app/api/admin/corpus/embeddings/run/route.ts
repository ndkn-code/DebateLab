import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";
import {
  RequestValidationError,
  getNumber,
  readJsonObject,
} from "@/lib/api/request-validation";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { runCorpusEmbeddingBatch } from "@/lib/corpus/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRequestAuth(req);
    if (!auth.ok) return auth.errorResponse;
    const { supabase, user } = auth;
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await readJsonObject(req, { maxBytes: 8 * 1024 });
    const limit = getNumber(body, "limit", { min: 1, max: 16, defaultValue: 16 });
    const admin = tryCreateAdminClient() ?? supabase;
    const result = await runCorpusEmbeddingBatch({ supabase: admin, limit });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to run embeddings" },
      { status: 500 }
    );
  }
}
