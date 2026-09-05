import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTypedServerClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { requireClassManager } from "@/lib/api/class-manager-access";
import {
  readPages,
  readChunkedPages,
  requireRows,
} from "@/lib/api/analytics/query-pages";
import {
  buildClassGradebook,
  type ClassGradebookEvidence,
  type GradebookSubmissionRow,
} from "@/lib/teacher-workspace/class-gradebook-model";

async function context(classId: string) {
  z.string().uuid().parse(classId);
  const session = await createTypedServerClient();
  const manager = await requireClassManager(session, classId);
  if (!manager.clubId) throw new Error("FORBIDDEN");
  const db = session as unknown as SupabaseClient;
  const { data: row, error } = await db
    .from("classes")
    .select("program_type")
    .eq("id", classId)
    .single();
  if (error || !row) throw new Error("FORBIDDEN");
  return {
    session,
    db,
    manager,
    maxScore: row.program_type === "ielts" ? 9 : 10,
  };
}

export async function readClassGradebook(classId: string) {
  const { db, manager, maxScore } = await context(classId);
  const [rosterResult, assignmentsResult, submissionsResult] =
    await Promise.all([
      readPages((from, to) =>
        db
          .from("class_memberships")
          .select("user_id")
          .eq("class_id", classId)
          .eq("member_role", "student")
          .eq("status", "active")
          .order("user_id")
          .range(from, to),
      ),
      readPages((from, to) =>
        db
          .from("club_assignments")
          .select("id,title")
          .eq("class_id", classId)
          .eq("club_id", manager.clubId)
          .neq("status", "archived")
          .order("created_at")
          .order("id")
          .range(from, to),
      ),
      readPages((from, to) =>
        db
          .from("club_assignment_submissions")
          .select(
            "id,user_id,assignment_id,submission_state,submitted_at,grade_status,score,score_max,updated_at",
          )
          .eq("class_id", classId)
          .eq("club_id", manager.clubId)
          .eq("submission_state", "submitted")
          .not("submitted_at", "is", null)
          .order("submitted_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      ),
    ]);
  const roster = requireRows(rosterResult, "class roster");
  const assignments = requireRows(assignmentsResult, "class assignments");
  const submissions = requireRows(
    submissionsResult,
    "class submissions",
  ) as GradebookSubmissionRow[];
  // Identity RLS is owner-only. Trust only IDs read from this explicitly authorized class.
  const admin = createTypedAdminClient() as unknown as SupabaseClient;
  const profiles = requireRows(
    await readChunkedPages(
      [roster.map((row) => row.user_id)],
      ([ids], from, to) =>
        admin
          .from("profiles")
          .select("id,display_name,email")
          .in("id", ids)
          .order("id")
          .range(from, to),
    ),
    "class learner names",
  );
  const names = new Map(
    profiles.map((row) => [
      row.id,
      row.display_name?.trim() || row.email?.split("@")[0] || row.id,
    ]),
  );
  return buildClassGradebook(
    roster.map((row) => ({
      id: row.user_id,
      name: names.get(row.user_id) ?? row.user_id,
    })),
    assignments.map((row) => ({ id: row.id, title: row.title, maxScore })),
    submissions,
  );
}

export async function readClassGradebookEvidence(input: {
  classId: string;
  assignmentId: string;
  submissionId: string;
}): Promise<ClassGradebookEvidence> {
  z.object({
    classId: z.string().uuid(),
    assignmentId: z.string().uuid(),
    submissionId: z.string().uuid(),
  })
    .strict()
    .parse(input);
  const { db, session, manager, maxScore } = await context(input.classId);
  const { data: assignment, error: assignmentError } = await db
    .from("club_assignments")
    .select("title")
    .eq("id", input.assignmentId)
    .eq("class_id", input.classId)
    .eq("club_id", manager.clubId)
    .single();
  if (assignmentError || !assignment) throw new Error("FORBIDDEN");
  // Evidence and concurrency token come from the SAME row read.
  const { data: row, error } = await db
    .from("club_assignment_submissions")
    .select("id,user_id,submission_text,score,score_max,feedback,updated_at")
    .eq("id", input.submissionId)
    .eq("assignment_id", input.assignmentId)
    .eq("class_id", input.classId)
    .eq("club_id", manager.clubId)
    .eq("submission_state", "submitted")
    .not("submitted_at", "is", null)
    .single();
  if (error || !row) throw new Error("FORBIDDEN");
  const files = requireRows(
    await readPages((from, to) =>
      db
        .from("assignment_submission_files")
        .select("id,file_name,storage_path")
        .eq("submission_id", row.id)
        .eq("user_id", row.user_id)
        .eq("state", "verified")
        .order("id")
        .range(from, to),
    ),
    "submission files",
  );
  const admin = createTypedAdminClient() as unknown as SupabaseClient;
  const profile = await admin
    .from("profiles")
    .select("display_name,email")
    .eq("id", row.user_id)
    .single();
  if (profile.error) throw new Error("Learner identity unavailable");
  return {
    submissionId: row.id,
    updatedAt: row.updated_at,
    studentName:
      profile.data.display_name?.trim() ||
      profile.data.email?.split("@")[0] ||
      row.user_id,
    assignmentTitle: assignment.title,
    response: row.submission_text,
    score: row.score,
    scoreMax: row.score_max ?? maxScore,
    feedback: row.feedback,
    files: await Promise.all(
      files.map(async (file) => {
        // Same verified-file signing boundary as club-homework.ts; never sign a caller path.
        const signed = await session.storage
          .from("assignment-submissions")
          .createSignedUrl(file.storage_path, 300);
        return {
          id: file.id,
          name: file.file_name,
          url: signed.error ? null : signed.data.signedUrl,
        };
      }),
    ),
  };
}
