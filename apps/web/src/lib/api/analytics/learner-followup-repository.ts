import "server-only";

import {
  loadAuthorizedClassAnalytics,
  type ClassAnalyticsData,
} from "./class-repository";
import {
  AnalyticsForbidden,
  createTypedServerClient,
  requireAnalyticsClass,
} from "./access";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import {
  projectLearnerFollowup,
  type LearnerFollowup,
} from "@/lib/analytics/learner-followup";

type ServerClient = Awaited<ReturnType<typeof createTypedServerClient>>;
type TrustedClient = ReturnType<typeof createTypedAdminClient>;
type Manager = Awaited<ReturnType<typeof requireAnalyticsClass>>;

export interface LearnerFollowupRepositoryDependencies {
  client?: ServerClient;
  requireClass?: (client: ServerClient, classId: string) => Promise<Manager>;
  trustedFactory?: () => TrustedClient;
  checkMembership?: (
    client: ServerClient,
    classId: string,
    studentId: string,
  ) => Promise<{ data: { user_id: string } | null; error: { message: string } | null }>;
  loadAnalytics?: (
    classId: string,
    days: 7 | 30 | 90,
    client: ServerClient,
    manager: Manager,
    trusted: TrustedClient,
  ) => Promise<ClassAnalyticsData>;
}

export async function loadLearnerFollowup(
  classId: string,
  studentId: string,
  days: 7 | 30 | 90,
  dependencies: LearnerFollowupRepositoryDependencies = {},
): Promise<LearnerFollowup> {
  const client = dependencies.client ?? (await createTypedServerClient());
  const manager = await (dependencies.requireClass ?? requireAnalyticsClass)(
    client,
    classId,
  );
  const membership = await (dependencies.checkMembership
    ? dependencies.checkMembership(client, classId, studentId)
    : client
        .from("class_memberships")
        .select("user_id")
        .eq("class_id", classId)
        .eq("user_id", studentId)
        .eq("member_role", "student")
        .eq("status", "active")
        .maybeSingle());
  if (membership.error)
    throw new Error(`Learner membership unavailable: ${membership.error.message}`);
  if (!membership.data)
    throw new AnalyticsForbidden("Learner is not an active member of this class");
  const trusted = (dependencies.trustedFactory ?? createTypedAdminClient)();
  const data = await (dependencies.loadAnalytics ?? loadAuthorizedClassAnalytics)(
    classId,
    days,
    client,
    manager,
    trusted,
  );
  const result = projectLearnerFollowup(data, classId, studentId);
  if (!result)
    throw new AnalyticsForbidden("Learner is not an active member of this class");
  return result;
}
