import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";
import {
  RequestValidationError,
  getString,
  readJsonObject,
} from "@/lib/api/request-validation";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { importCorpusBundle } from "@/lib/corpus/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRequestAuth(req);
    if (!auth.ok) return auth.errorResponse;

    const { supabase, user } = auth;
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = tryCreateAdminClient() ?? supabase;
    const body = await readJsonObject(req, { maxBytes: 12 * 1024 * 1024 });
    const content = getString(body, "content", {
      required: true,
      minLength: 20,
      maxLength: 10 * 1024 * 1024,
    }) as string;
    const fileName = getString(body, "fileName", { maxLength: 240 });

    const result = await importCorpusBundle({
      supabase: admin,
      content,
      fileName,
      importedBy: auth.authSource === "dev-bypass" ? null : user.id,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to import corpus bundle",
      },
      { status: 500 }
    );
  }
}
