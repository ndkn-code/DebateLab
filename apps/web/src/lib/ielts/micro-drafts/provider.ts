import "server-only";

import { generateStructured } from "@/lib/ai/core";
import { GeneratedMicroDraftsSchema, type GeneratedMicroDraft } from "./schema";

const SOURCE_ROUTE = "ielts_micro_item_drafts";
const OUTPUT_TYPE = "ielts_micro_item_drafts";

export interface MicroDraftModelAudit {
  userId: string | null;
  questionId: string;
}

export interface MicroDraftModelResult {
  drafts: GeneratedMicroDraft[];
  providerLabel: string;
  modelName: string;
}

export async function runMicroDraftModel(params: {
  prompt: string;
  audit: MicroDraftModelAudit;
}): Promise<MicroDraftModelResult> {
  const result = await generateStructured({
    task: "ielts_micro_drafts",
    prompt: params.prompt,
    schema: GeneratedMicroDraftsSchema,
    context: {
      task: "ielts_micro_drafts",
      sourceRoute: SOURCE_ROUTE,
      outputType: OUTPUT_TYPE,
      userId: params.audit.userId,
      idempotencyKey: `ielts-micro-draft:${params.audit.questionId}`,
      metadata: { questionId: params.audit.questionId },
    },
  });
  return {
    drafts: result.output.drafts,
    providerLabel: result.provider === "gemini" ? "google" : result.provider,
    modelName: result.model,
  };
}
