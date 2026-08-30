import { NextRequest, NextResponse } from "next/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function resolveLimit(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("limit");
  const parsed = raw ? Number(raw) : DEFAULT_LIMIT;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
}

type CleanupRow = {
  submission_id: string;
  previous_state: string;
  removed_paths: string[];
};

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const admin = createTypedAdminClient();
    const rpcClient = admin as unknown as {
      rpc<T>(name: string, args: Record<string, unknown>): Promise<{
        data: T | null;
        error: { message: string } | null;
      }>;
    };
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data, error } = await rpcClient.rpc<CleanupRow[]>("cleanup_stale_homework_submissions", {
      p_before: cutoff,
      p_limit: resolveLimit(request),
    });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    let removedFiles = 0;
    let failedFiles = 0;
    for (const row of rows) {
      let cleanupError: string | null = null;
      if (row.removed_paths?.length) {
        const { error: removeError } = await admin.storage
          .from("assignment-submissions")
          .remove(row.removed_paths);
        cleanupError = removeError?.message ?? null;
        if (cleanupError) failedFiles += row.removed_paths.length;
        else removedFiles += row.removed_paths.length;
      }
      const { error: recordError } = await rpcClient.rpc<string>(
        "record_homework_cleanup_result",
        {
          p_submission_id: row.submission_id,
          p_success: cleanupError === null,
          p_error: cleanupError,
        },
      );
      if (recordError) throw new Error(recordError.message);
    }
    return NextResponse.json({
      ok: true,
      processed: rows.length,
      removedFiles,
      failedFiles,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Homework cleanup failed." },
      { status: 500 },
    );
  }
}
