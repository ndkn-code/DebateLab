import { z } from "zod";

import type { IeltsCoachOutput } from "./ielts-contract";

export const IELTS_COACH_CONTEXT_TYPES = [
  "ielts-coach",
  "ielts-home",
  "ielts-study-plan",
] as const;

export const ieltsCoachContextTypeSchema = z.enum(IELTS_COACH_CONTEXT_TYPES);
export type IeltsCoachContextType = z.infer<
  typeof ieltsCoachContextTypeSchema
>;

/** Stable request body for the non-visual IELTS Coach client integration. */
export interface IeltsCoachApiRequest {
  message: string;
  conversationId?: string;
  requestId: string;
  contextType: IeltsCoachContextType;
  contextId?: string;
  locale: "en" | "vi";
}

/** Learner-safe metadata; provider/model details stay server-side. */
export interface IeltsCoachResponseMetadata {
  contractVersion: "ielts-coach-response.v1";
  productContext: "ielts";
  runId: string;
  requestId: string;
  promptVersion: string;
  rubricVersion: string;
  coach: IeltsCoachOutput;
  evidenceReferences: IeltsCoachOutput["sources"];
  confidence: IeltsCoachOutput["confidence"];
}

export type IeltsCoachSseEvent =
  | {
      text: string;
      conversationId: string;
      productContext: "ielts";
    }
  | {
      done: true;
      conversationId: string;
      assistantMessageId: string | null;
      productContext: "ielts";
      metadata: IeltsCoachResponseMetadata;
    };

export interface IeltsCoachProcessingResponse {
  status: "processing";
  code: "IELTS_COACH_IN_PROGRESS";
  runId: string;
  requestId: string;
  retryAfterSeconds: number;
}
