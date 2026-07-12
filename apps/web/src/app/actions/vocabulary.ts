"use server";

import { revalidatePath } from "next/cache";
import { deleteVocab, listVocab, upsertVocab } from "@/lib/api/vocab";

export async function searchVocabulary(input: Parameters<typeof listVocab>[0]) {
  return listVocab(input);
}

export async function saveVocabulary(input: unknown) {
  const item = await upsertVocab(input);
  revalidatePath("/dashboard/admin/vocabulary");
  return item;
}

export async function removeVocabulary(id: string) {
  await deleteVocab(id);
  revalidatePath("/dashboard/admin/vocabulary");
}
