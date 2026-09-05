import { z } from "zod";

export const QUESTION_IMPORT_FEATURE_FLAG = "LMS_QUESTION_IMPORT_ENABLED" as const;
export const QUESTION_IMPORT_COMPLIANCE_FLAG = "LMS_QUESTION_IMPORT_COMPLIANCE_APPROVED" as const;
export const QUESTION_IMPORT_LIMITS = {
  maxDocuments: 5,
  maxPdfBytes: 25 * 1024 * 1024,
  maxPdfPages: 100,
  maxAudioBytes: 100 * 1024 * 1024,
  pagesPerMonth: 500,
  questionsPerMonth: 1_000,
  concurrentJobs: 2,
} as const;

export const RIGHTS_ATTESTATION_VERSION = "2026-09-04.v1" as const;
export const IELTS_VARIANTS = ["academic", "general_training"] as const;
export const IELTS_SKILLS = ["listening", "reading", "writing", "speaking"] as const;
export const ANSWER_SOURCES = ["document", "ai_suggested", "teacher"] as const;
export const QUESTION_IMPORT_STATES = ["draft", "queued", "processing", "review", "submitted", "published", "failed", "quarantined"] as const;

export const questionImportDocumentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.literal("application/pdf"),
  sizeBytes: z.number().int().positive().max(QUESTION_IMPORT_LIMITS.maxPdfBytes),
  storagePath: z.string().trim().min(1).max(500),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();

export const questionImportPrepareSchema = z.object({
  clubId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  variant: z.enum(IELTS_VARIANTS).default("academic"),
  documents: z.array(questionImportDocumentSchema).min(1).max(QUESTION_IMPORT_LIMITS.maxDocuments),
  audio: z.array(z.object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.enum(["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav"]),
    sizeBytes: z.number().int().positive().max(QUESTION_IMPORT_LIMITS.maxAudioBytes),
    storagePath: z.string().trim().min(1).max(500),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  }).strict()).max(1).default([]),
  rightsAttestation: z.object({
    version: z.literal(RIGHTS_ATTESTATION_VERSION),
    accepted: z.literal(true),
    locale: z.enum(["en", "vi"]),
  }).strict(),
  idempotencyKey: z.string().trim().min(8).max(200),
}).strict();

export type QuestionImportPrepareInput = z.infer<typeof questionImportPrepareSchema>;
export type QuestionImportState = (typeof QUESTION_IMPORT_STATES)[number];
export type IeltsVariant = (typeof IELTS_VARIANTS)[number];
export type IeltsSkill = (typeof IELTS_SKILLS)[number];
export type AnswerSource = (typeof ANSWER_SOURCES)[number];

export function validateQuestionImportLimits(input: QuestionImportPrepareInput, pageCounts: number[]) {
  if (input.documents.length > QUESTION_IMPORT_LIMITS.maxDocuments) throw new Error("A batch may contain at most five PDFs.");
  if (pageCounts.length !== input.documents.length) throw new Error("Page inspection is required for every PDF.");
  pageCounts.forEach((pages, index) => {
    if (!Number.isInteger(pages) || pages < 1 || pages > QUESTION_IMPORT_LIMITS.maxPdfPages) {
      throw new Error(`PDF ${index + 1} must contain between 1 and 100 pages.`);
    }
  });
  return { pages: pageCounts.reduce((sum, pages) => sum + pages, 0), documents: input.documents.length };
}

export function rateLimitPolicy(action: "prepare" | "finalize" | "retry") {
  if (action === "prepare") return { scope: "lms-question-import:prepare", limit: 10, windowSeconds: 600 } as const;
  if (action === "finalize") return { scope: "lms-question-import:finalize", limit: 6, windowSeconds: 3600 } as const;
  return { scope: "lms-question-import:retry", limit: 3, windowSeconds: 86400 } as const;
}

export function canPublishQuestion(input: { validationIssues: readonly string[]; answerSource?: AnswerSource; confirmedByTeacher: boolean; hasRequiredMedia: boolean }) {
  return input.validationIssues.length === 0 && input.hasRequiredMedia && (input.answerSource !== "ai_suggested" || input.confirmedByTeacher);
}
