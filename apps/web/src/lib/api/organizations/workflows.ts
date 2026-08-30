import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { requirePlatformAdmin } from "@/lib/api/class-manager-access";
import { getAppBaseUrl } from "@/lib/email/config";
import { sendClubInvitationEmail } from "@/lib/email/club-invitations";
import {
  callOrganizationRpc,
  DEFAULT_ORGANIZATION_COUNTRY,
  DEFAULT_ORGANIZATION_TIMEZONE,
  normalizeOrganizationAssignmentResult,
  normalizeOrganizationClassResult,
  normalizeOrganizationInviteResult,
  normalizeOrganizationRpcResult,
  ORGANIZATION_RPC_NAMES,
  validateCreateOrganizationDraft,
  validateOrganizationActivation,
  validateOrganizationAssignment,
  validateOrganizationClass,
  validateOrganizationInvite,
  validateUpdateOrganization,
  type ActivateOrganizationInput,
  type AssignOrganizationResourceInput,
  type AssignOrganizationTeacherInput,
  type CreateOrganizationClassInput,
  type CreateOrganizationDraftInput,
  type InviteOrganizationMemberInput,
  type OrganizationMemberInviteResult,
  type OrganizationRpcClient,
  type OrganizationRpcResult,
  type UpdateOrganizationInput,
} from "@/lib/api/organizations/repository";
type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

function rpcClient(supabase: ServerSupabase) {
  return supabase as unknown as OrganizationRpcClient;
}

async function currentUserId(supabase: ServerSupabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user.id;
  if (isDevAdminBypassEnabled()) return "00000000-0000-4000-8000-000000000001";
  throw new Error("Unauthorized");
}

/** Organization-level authorization is checked before the RPC as a UX guard;
 * every RPC must repeat this check using auth.uid() for the security boundary. */
async function requireOrganizationManager(
  supabase: ServerSupabase,
  organizationId: string,
  minimum: "admin" | "owner" = "admin",
) {
  const userId = await currentUserId(supabase);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (profile?.role === "admin" || isDevAdminBypassEnabled()) return userId;

  const { data: memberships, error } = await supabase
    .from("club_memberships")
    .select("role")
    .eq("club_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["owner", "admin", "teacher", "coach"]);
  if (error) throw new Error(error.message);
  const roles = (memberships ?? []).map((row) => String(row.role));
  if (minimum === "owner" && !roles.includes("owner")) throw new Error("Forbidden");
  if (minimum === "admin" && !roles.some((role) => role === "owner" || role === "admin")) {
    throw new Error("Forbidden");
  }
  return userId;
}

function revalidateOrganization(organizationId?: string) {
  revalidatePath("/dashboard/admin/organizations");
  revalidatePath("/dashboard/admin/clubs");
  if (organizationId) {
    revalidatePath(`/dashboard/admin/organizations/${organizationId}`);
    revalidatePath(`/dashboard/admin/organizations/${organizationId}/setup`);
    revalidatePath(`/dashboard/admin/clubs/${organizationId}`);
  }
}

export async function createOrganizationDraft(
  input: CreateOrganizationDraftInput,
): Promise<OrganizationRpcResult> {
  const validation = validateCreateOrganizationDraft(input);
  if (!validation.ok) throw new Error(validation.reason);
  const supabase = await createClient();
  const actorId = await requirePlatformAdmin(supabase as Parameters<typeof requirePlatformAdmin>[0]);
  const data = await callOrganizationRpc<unknown>(rpcClient(supabase), ORGANIZATION_RPC_NAMES.createDraft, {
    p_name: validation.payload.name,
    p_organization_type: validation.payload.organizationType,
    p_country: validation.payload.country ?? DEFAULT_ORGANIZATION_COUNTRY,
    p_city: validation.payload.city,
    p_timezone: validation.payload.timezone ?? DEFAULT_ORGANIZATION_TIMEZONE,
    p_code: validation.payload.code,
    p_idempotency_key: validation.payload.idempotencyKey,
    p_actor_id: actorId,
  });
  const result = normalizeOrganizationRpcResult(data);
  revalidateOrganization(result.organizationId);
  return result;
}

export async function updateOrganization(
  input: UpdateOrganizationInput,
): Promise<OrganizationRpcResult> {
  const validation = validateUpdateOrganization(input);
  if (!validation.ok) throw new Error(validation.reason);
  const supabase = await createClient();
  const actorId = await requireOrganizationManager(supabase, input.organizationId);
  const data = await callOrganizationRpc<unknown>(rpcClient(supabase), ORGANIZATION_RPC_NAMES.update, {
    p_organization_id: input.organizationId,
    p_name: input.name?.trim() ?? null,
    p_organization_type: input.organizationType ?? null,
    p_country: input.country ?? null,
    p_city: input.city ?? null,
    p_timezone: input.timezone ?? null,
    p_logo_url: input.logoUrl ?? null,
    p_facebook_url: input.facebookUrl ?? null,
    p_instagram_url: input.instagramUrl ?? null,
    p_threads_url: input.threadsUrl ?? null,
    p_setup_version: input.setupVersion ?? null,
    p_idempotency_key: input.idempotencyKey,
    p_actor_id: actorId,
  });
  const result = normalizeOrganizationRpcResult(data, input.organizationId);
  revalidateOrganization(input.organizationId);
  return result;
}

export async function inviteOrganizationMember(
  input: InviteOrganizationMemberInput,
): Promise<OrganizationMemberInviteResult> {
  const validation = validateOrganizationInvite(input);
  if (!validation.ok) throw new Error(validation.reason);
  const supabase = await createClient();
  const minimum = input.role === "owner" ? "owner" : "admin";
  const actorId = await requireOrganizationManager(supabase, input.organizationId, minimum);
  const data = await callOrganizationRpc<unknown>(rpcClient(supabase), ORGANIZATION_RPC_NAMES.inviteMember, {
    p_organization_id: input.organizationId,
    p_email: validation.payload.email,
    p_role: input.role,
    p_idempotency_key: validation.payload.idempotencyKey,
    p_actor_id: actorId,
  });
  const result = normalizeOrganizationInviteResult(data, {
    organizationId: input.organizationId,
    email: validation.payload.email,
    role: input.role,
  });
  const { deliveryToken, ...publicResult } = result;
  if (!deliveryToken) throw new Error("Invitation operation returned no delivery token.");

  const [{ data: organization, error: organizationError }, { data: inviter, error: inviterError }] =
    await Promise.all([
      supabase
        .from("clubs")
        .select("name, city")
        .eq("id", input.organizationId)
        .single(),
      supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", actorId)
        .single(),
    ]);
  if (organizationError) throw new Error(organizationError.message);
  if (inviterError) throw new Error(inviterError.message);

  const delivery = await sendClubInvitationEmail({
    supabase: createAdminClient(),
    invitationId: result.invitationId,
    toEmail: result.email,
    clubName: organization.name,
    clubId: input.organizationId,
    role: result.role,
    inviterName: inviter.display_name ?? inviter.email ?? "Thinkfy",
    city: organization.city,
    inviteUrl: `${getAppBaseUrl()}/join/club/${deliveryToken}`,
    sendKey: `organization_invitation:${result.invitationId}:${validation.payload.idempotencyKey}`,
  });
  if (delivery.failed) {
    throw new Error(delivery.reason ?? "Invitation email could not be delivered.");
  }
  revalidateOrganization(input.organizationId);
  return publicResult;
}

export async function createOrganizationFirstClass(
  input: CreateOrganizationClassInput,
): Promise<{ classId: string; organizationId: string }> {
  const validation = validateOrganizationClass(input);
  if (!validation.ok) throw new Error(validation.reason);
  const supabase = await createClient();
  const actorId = await requireOrganizationManager(supabase, input.organizationId);
  const data = await callOrganizationRpc<unknown>(rpcClient(supabase), ORGANIZATION_RPC_NAMES.createClass, {
    p_organization_id: input.organizationId,
    p_club_id: input.organizationId,
    p_code: input.code ?? null,
    p_title: input.title.trim(),
    p_description: input.description ?? null,
    p_program_type: input.programType ?? "debate",
    p_grade_level: input.gradeLevel ?? null,
    p_status: input.status ?? "draft",
    p_start_date: input.startDate ?? null,
    p_end_date: input.endDate ?? null,
    p_meeting_schedule: input.meetingSchedule ?? null,
    p_room: input.room ?? null,
    p_max_students: input.maxStudents ?? null,
    p_idempotency_key: input.idempotencyKey,
    p_actor_id: actorId,
  });
  const result = normalizeOrganizationClassResult(data, input.organizationId);
  revalidateOrganization(input.organizationId);
  return result;
}

export async function assignOrganizationTeacher(
  input: AssignOrganizationTeacherInput,
): Promise<{ classId: string; organizationId: string; resourceId: string }> {
  const validation = validateOrganizationAssignment(input);
  if (!validation.ok) throw new Error(validation.reason);
  const supabase = await createClient();
  const actorId = await requireOrganizationManager(supabase, input.organizationId);
  const data = await callOrganizationRpc<unknown>(rpcClient(supabase), ORGANIZATION_RPC_NAMES.assignTeacher, {
    p_organization_id: input.organizationId,
    p_class_id: input.classId,
    p_teacher_id: input.teacherId,
    p_action: "add",
    p_idempotency_key: input.idempotencyKey,
    p_actor_id: actorId,
  });
  const result = normalizeOrganizationAssignmentResult(data, {
    organizationId: input.organizationId,
    classId: input.classId,
    resourceId: input.teacherId,
  });
  revalidateOrganization(input.organizationId);
  return result;
}

export async function assignOrganizationCourse(
  input: AssignOrganizationResourceInput,
): Promise<{ classId: string; organizationId: string; resourceId: string }> {
  const validation = validateOrganizationAssignment(input);
  if (!validation.ok) throw new Error(validation.reason);
  const supabase = await createClient();
  const actorId = await requireOrganizationManager(supabase, input.organizationId);
  const data = await callOrganizationRpc<unknown>(rpcClient(supabase), ORGANIZATION_RPC_NAMES.assignCourse, {
    p_organization_id: input.organizationId,
    p_class_id: input.classId,
    p_course_id: input.resourceId,
    p_action: "assign",
    p_idempotency_key: input.idempotencyKey,
    p_actor_id: actorId,
  });
  const result = normalizeOrganizationAssignmentResult(data, {
    organizationId: input.organizationId,
    classId: input.classId,
    resourceId: input.resourceId,
  });
  revalidateOrganization(input.organizationId);
  return result;
}

export async function assignOrganizationMaterial(
  input: AssignOrganizationResourceInput,
): Promise<{ classId: string; organizationId: string; resourceId: string }> {
  const validation = validateOrganizationAssignment(input);
  if (!validation.ok) throw new Error(validation.reason);
  const supabase = await createClient();
  const actorId = await requireOrganizationManager(supabase, input.organizationId);
  const data = await callOrganizationRpc<unknown>(rpcClient(supabase), ORGANIZATION_RPC_NAMES.assignMaterial, {
    p_organization_id: input.organizationId,
    p_class_id: input.classId,
    p_material_id: input.resourceId,
    p_idempotency_key: input.idempotencyKey,
    p_actor_id: actorId,
  });
  const result = normalizeOrganizationAssignmentResult(data, {
    organizationId: input.organizationId,
    classId: input.classId,
    resourceId: input.resourceId,
  });
  revalidateOrganization(input.organizationId);
  return result;
}

export async function activateOrganization(
  input: ActivateOrganizationInput,
): Promise<OrganizationRpcResult> {
  const validation = validateOrganizationActivation(input);
  if (!validation.ok) throw new Error(validation.reason);
  const supabase = await createClient();
  const actorId = await requireOrganizationManager(supabase, input.organizationId);
  const data = await callOrganizationRpc<unknown>(rpcClient(supabase), ORGANIZATION_RPC_NAMES.activate, {
    p_organization_id: input.organizationId,
    p_idempotency_key: input.idempotencyKey,
    p_actor_id: actorId,
  });
  const result = normalizeOrganizationRpcResult(data, input.organizationId);
  revalidateOrganization(input.organizationId);
  return result;
}

// Names used by early wizard prototypes; keep them as explicit aliases while
// the UI transitions from the old club vocabulary.
export const createOrganization = createOrganizationDraft;
export const updateOrganizationSetup = updateOrganization;
export const createOrganizationClass = createOrganizationFirstClass;
