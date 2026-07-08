import { z } from "zod";

const UuidSchema = z.string().uuid();

export const HomeworkFileRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().max(120).nullable().optional(),
  sizeBytes: z.number().int().min(0),
});

export const SubmitClubAssignmentSchema = z.object({
  assignmentId: UuidSchema,
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

export const GradeAssignmentSubmissionSchema = z.object({
  clubId: UuidSchema,
  submissionId: UuidSchema,
  gradeStatus: z.enum(["graded", "returned", "resubmit_requested"]),
  score: z.number().min(0).max(999.99).nullable().optional(),
  scoreMax: z.number().min(0.01).max(999.99).nullable().optional(),
  rubricScores: z.record(z.string(), z.number().min(0).max(100)).default({}),
  feedback: z.string().max(20000).nullable().optional(),
});
