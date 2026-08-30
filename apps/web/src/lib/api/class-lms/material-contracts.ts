import { z } from "zod";

export const MATERIAL_PROCESSING_STATUSES = [
  "uploading",
  "queued",
  "scanning",
  "converting",
  "ready",
  "rejected",
  "failed",
] as const;

export const MATERIAL_PLACEMENT_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "withdrawn",
] as const;

export const MATERIAL_TARGET_TYPES = [
  "course",
  "class",
  "occurrence",
  "assignment",
] as const;

export const MATERIAL_RIGHTS_BASES = [
  "original",
  "commercial_license",
  "open_license",
  "internal_adaptation",
  "unknown",
] as const;

export const MATERIAL_RULE_KINDS = [
  "lesson_completed",
  "assignment_submitted",
  "minimum_score",
] as const;

export const MATERIAL_RENDITION_KINDS = [
  "original",
  "pdf_preview",
  "page_image",
  "thumbnail",
  "image_preview",
  "audio_stream",
] as const;

export const MATERIAL_CONTENT_REVIEW_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

export type MaterialProcessingStatus =
  (typeof MATERIAL_PROCESSING_STATUSES)[number];
export type MaterialPlacementStatus =
  (typeof MATERIAL_PLACEMENT_STATUSES)[number];
export type MaterialTargetType = (typeof MATERIAL_TARGET_TYPES)[number];
export type MaterialRightsBasis = (typeof MATERIAL_RIGHTS_BASES)[number];
export type MaterialRuleKind = (typeof MATERIAL_RULE_KINDS)[number];
export type MaterialRenditionKind = (typeof MATERIAL_RENDITION_KINDS)[number];
export type MaterialContentReviewStatus =
  (typeof MATERIAL_CONTENT_REVIEW_STATUSES)[number];

export const MATERIAL_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
] as const;

export const MATERIAL_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const MATERIAL_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
] as const;

export const MATERIAL_ALLOWED_MIME_TYPES = [
  ...MATERIAL_DOCUMENT_MIME_TYPES,
  ...MATERIAL_IMAGE_MIME_TYPES,
  ...MATERIAL_AUDIO_MIME_TYPES,
] as const;

export const MATERIAL_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;
export const MATERIAL_IMAGE_MAX_BYTES = 25 * 1024 * 1024;
export const MATERIAL_AUDIO_MAX_BYTES = 100 * 1024 * 1024;

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });

export function materialMaxBytesForMime(mimeType: string) {
  if ((MATERIAL_AUDIO_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return MATERIAL_AUDIO_MAX_BYTES;
  }
  if ((MATERIAL_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return MATERIAL_IMAGE_MAX_BYTES;
  }
  return MATERIAL_DOCUMENT_MAX_BYTES;
}

export const materialUploadInputSchema = z
  .object({
    clubId: uuid,
    scopeClassId: uuid.nullable().optional(),
    fileName: z.string().trim().min(1).max(200),
    mimeType: z.enum(MATERIAL_ALLOWED_MIME_TYPES),
    sizeBytes: z.number().int().positive(),
    idempotencyKey: z.string().trim().min(8).max(200).optional(),
    programType: z.enum(["ielts", "debate", "public_speaking"]).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.sizeBytes > materialMaxBytesForMime(value.mimeType)) {
      ctx.addIssue({
        code: "custom",
        path: ["sizeBytes"],
        message: "Material exceeds the size limit for this file type.",
      });
    }
    if (!value.scopeClassId && !value.programType) {
      ctx.addIssue({
        code: "custom",
        path: ["programType"],
        message: "Organisation materials require a program type.",
      });
    }
  });

export const materialRightsInputSchema = z
  .object({
    basis: z.enum(MATERIAL_RIGHTS_BASES),
    sourceUrl: z.string().url().nullable().optional(),
    rightsHolder: z.string().trim().max(300).nullable().optional(),
    licenseUrl: z.string().url().nullable().optional(),
    notes: z.string().trim().max(4_000).nullable().optional(),
  })
  .strict();

export const materialAccessRuleSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("lesson_completed"), occurrenceId: uuid })
    .strict(),
  z
    .object({ kind: z.literal("assignment_submitted"), assignmentId: uuid })
    .strict(),
  z
    .object({
      kind: z.literal("minimum_score"),
      assignmentId: uuid,
      minimumScore: z.number().finite().nonnegative(),
    })
    .strict(),
]);

export const materialPlacementInputSchema = z
  .object({
    materialId: uuid,
    versionId: uuid,
    targetType: z.enum(MATERIAL_TARGET_TYPES),
    courseId: uuid.nullable().optional(),
    classId: uuid.nullable().optional(),
    occurrenceId: uuid.nullable().optional(),
    assignmentId: uuid.nullable().optional(),
    status: z.enum(MATERIAL_PLACEMENT_STATUSES).default("draft"),
    releaseAt: timestamp.nullable().optional(),
    expiresAt: timestamp.nullable().optional(),
    required: z.boolean().default(false),
    orderIndex: z.number().int().nonnegative().default(0),
    audienceUserIds: z.array(uuid).max(500).default([]),
    rules: z.array(materialAccessRuleSchema).max(20).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    const targets = {
      course: value.courseId,
      class: value.classId,
      occurrence: value.occurrenceId,
      assignment: value.assignmentId,
    };
    const populated = Object.entries(targets).filter(([, id]) => Boolean(id));
    if (populated.length !== 1 || populated[0]?.[0] !== value.targetType) {
      ctx.addIssue({
        code: "custom",
        path: ["targetType"],
        message: "Placement must reference exactly one matching target.",
      });
    }
    if (
      value.releaseAt &&
      value.expiresAt &&
      Date.parse(value.expiresAt) <= Date.parse(value.releaseAt)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Expiry must be after release.",
      });
    }
    if (value.status === "scheduled" && !value.releaseAt) {
      ctx.addIssue({
        code: "custom",
        path: ["releaseAt"],
        message: "Scheduled placements require a release time.",
      });
    }
  });

export const materialBlockSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: z.string().min(1),
      type: z.literal("heading"),
      level: z.number().int().min(1).max(3),
      text: z.string(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal("paragraph"),
      text: z.string(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal("image"),
      renditionId: uuid,
      alt: z.string().max(1_000),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal("table"),
      rows: z.array(z.array(z.string())).max(200),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal("vocabulary"),
      terms: z
        .array(
          z
            .object({
              term: z.string(),
              definition: z.string(),
              translation: z.string().nullable().optional(),
            })
            .strict(),
        )
        .max(200),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal("instructions"),
      text: z.string(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal("audio"),
      renditionId: uuid,
      transcript: z.string().nullable().optional(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal("question"),
      prompt: z.string(),
      responseMode: z.enum(["none", "short_text", "long_text"]),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal("callout"),
      tone: z.enum(["info", "tip", "warning"]),
      text: z.string(),
    })
    .strict(),
  z.object({ id: z.string().min(1), type: z.literal("divider") }).strict(),
  z
    .object({
      id: z.string().min(1),
      type: z.literal("page_preview"),
      renditionId: uuid,
      pageNumber: z.number().int().positive(),
      alt: z.string().max(1_000),
    })
    .strict(),
]);

export const materialDocumentV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().trim().min(1).max(200),
    sourceVersionId: uuid,
    language: z.string().trim().min(2).max(20),
    sections: z
      .array(
        z
          .object({
            id: z.string().min(1),
            title: z.string().trim().max(200).nullable(),
            blocks: z.array(materialBlockSchema).max(500),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();

export type MaterialAccessRule = z.infer<typeof materialAccessRuleSchema>;
export type MaterialPlacementInput = z.infer<
  typeof materialPlacementInputSchema
>;
export type MaterialDocumentV1 = z.infer<typeof materialDocumentV1Schema>;

export function rightsRequireOwnerApproval(basis: MaterialRightsBasis) {
  return basis !== "original";
}

export type MaterialPreviewDescriptor = {
  materialId: string;
  placementId: string;
  versionId: string;
  renditionId: string;
  title: string;
  renditionKind: Exclude<MaterialRenditionKind, "original">;
  mimeType: string;
  pageNumber?: number | null;
  viewerUrl: string;
  expiresAt: string;
  watermark: { learnerLabel: string; classLabel: string };
};
