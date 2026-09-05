import "server-only";

import { z } from "zod";
import { createTypedServerClient } from "@/lib/supabase/server";
import { isIeltsAccessible } from "@/lib/ielts/access";
import {
  CLASS_JOIN_STATUSES,
  isClassJoinCode,
  normalizeClassJoinCode,
  type ClassJoinResult,
  type ClassInvitationResult,
} from "./contracts";

const codeSchema = z.object({ code: z.string().max(128) }).strict();
const managerSchema = z
  .object({
    classId: z.string().uuid(),
    action: z.enum(["get", "create", "replace", "revoke"]),
    expectedId: z.string().uuid().optional(),
  })
  .strict();
const resultSchema = z.object({
  status: z.enum(CLASS_JOIN_STATUSES),
  classId: z.string().uuid().optional(),
  classTitle: z.string().optional(),
  organizationName: z.string().optional(),
  programType: z.string().optional(),
  expiresAt: z.string().optional(),
});
const invitationSchema = z.object({
  status: z.enum(CLASS_JOIN_STATUSES).optional(),
  invitation: z
    .object({
      id: z.string().uuid(),
      code: z.string().regex(/^[a-f0-9]{32}$/),
      expiresAt: z.string(),
      maxUses: z.number().int(),
      useCount: z.number().int(),
      revokedAt: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

// These RPC signatures ship with the pending migration. Keep the narrow adapter
// until DB types can be regenerated after the separately approved DB release.
export interface ClassJoinDependencies {
  userId(): Promise<string | null>;
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
  ieltsAccessible(): Promise<boolean>;
}
async function dependencies(): Promise<ClassJoinDependencies> {
  const db = await createTypedServerClient();
  return {
    async userId() {
      const { data, error } = await db.auth.getUser();
      return error ? null : (data.user?.id ?? null);
    },
    rpc: (name, args) =>
      (db as unknown as Pick<ClassJoinDependencies, "rpc">).rpc(name, args),
    ieltsAccessible: isIeltsAccessible,
  };
}

/** No client-selected user id or service role. SQL binds every claim to auth.uid(). */
export async function runClassJoin(
  raw: unknown,
  claim: boolean,
  deps: ClassJoinDependencies,
): Promise<ClassJoinResult> {
  const input = codeSchema.safeParse(raw);
  if (!input.success) return { status: "invalid" };
  const code = normalizeClassJoinCode(input.data.code);
  if (!isClassJoinCode(code)) return { status: "invalid" };
  try {
    if (!(await deps.userId())) return { status: "sign_in_required" };
    const preview = await deps.rpc("resolve_class_join_invitation", {
      p_code: code,
    });
    if (preview.error) return { status: "unavailable" };
    const parsed = resultSchema.safeParse(preview.data);
    if (!parsed.success) return { status: "unavailable" };
    // The SQL membership grant cannot change the launch gate. Also keep the
    // application flow closed before showing IELTS metadata or attempting a claim.
    if (
      parsed.data.programType === "ielts" &&
      !(await deps.ieltsAccessible())
    ) {
      return { status: "ineligible" };
    }
    if (!claim || parsed.data.status !== "ready") return parsed.data;
    const result = await deps.rpc("claim_class_join_invitation", {
      p_code: code,
    });
    if (result.error) return { status: "unavailable" };
    const joined = resultSchema.safeParse(result.data);
    return joined.success ? joined.data : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function manageInvitation(
  raw: unknown,
  deps?: ClassJoinDependencies,
): Promise<ClassInvitationResult> {
  const input = managerSchema.safeParse(raw);
  if (!input.success) return { status: "invalid" };
  try {
    const context = deps ?? (await dependencies());
    if (!(await context.userId())) return { status: "sign_in_required" };
    const response = await context.rpc("manage_class_join_invitation", {
      p_class_id: input.data.classId,
      p_action: input.data.action,
      p_expected_id: input.data.expectedId ?? null,
    });
    if (response.error) return { status: "unavailable" };
    const result = invitationSchema.safeParse(response.data);
    return result.success ? result.data : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
export async function previewInvitation(raw: unknown) {
  try {
    return await runClassJoin(raw, false, await dependencies());
  } catch {
    return { status: "unavailable" } satisfies ClassJoinResult;
  }
}
export async function claimInvitation(raw: unknown) {
  try {
    return await runClassJoin(raw, true, await dependencies());
  } catch {
    return { status: "unavailable" } satisfies ClassJoinResult;
  }
}
