import { NextRequest, NextResponse } from "next/server";
import { IELTS_ENABLED } from "@/lib/features";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import {
  listActivePlansDueForReplan,
  replanIeltsStudyPlanForUser,
} from "@/lib/api/ielts/study-plan-replan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 2000;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function resolveLimit(request: NextRequest): number {
  const raw = request.nextUrl.searchParams.get("limit");
  const parsed = raw ? Number(raw) : undefined;
  if (!parsed || !Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
}

/**
 * WS-6.2.4 — nightly/weekly study-plan reassessment pass.
 *
 * Selects active plans whose `next_reassessment_at` is due (or never set) and
 * runs a `scheduled_pass` replan on each. The replan is idempotent: plans with
 * no material change only advance their cursor, so the batch never thrashes.
 * Per-plan failures are isolated so one bad plan never aborts the run.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!IELTS_ENABLED) {
    return NextResponse.json({ ok: true, enabled: false, processed: 0 });
  }

  const limit = resolveLimit(request);

  try {
    const admin = createTypedAdminClient();
    const asOf = new Date().toISOString();
    const due = await listActivePlansDueForReplan({ client: admin, asOf, limit });

    let replanned = 0;
    let unchanged = 0;
    let failed = 0;
    for (const plan of due) {
      try {
        const outcome = await replanIeltsStudyPlanForUser({
          userId: plan.userId,
          trigger: "scheduled_pass",
          client: admin,
        });
        if (outcome.changed) replanned += 1;
        else unchanged += 1;
      } catch (error) {
        failed += 1;
        console.error(
          `[ielts-replan-cron] plan ${plan.planId} failed:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      enabled: true,
      processed: due.length,
      replanned,
      unchanged,
      failed,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "IELTS replan cron failed.",
      },
      { status: 500 },
    );
  }
}
