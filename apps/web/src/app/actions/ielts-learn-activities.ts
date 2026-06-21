"use server";

import {
  loadIeltsTextActivityView as loadIeltsTextActivityViewFromRepository,
} from "@/lib/api/ielts/learn-activities";
import type { IeltsTextActivityView } from "@/lib/ielts/learn/text-activities";

export async function loadIeltsTextActivityView(
  content: unknown,
): Promise<IeltsTextActivityView> {
  return loadIeltsTextActivityViewFromRepository(content);
}
