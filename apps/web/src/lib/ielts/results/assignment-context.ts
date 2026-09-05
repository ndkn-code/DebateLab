import "server-only";
import { createTypedServerClient } from "@/lib/supabase/server";
import { listLearnerAssignedTests } from "@/lib/api/ielts/learner-assignments-repository";
import type { ResultsAssignmentContext } from "./next-step";

/** Optional navigation enrichment, using learner RLS and an explicit owner filter. */
export async function loadResultsAssignmentContext(
  attemptId: string,
  userId: string,
): Promise<ResultsAssignmentContext | null> {
  try {
    const client = await createTypedServerClient();
    const { data, error } = await client
      .from("ielts_attempts")
      .select("assignment_id")
      .eq("id", attemptId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data?.assignment_id) return null;
    const assignments = await listLearnerAssignedTests();
    const assignment = assignments.find(
      (item) => item.assignmentId === data.assignment_id,
    );
    return assignment
      ? {
          assignmentId: assignment.assignmentId,
          title: assignment.title,
          className: assignment.className,
        }
      : null;
  } catch {
    // Result/review stays available if optional class context cannot be loaded.
    return null;
  }
}
