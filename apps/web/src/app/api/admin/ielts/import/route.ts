/**
 * Bulk-import endpoint (WS-1.1). Admin-only. Accepts a multipart upload of the
 * authoring workbook (.xlsx) — or a single-tab .csv with a `sheetName` — plus a
 * target `testId`, then imports through the canonical create paths and returns a
 * per-row report. Writes use the service-role client after the admin gate.
 */
import { NextResponse, type NextRequest } from "next/server";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { isUuid } from "@/lib/api/request-validation";
import { isAdminUser } from "@/lib/auth/admin";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import {
  importIeltsWorkbook,
  parseCsvSheet,
  parseXlsxWorkbook,
  type ParsedWorkbook,
} from "@/lib/api/ielts/import";

export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024;

async function readWorkbook(file: File, form: FormData): Promise<ParsedWorkbook> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.name.toLowerCase().endsWith(".csv")) {
    const sheetName = String(form.get("sheetName") ?? "").trim();
    if (!sheetName) throw new Error("CSV import requires a sheetName (the template tab name).");
    return { sheets: [parseCsvSheet(sheetName, new TextDecoder().decode(bytes))] };
  }
  return parseXlsxWorkbook(bytes);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRequestAuth(req);
    if (!auth.ok) return auth.errorResponse;
    if (!(await isAdminUser(auth.supabase, auth.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const form = await req.formData();
    const testId = String(form.get("testId") ?? "");
    if (!isUuid(testId)) {
      return NextResponse.json({ error: "A valid testId is required." }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "A workbook file is required." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 15MB)." }, { status: 400 });
    }

    const workbook = await readWorkbook(file, form);
    const report = await importIeltsWorkbook(workbook, testId, createTypedAdminClient());
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
