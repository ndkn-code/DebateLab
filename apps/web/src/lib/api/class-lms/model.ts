import { z } from "zod";

export const LMS_PILOT_FEATURE_KEY = "ielts_lms_pilot_v1" as const;
export const LMS_ANNOUNCEMENT_STATUSES = ["draft", "published", "archived"] as const;
export const LMS_CONTENT_STATUSES = ["draft", "published", "archived"] as const;
export const LMS_LICENSE_STATUSES = ["pending", "approved", "restricted", "rejected"] as const;
export const LMS_RESOURCE_BUCKET = "lms-resources" as const;
export const LMS_RESOURCE_MAX_SIZE_BYTES = 25 * 1024 * 1024;
export const LMS_RESOURCE_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
] as const;

const nonEmptyText = (max: number) => z.string().trim().min(1).max(max);
const uuid = z.string().uuid();

export const announcementInputSchema = z.object({
  classId: uuid,
  title: nonEmptyText(200),
  body: nonEmptyText(20_000),
  status: z.enum(LMS_ANNOUNCEMENT_STATUSES).default("draft"),
  publishAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict();

export const announcementUpdateSchema = announcementInputSchema.extend({ id: uuid }).strict();

export const resourceInputSchema = z.object({
  clubId: uuid,
  scopeClassId: uuid.nullable().optional(),
  title: nonEmptyText(200),
  description: z.string().trim().max(2_000).nullable().optional(),
  kind: z.enum(["link", "file"]),
  url: z.string().url().nullable().optional(),
  storagePath: z.string().trim().min(1).max(500).nullable().optional(),
  mimeType: z.string().trim().max(200).nullable().optional(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
  provenance: z.string().trim().max(2_000).nullable().optional(),
  licenseStatus: z.enum(LMS_LICENSE_STATUSES).default("pending"),
  status: z.enum(LMS_CONTENT_STATUSES).default("draft"),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict().superRefine((value, ctx) => {
  if (value.kind === "link" && (!value.url || value.storagePath)) {
    ctx.addIssue({ code: "custom", path: ["url"], message: "Link resources require a URL and no storage path." });
  }
  if (value.kind === "file" && (!value.storagePath || value.url)) {
    ctx.addIssue({ code: "custom", path: ["storagePath"], message: "File resources require a storage path and no URL." });
  }
  if (value.kind === "file" && (!value.mimeType || value.sizeBytes === null || value.sizeBytes === undefined)) {
    ctx.addIssue({ code: "custom", path: ["mimeType"], message: "File resources require MIME type and byte size." });
  }
  if (value.status === "published" && (!value.provenance || value.licenseStatus !== "approved")) {
    ctx.addIssue({ code: "custom", path: ["licenseStatus"], message: "Published resources require provenance and approved licensing." });
  }
});

export const resourceUploadInputSchema = z.object({
  clubId: uuid,
  scopeClassId: uuid.nullable().optional(),
  fileName: nonEmptyText(200),
  mimeType: z.enum(LMS_RESOURCE_ALLOWED_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(LMS_RESOURCE_MAX_SIZE_BYTES),
}).strict();

export const vocabularySetInputSchema = z.object({
  clubId: uuid,
  scopeClassId: uuid.nullable().optional(),
  title: nonEmptyText(200),
  description: z.string().trim().max(2_000).nullable().optional(),
  provenance: z.string().trim().max(2_000).nullable().optional(),
  licenseStatus: z.enum(LMS_LICENSE_STATUSES).default("pending"),
  status: z.enum(LMS_CONTENT_STATUSES).default("draft"),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict().superRefine((value, ctx) => {
  if (value.status === "published" && (!value.provenance || value.licenseStatus !== "approved")) {
    ctx.addIssue({ code: "custom", path: ["licenseStatus"], message: "Published vocabulary requires provenance and approved licensing." });
  }
});

export const vocabularyItemInputSchema = z.object({
  setId: uuid,
  term: nonEmptyText(200),
  definition: nonEmptyText(2_000),
  example: z.string().trim().max(2_000).nullable().optional(),
  translation: z.string().trim().max(2_000).nullable().optional(),
  orderIndex: z.number().int().nonnegative().default(0),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const contentAssignmentSchema = z.object({
  classId: uuid.nullable().optional(),
  courseId: uuid.nullable().optional(),
}).strict().refine((value) => Boolean(value.classId || value.courseId), {
  message: "Assign content to a class or course.",
}).refine((value) => !(value.classId && value.courseId), {
  message: "Assign content to exactly one class or course.",
});

export type AnnouncementInput = z.infer<typeof announcementInputSchema>;
export type AnnouncementUpdate = z.infer<typeof announcementUpdateSchema>;
export type ResourceInput = z.infer<typeof resourceInputSchema>;
export type ResourceUploadInput = z.infer<typeof resourceUploadInputSchema>;
export type VocabularySetInput = z.infer<typeof vocabularySetInputSchema>;
export type VocabularyItemInput = z.infer<typeof vocabularyItemInputSchema>;
export type ContentAssignment = z.infer<typeof contentAssignmentSchema>;

export type LmsAnnouncement = {
  id: string;
  classId: string;
  title: string;
  body: string;
  status: (typeof LMS_ANNOUNCEMENT_STATUSES)[number];
  publishAt: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LmsNotification = {
  id: string;
  eventType: "assignment_published" | "due_soon" | "returned" | "resubmission" | "result_published" | "announcement";
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type LmsResource = {
  id: string;
  clubId: string;
  scopeClassId: string | null;
  title: string;
  description: string | null;
  kind: "link" | "file";
  url: string | null;
  storagePath: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  provenance: string | null;
  licenseStatus: (typeof LMS_LICENSE_STATUSES)[number];
  status: (typeof LMS_CONTENT_STATUSES)[number];
  createdAt: string;
  updatedAt: string;
};

export type LmsVocabularySet = {
  id: string;
  clubId: string;
  scopeClassId: string | null;
  title: string;
  description: string | null;
  provenance: string | null;
  licenseStatus: (typeof LMS_LICENSE_STATUSES)[number];
  status: (typeof LMS_CONTENT_STATUSES)[number];
  items: Array<{ id: string; term: string; definition: string; example: string | null; translation: string | null; orderIndex: number }>;
};

export function canPublishLicensedContent(input: { status: string; provenance?: string | null; licenseStatus: string }) {
  return input.status !== "published" || (Boolean(input.provenance?.trim()) && input.licenseStatus === "approved");
}

export function normalizeAnnouncementStatus(status: string, now = new Date().toISOString()) {
  if (status === "published") return { status: "published" as const, publishedAt: now, archivedAt: null };
  if (status === "archived") return { status: "archived" as const, publishedAt: null, archivedAt: now };
  return { status: "draft" as const, publishedAt: null, archivedAt: null };
}

export function createOutboxDedupeKey(eventType: string, sourceId: string, revision?: number) {
  return `${eventType}:${sourceId}${revision === undefined ? "" : `:${revision}`}`;
}
