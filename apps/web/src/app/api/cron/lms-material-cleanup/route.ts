import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MATERIAL_BUCKETS } from "@/lib/api/class-lms/material-pipeline/contracts";
import { listStaleVersions, markVersionExpired } from "@/lib/api/class-lms/material-pipeline/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = Number(request.nextUrl.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(raw) ? Math.max(1, Math.min(1_000, Math.floor(raw))) : 100;
  const ageMinutes = Number(request.nextUrl.searchParams.get("ageMinutes") ?? 60);
  const cutoff = new Date(Date.now() - Math.max(15, Math.min(24 * 60, Number.isFinite(ageMinutes) ? ageMinutes : 60)) * 60_000).toISOString();
  try {
    const admin = createAdminClient();
    const rows = await listStaleVersions(admin, cutoff, limit);
    let removed = 0;
    let failed = 0;
    for (const row of rows) {
      for (const bucket of [MATERIAL_BUCKETS.ingest, MATERIAL_BUCKETS.originals]) {
        const bucketPaths = bucket === MATERIAL_BUCKETS.ingest ? [row.ingest_path] : [row.original_path];
        const valid = bucketPaths.filter((path): path is string => typeof path === "string" && path.length > 0);
        if (!valid.length) continue;
        const result = await admin.storage.from(bucket).remove(valid);
        if (result.error) failed += valid.length;
        else removed += valid.length;
      }
      await markVersionExpired(admin, String(row.id));
    }
    return NextResponse.json({ ok: true, processed: rows.length, removed, failed, cutoff });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Material cleanup failed." }, { status: 500 });
  }
}
