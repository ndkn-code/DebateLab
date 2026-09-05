import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { createTypedServerClient } from "@/lib/supabase/server";
import { requireClubOwner } from "@/lib/api/class-manager-access";
import { planStagedRosterSheet, type StagedSheet } from "./sheets";
import {
  resolveRosterImport,
  commitRosterImport,
} from "@/lib/api/roster/import/execute";
import type { RosterColumnMapping } from "@/lib/api/roster/import/column-map";

async function context(clubId: string) {
  if (process.env.CENTER_OPERATIONS_V1 !== "true")
    throw new Error("Center operations are unavailable.");
  const supabase = await createTypedServerClient();
  await requireClubOwner(supabase, clubId);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in again.");
  return {
    supabase: supabase as unknown as SupabaseClient,
    clubId,
    actorId: user.id,
    classId: null,
  };
}
export async function listSheetStages(clubId: string): Promise<StagedSheet[]> {
  const { supabase } = await context(clubId);
  const { data, error } = await supabase
    .from("center_sheet_staging")
    .select("id,rows,status,created_at")
    .eq("club_id", clubId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return data as unknown as StagedSheet[];
}
export async function reviewSheetImport(
  clubId: string,
  stageId: string,
  mapping: RosterColumnMapping,
  commit = false,
) {
  const ctx = await context(clubId);
  const { data, error } = await ctx.supabase
    .from("center_sheet_staging")
    .select("id,rows,status,created_at")
    .eq("club_id", clubId)
    .eq("id", stageId)
    .single();
  if (error || !data) throw new Error("Sheet import unavailable.");
  const plan = planStagedRosterSheet(data as unknown as StagedSheet, mapping);
  if (!commit) return resolveRosterImport(plan, ctx);
  const key = `sheet:${stageId}:${createHash("sha256").update(JSON.stringify(mapping)).digest("hex")}`;
  const report = await commitRosterImport(plan, ctx, {
    idempotencyKey: key,
    sourceFilename: `google:${stageId}`,
  });
  if (report.batchId) {
    const result = await ctx.supabase.rpc("center_finish_sheet_import", {
      p_staging_id: stageId,
      p_batch_id: report.batchId,
    });
    if (result.error) throw new Error(result.error.message);
  }
  return report;
}
