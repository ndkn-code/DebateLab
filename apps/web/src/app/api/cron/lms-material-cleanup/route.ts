import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MATERIAL_BUCKETS } from "@/lib/api/class-lms/material-pipeline/contracts";
import {
  listStaleVersions,
  markVersionExpired,
} from "@/lib/api/class-lms/material-pipeline/repository";
import { SHARED_LMS_MATERIALS_V1 } from "@/lib/features";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return (
    Boolean(secret) &&
    request.headers.get("authorization") === `Bearer ${secret}`
  );
}

export async function GET(request: NextRequest) {
  if (!SHARED_LMS_MATERIALS_V1)
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!authorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = Number(request.nextUrl.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(raw)
    ? Math.max(1, Math.min(1_000, Math.floor(raw)))
    : 100;
  const ageMinutes = Number(
    request.nextUrl.searchParams.get("ageMinutes") ?? 60,
  );
  const cutoff = new Date(
    Date.now() -
      Math.max(
        15,
        Math.min(24 * 60, Number.isFinite(ageMinutes) ? ageMinutes : 60),
      ) *
        60_000,
  ).toISOString();
  try {
    const admin = createAdminClient();
    const rows = await listStaleVersions(admin, cutoff, limit);
    let removed = 0;
    let failed = 0;
    for (const row of rows) {
      const claimed = await markVersionExpired(
        admin,
        String(row.id),
        String(row.updated_at),
      );
      if (!claimed) continue;
      const paths = [row.ingest_path].filter(
        (path): path is string => typeof path === "string" && path.length > 0,
      );
      if (!paths.length) continue;
      const result = await admin.storage
        .from(MATERIAL_BUCKETS.ingest)
        .remove(paths);
      if (result.error) failed += paths.length;
      else removed += paths.length;
    }
    return NextResponse.json({
      ok: true,
      processed: rows.length,
      removed,
      failed,
      cutoff,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Material cleanup failed.",
      },
      { status: 500 },
    );
  }
}
