"use server";

import { revalidatePath } from "next/cache";

import {
  deleteResource,
  uploadResourceFile,
  upsertResource,
} from "@/lib/api/resources";
import type { ResourceUpsertInput } from "@/lib/api/resources-model";

export async function saveResourceAction(input: ResourceUpsertInput) {
  const resource = await upsertResource(input);
  revalidatePath("/dashboard/admin/resources");
  revalidatePath("/resources");
  return resource;
}

export async function deleteResourceAction(resourceId: string) {
  await deleteResource(resourceId);
  revalidatePath("/dashboard/admin/resources");
  revalidatePath("/resources");
}

export async function createResourceUploadAction(input: {
  resourceId: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
}) {
  return uploadResourceFile(input);
}
