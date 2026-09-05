import "server-only";

import { z } from "zod";
import type { CenterGuardianProgress } from "./contracts";
import { createTypedServerClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const inviteInput = z
  .object({
    clubId: uuid,
    studentRecordId: uuid,
    fullName: z.string().trim().min(1).max(200),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().min(6).max(30).optional(),
    key: z.string().min(8).max(200),
  })
  .refine((value) => value.email || value.phone, {
    message: "Email or phone is required",
  });
const claimInput = z.object({ token: z.string().min(20).max(256) });
const linkInput = z.object({
  clubId: uuid,
  guardianId: uuid,
  studentRecordId: uuid,
});
const progressInput = z.object({ studentRecordId: uuid });
const preferencesInput = z.object({
  guardianId: uuid,
  studentRecordId: uuid,
  preferences: z
    .object({
      classChanges: z.boolean().optional(),
      progressSummary: z.boolean().optional(),
      renewal: z.boolean().optional(),
    })
    .strict(),
});

type RpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};
const client = async () =>
  (await createTypedServerClient()) as unknown as RpcClient;
function enabled() {
  if (process.env.CENTER_OPERATIONS_V1 !== "true")
    throw new Error("Center operations are unavailable.");
}
async function call(name: string, args: Record<string, unknown>) {
  enabled();
  const result = await (await client()).rpc(name, args);
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return result.data;
}

export async function createGuardianInvite(input: unknown) {
  const value = inviteInput.parse(input);
  return call("center_create_guardian_invite", {
    p_club_id: value.clubId,
    p_student_record_id: value.studentRecordId,
    p_full_name: value.fullName,
    p_email: value.email ?? null,
    p_phone: value.phone ?? null,
    p_key: value.key,
  });
}
export async function claimGuardianInvite(input: unknown) {
  const value = claimInput.parse(input);
  return call("center_claim_guardian_invite", { p_token: value.token });
}
export async function revokeGuardianLink(input: unknown) {
  const value = linkInput.parse(input);
  return call("center_revoke_guardian_link", {
    p_club_id: value.clubId,
    p_guardian_id: value.guardianId,
    p_student_record_id: value.studentRecordId,
  });
}
export async function loadGuardianProgress(input: unknown) {
  const value = progressInput.parse(input);
  return (await call("center_guardian_progress", {
    p_student_record_id: value.studentRecordId,
  })) as CenterGuardianProgress;
}
export async function setGuardianPreferences(input: unknown) {
  const value = preferencesInput.parse(input);
  return call("center_guardian_set_preferences", {
    p_guardian_id: value.guardianId,
    p_student_record_id: value.studentRecordId,
    p_preferences: value.preferences,
  });
}
export const claimCenterGuardianInvite = claimGuardianInvite;
export const loadCenterGuardianProgress = loadGuardianProgress;
export const setCenterGuardianPreferences = setGuardianPreferences;
