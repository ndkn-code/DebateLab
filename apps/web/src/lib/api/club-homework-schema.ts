import { z } from "zod";

const UuidSchema = z.string().uuid();

/**
 * `mimeType` is only meaningful when the client is echoing back a value the
 * server itself recorded (see `RecordAssignmentSubmissionFilesSchema`). On the
 * submit path it is ignored: the reservation derives the storage MIME from the
 * file extension via `canonicalMimeType`, because the browser reports an empty
 * `File.type` for .m4a and for many .docx.
 */
export const HomeworkFileRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().max(120).nullable().optional(),
  sizeBytes: z.number().int().min(0),
});

export const SubmitClubAssignmentSchema = z.object({
  assignmentId: UuidSchema,
  idempotencyKey: UuidSchema.optional(),
  submissionText: z.string().max(20000).nullable().optional(),
  files: z.array(HomeworkFileRequestSchema).max(20).default([]),
});

export const RecordAssignmentSubmissionFilesSchema = z.object({
  submissionId: UuidSchema,
  files: z.array(
    HomeworkFileRequestSchema.extend({
      storagePath: z.string().trim().min(1).max(500),
    }),
  ).max(20),
});

export const FailAssignmentSubmissionSchema = z.object({
  submissionId: UuidSchema,
  reason: z.string().trim().max(500).nullable().optional(),
});

export const RetryAssignmentSubmissionSchema = z.object({
  submissionId: UuidSchema,
});

export const GradeAssignmentSubmissionSchema = z.object({
  clubId: UuidSchema,
  submissionId: UuidSchema,
  gradeStatus: z.enum(["graded", "returned", "resubmit_requested"]),
  score: z.number().min(0).max(999.99).nullable().optional(),
  scoreMax: z.number().min(0.01).max(999.99).nullable().optional(),
  rubricScores: z.record(z.string(), z.number().min(0).max(100)).default({}),
  feedback: z.string().max(20000).nullable().optional(),
});
