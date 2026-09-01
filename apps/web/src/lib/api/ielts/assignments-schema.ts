/**
 * Zod boundary schemas for the IELTS class-assignment surface (WS-5.3). Pure
 * (Zod only) so server actions validate every external payload before the data
 * layer. See docs/ielts/data-access.md §3.
 */
import { z } from "zod";
import { PostgresUuidSchema } from "@/lib/api/postgres-uuid";

/** Teacher assigns a published mock to a class within their club. */
export const AssignIeltsMockSchema = z.object({
  clubId: PostgresUuidSchema,
  classId: PostgresUuidSchema,
  testId: PostgresUuidSchema,
  /** Optional due date; a date or datetime string, normalized server-side. */
  dueAt: z.string().trim().min(1).max(40).nullish(),
  /** Optional display title; defaults to the mock's title when omitted. */
  title: z.string().trim().min(1).max(160).nullish(),
});
export type AssignIeltsMockInput = z.infer<typeof AssignIeltsMockSchema>;

/** Learner starts a sitting of an assigned mock. */
export const StartAssignedAttemptSchema = z.object({
  assignmentId: PostgresUuidSchema,
});
export type StartAssignedAttemptInput = z.infer<typeof StartAssignedAttemptSchema>;

/** Teacher archives (retires) an IELTS-mock assignment. */
export const ArchiveIeltsAssignmentSchema = z.object({
  clubId: PostgresUuidSchema,
  assignmentId: PostgresUuidSchema,
});
export type ArchiveIeltsAssignmentInput = z.infer<typeof ArchiveIeltsAssignmentSchema>;
