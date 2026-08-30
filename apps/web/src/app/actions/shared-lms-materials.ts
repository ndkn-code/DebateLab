"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput } from "@/lib/api/boundary";
import { createTypedServerClient } from "@/lib/supabase/server";
import {
  materialAccessRuleSchema,
  materialPlacementInputSchema,
  materialRightsInputSchema,
  materialMaxBytesForMime,
  materialUploadInputSchema,
} from "@/lib/api/class-lms/material-contracts";
import {
  listLearnerMaterials,
  listManagerMaterials,
  loadLearnerMaterialsForWeek,
  placeSharedMaterial,
  publishSharedMaterial,
  prepareSharedMaterialUpload as prepareSharedMaterialUploadRpc,
  setSharedMaterialAudience,
  setSharedMaterialRights,
  setSharedMaterialRules,
  withdrawSharedMaterial,
} from "@/lib/api/class-lms/materials-repository";

const placementCommandSchema = materialPlacementInputSchema;
const managerListSchema = z.object({
  classId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  status: z.enum(["draft", "scheduled", "published", "withdrawn"]).optional(),
  cursor: z.string().max(512).nullable().optional(),
  limit: z.number().int().min(1).max(100).optional(),
}).strict();
const audienceCommandSchema = z.object({ placementId: z.string().uuid(), classId: z.string().uuid(), userIds: z.array(z.string().uuid()).max(500) }).strict();
const ruleCommandSchema = z.object({ placementId: z.string().uuid(), rules: z.array(materialAccessRuleSchema).max(20) }).strict();
const rightsCommandSchema = z.object({ materialId: z.string().uuid(), versionId: z.string().uuid(), ...materialRightsInputSchema.shape }).strict();
const learnerWeekSchema = z.object({ classId: z.string().uuid().optional(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();
const materialVersionSchema = z.object({ materialId: z.string().uuid(), versionId: z.string().uuid() }).strict();

export async function prepareSharedMaterialUpload(raw: unknown) {
  const input = parseInput(materialUploadInputSchema, raw);
  const reservation = await prepareSharedMaterialUploadRpc(input);
  const db = await createTypedServerClient();
  const upload = await db.storage.from(reservation.bucketId).createSignedUploadUrl(reservation.storagePath);
  if (upload.error) throw new Error(`prepareSharedMaterialUpload: ${upload.error.message}`);
  return {
    materialId: reservation.materialId,
    versionId: reservation.versionId,
    bucketId: reservation.bucketId,
    mimeType: reservation.mimeType,
    sizeBytes: reservation.sizeBytes,
    token: upload.data.token,
    signedUrl: upload.data.signedUrl,
    expiresInSeconds: 15 * 60,
    maxSizeBytes: materialMaxBytesForMime(input.mimeType),
  };
}

export async function placeSharedLmsMaterial(raw: unknown) {
  const input = parseInput(placementCommandSchema, raw);
  const result = await placeSharedMaterial(input);
  revalidatePath("/dashboard/teacher/materials");
  return result;
}

export async function updateSharedMaterialAudience(raw: unknown) {
  const input = parseInput(audienceCommandSchema, raw);
  const result = await setSharedMaterialAudience(input);
  revalidatePath("/dashboard/teacher/materials");
  return result;
}

export async function updateSharedMaterialUnlockRules(raw: unknown) {
  const input = parseInput(ruleCommandSchema, raw);
  const result = await setSharedMaterialRules(input);
  revalidatePath("/dashboard/teacher/materials");
  return result;
}

export async function approveSharedMaterialRights(raw: unknown) {
  const input = parseInput(rightsCommandSchema, raw);
  const result = await setSharedMaterialRights(input);
  revalidatePath("/dashboard/teacher/materials");
  return result;
}

export async function publishSharedLmsMaterial(raw: unknown) {
  const input = parseInput(materialVersionSchema, raw);
  const result = await publishSharedMaterial(input.materialId, input.versionId);
  revalidatePath("/dashboard/teacher/materials");
  return result;
}

export async function withdrawSharedLmsMaterial(raw: unknown) {
  const input = parseInput(z.object({ materialId: z.string().uuid(), placementId: z.string().uuid() }).strict(), raw);
  const result = await withdrawSharedMaterial(input.materialId, input.placementId);
  revalidatePath("/dashboard/teacher/materials");
  return result;
}

export async function loadTeacherSharedMaterials(raw: unknown) {
  return listManagerMaterials(parseInput(managerListSchema, raw));
}

export async function loadMySharedMaterials(raw: unknown) {
  return listLearnerMaterials(parseInput(learnerWeekSchema, raw));
}

export async function loadMySharedMaterialsWeek(raw: unknown) {
  return loadLearnerMaterialsForWeek(parseInput(learnerWeekSchema, raw));
}
