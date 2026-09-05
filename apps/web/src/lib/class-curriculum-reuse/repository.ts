import "server-only";

import { z } from "zod";
import { createTypedServerClient } from "@/lib/supabase/server";
import { isIeltsAccessible } from "@/lib/ielts/access";
import {
  reuseDatesSchema,
  reuseInputSchema,
  reuseErrorCode,
  type ReuseSource,
  type ReusePreview,
  type ReuseResult,
} from "./contracts";

// Additive RPC contract: the migration is intentionally not applied to production.
// Keep this narrow until generated Supabase types include that migration.
type ReuseRpcClient = {
  rpc(
    name:
      | "list_class_reuse_sources"
      | "preview_class_curriculum_reuse"
      | "create_class_curriculum_reuse",
    args?: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};
async function rpc<T>(
  name: Parameters<ReuseRpcClient["rpc"]>[0],
  args?: Record<string, unknown>,
): Promise<T> {
  const db = await createTypedServerClient();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) throw new Error("REUSE_FORBIDDEN");
  const { data, error } = await (db as unknown as ReuseRpcClient).rpc(
    name,
    args,
  );
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("REUSE_FAILED");
  return data as T;
}
async function result<T>(run: () => Promise<T>): Promise<ReuseResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    return { ok: false, code: reuseErrorCode(error) };
  }
}
export function listReuseSources(): Promise<ReuseResult<ReuseSource[]>> {
  return result(async () => {
    const sources = await rpc<ReuseSource[]>("list_class_reuse_sources");
    const ieltsAllowed = await isIeltsAccessible();
    return sources.filter(
      (source) => source.programType !== "ielts" || ieltsAllowed,
    );
  });
}
export function previewReuse(
  rawSourceId: unknown,
  rawDates?: unknown,
): Promise<ReuseResult<ReusePreview>> {
  return result(async () => {
    const sourceId = z.string().uuid().parse(rawSourceId);
    const dates =
      rawDates === undefined ? null : reuseDatesSchema.parse(rawDates);
    const preview = await rpc<ReusePreview>("preview_class_curriculum_reuse", {
      p_source_class_id: sourceId,
      p_dates: dates,
    });
    if (preview.source.programType === "ielts" && !(await isIeltsAccessible()))
      throw new Error("REUSE_FORBIDDEN");
    return preview;
  });
}
export function commitReuse(
  rawInput: unknown,
): Promise<ReuseResult<{ classId: string }>> {
  return result(async () => {
    const input = reuseInputSchema.parse(rawInput);
    // SQL reauthorizes even on receipt replay; this action also preserves the launch gate.
    const sources = await rpc<ReuseSource[]>("list_class_reuse_sources");
    const source = sources.find((item) => item.id === input.sourceClassId);
    if (
      !source ||
      (source.programType === "ielts" && !(await isIeltsAccessible()))
    )
      throw new Error("REUSE_FORBIDDEN");
    const created = await rpc<{ classId: string }>(
      "create_class_curriculum_reuse",
      { p_input: input },
    );
    return z.object({ classId: z.string().uuid() }).parse(created);
  });
}
