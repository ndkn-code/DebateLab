import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { requireClassManager, requireClubOwner } from "@/lib/api/class-manager-access";
import { materialIngestSchema } from "@/lib/api/class-lms/material-pipeline/contracts";
import { createMaterialIngest } from "@/lib/api/class-lms/material-pipeline/service";

export const dynamic = "force-dynamic";

async function requireManager(auth: Extract<Awaited<ReturnType<typeof requireRequestAuth>>, { ok: true }>, clubId: string, classId: string | null) {
  if (classId) {
    const context = await requireClassManager(auth.supabase as never, classId);
    if (context.clubId !== clubId) throw new Error("Class does not belong to this organisation.");
    return context.userId;
  }
  return requireClubOwner(auth.supabase as never, clubId);
}

export async function POST(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;
  try {
    const parsed = materialIngestSchema.parse(await request.json());
    const actorId = await requireManager(auth, parsed.clubId, parsed.scopeClassId ?? null);
    const result = await createMaterialIngest(auth.supabase, parsed, actorId || randomUUID());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare material upload.";
    const status = /forbidden|unauthorized/i.test(message) ? 403 : /invalid|too large|unsupported|required/i.test(message) ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
