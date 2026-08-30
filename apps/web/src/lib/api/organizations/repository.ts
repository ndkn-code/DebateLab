import type {
  OrganizationRole,
  OrganizationStatus,
  OrganizationType,
} from "@/lib/organizations";
import { isOrganizationRole, isOrganizationType } from "@/lib/organizations";

/**
 * The organization workflow is intentionally an RPC boundary.  Keep these
 * names and argument shapes in one place while the database migration lands;
 * server actions should not grow their own table-write fallbacks.
 */
export const ORGANIZATION_RPC_NAMES = Object.freeze({
  createDraft: "create_organization_draft_transaction",
  update: "update_organization_transaction",
  inviteMember: "invite_organization_member_transaction",
  activate: "activate_organization_transaction",
  createClass: "create_organization_class_transaction",
  assignTeacher: "assign_organization_teacher_transaction",
  assignCourse: "assign_organization_course_transaction",
  assignMaterial: "assign_organization_material_transaction",
} as const);

export type OrganizationRpcName = (typeof ORGANIZATION_RPC_NAMES)[keyof typeof ORGANIZATION_RPC_NAMES];

export interface OrganizationRpcError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface OrganizationRpcClient {
  rpc<T = unknown>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: T | null; error: OrganizationRpcError | null }>;
}

export interface OrganizationRpcResult {
  organizationId: string;
  status: OrganizationStatus;
  setupVersion?: number | null;
  setupCompletedAt?: string | null;
  onboardingCompletedAt?: string | null;
}

export interface OrganizationMemberInviteResult {
  invitationId: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  status: "pending" | "accepted";
  expiresAt?: string | null;
}

export interface OrganizationClassResult {
  classId: string;
  organizationId: string;
}

export interface OrganizationAssignmentResult {
  classId: string;
  resourceId: string;
  organizationId: string;
}

export interface CreateOrganizationDraftInput {
  name: string;
  organizationType: OrganizationType;
  country?: string | null;
  city?: string | null;
  timezone?: string | null;
  code?: string | null;
  idempotencyKey: string;
}

export interface UpdateOrganizationInput {
  organizationId: string;
  name?: string;
  organizationType?: OrganizationType;
  country?: string | null;
  city?: string | null;
  timezone?: string | null;
  logoUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  threadsUrl?: string | null;
  setupVersion?: number;
  idempotencyKey: string;
}

export interface InviteOrganizationMemberInput {
  organizationId: string;
  email: string;
  role: OrganizationRole;
  idempotencyKey: string;
}

export interface CreateOrganizationClassInput {
  organizationId: string;
  code?: string | null;
  title: string;
  description?: string | null;
  programType?: "debate" | "ielts" | "public_speaking";
  gradeLevel?: string | null;
  status?: "draft" | "active" | "archived";
  startDate?: string | null;
  endDate?: string | null;
  meetingSchedule?: string | null;
  room?: string | null;
  maxStudents?: number | null;
  idempotencyKey: string;
}

export interface AssignOrganizationTeacherInput {
  organizationId: string;
  classId: string;
  teacherId: string;
  idempotencyKey: string;
}

export interface AssignOrganizationResourceInput {
  organizationId: string;
  classId: string;
  resourceId: string;
  idempotencyKey: string;
}

export interface ActivateOrganizationInput {
  organizationId: string;
  idempotencyKey: string;
}

export const DEFAULT_ORGANIZATION_COUNTRY = "VN";
export const DEFAULT_ORGANIZATION_TIMEZONE = "Asia/Ho_Chi_Minh";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

export function normalizeOrganizationName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= 2 && normalized.length <= 160 ? normalized : null;
}

export function normalizeOrganizationEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 320 && EMAIL_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeIdempotencyKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= 8 && normalized.length <= 128 ? normalized : null;
}

function normalizeOptionalText(value: unknown, maxLength: number): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length <= maxLength ? normalized || null : null;
}

export function normalizeOrganizationUrl(value: unknown): string | null {
  const text = normalizeOptionalText(value, 2_000);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function validateCreateOrganizationDraft(input: CreateOrganizationDraftInput) {
  const name = normalizeOrganizationName(input.name);
  if (!name) return { ok: false as const, reason: "invalid_name" };
  if (!isOrganizationType(input.organizationType)) {
    return { ok: false as const, reason: "invalid_organization_type" };
  }
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKey) return { ok: false as const, reason: "invalid_idempotency_key" };
  return {
    ok: true as const,
    payload: {
      name,
      organizationType: input.organizationType,
      country: normalizeOptionalText(input.country ?? DEFAULT_ORGANIZATION_COUNTRY, 2),
      city: normalizeOptionalText(input.city, 120),
      timezone: normalizeOptionalText(input.timezone ?? DEFAULT_ORGANIZATION_TIMEZONE, 120),
      code: normalizeOptionalText(input.code, 80),
      idempotencyKey,
    },
  };
}

export function validateUpdateOrganization(input: UpdateOrganizationInput) {
  if (!isUuid(input.organizationId)) return { ok: false as const, reason: "invalid_organization_id" };
  if (!normalizeIdempotencyKey(input.idempotencyKey)) {
    return { ok: false as const, reason: "invalid_idempotency_key" };
  }
  if (input.name !== undefined && !normalizeOrganizationName(input.name)) {
    return { ok: false as const, reason: "invalid_name" };
  }
  if (input.organizationType !== undefined && !isOrganizationType(input.organizationType)) {
    return { ok: false as const, reason: "invalid_organization_type" };
  }
  if (input.setupVersion !== undefined && (!Number.isInteger(input.setupVersion) || input.setupVersion < 1)) {
    return { ok: false as const, reason: "invalid_setup_version" };
  }
  for (const value of [input.logoUrl, input.facebookUrl, input.instagramUrl, input.threadsUrl]) {
    if (value !== undefined && value !== null && !normalizeOrganizationUrl(value)) {
      return { ok: false as const, reason: "invalid_url" };
    }
  }
  return { ok: true as const };
}

export function validateOrganizationInvite(input: InviteOrganizationMemberInput) {
  if (!isUuid(input.organizationId)) return { ok: false as const, reason: "invalid_organization_id" };
  const email = normalizeOrganizationEmail(input.email);
  if (!email) return { ok: false as const, reason: "invalid_email" };
  if (!isOrganizationRole(input.role)) {
    return { ok: false as const, reason: "invalid_role" };
  }
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKey) return { ok: false as const, reason: "invalid_idempotency_key" };
  return { ok: true as const, payload: { ...input, email, idempotencyKey } };
}

export function validateOrganizationClass(input: CreateOrganizationClassInput) {
  if (!isUuid(input.organizationId)) return { ok: false as const, reason: "invalid_organization_id" };
  if (!normalizeOrganizationName(input.title)) return { ok: false as const, reason: "invalid_class_title" };
  if (input.programType && !["debate", "ielts", "public_speaking"].includes(input.programType)) {
    return { ok: false as const, reason: "invalid_program_type" };
  }
  if (input.status && !["draft", "active", "archived"].includes(input.status)) {
    return { ok: false as const, reason: "invalid_class_status" };
  }
  if (input.maxStudents != null && (!Number.isInteger(input.maxStudents) || input.maxStudents < 1 || input.maxStudents > 10_000)) {
    return { ok: false as const, reason: "invalid_max_students" };
  }
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKey) return { ok: false as const, reason: "invalid_idempotency_key" };
  for (const date of [input.startDate, input.endDate]) {
    if (date != null && (typeof date !== "string" || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime()))) {
      return { ok: false as const, reason: "invalid_date" };
    }
  }
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    return { ok: false as const, reason: "end_before_start" };
  }
  return { ok: true as const };
}

export function validateOrganizationAssignment(input: AssignOrganizationTeacherInput | AssignOrganizationResourceInput) {
  if (!isUuid(input.organizationId)) return { ok: false as const, reason: "invalid_organization_id" };
  if (!isUuid(input.classId)) return { ok: false as const, reason: "invalid_class_id" };
  const targetId = "teacherId" in input ? input.teacherId : input.resourceId;
  if (!isUuid(targetId)) return { ok: false as const, reason: "invalid_resource_id" };
  if (!normalizeIdempotencyKey(input.idempotencyKey)) {
    return { ok: false as const, reason: "invalid_idempotency_key" };
  }
  return { ok: true as const };
}

export function validateOrganizationActivation(input: ActivateOrganizationInput) {
  if (!isUuid(input.organizationId)) return { ok: false as const, reason: "invalid_organization_id" };
  if (!normalizeIdempotencyKey(input.idempotencyKey)) {
    return { ok: false as const, reason: "invalid_idempotency_key" };
  }
  return { ok: true as const };
}

export async function callOrganizationRpc<T>(
  client: OrganizationRpcClient,
  name: OrganizationRpcName | string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc<T>(name, args);
  if (error) {
    const detail = [error.message, error.details, error.hint].filter(Boolean).join(" ");
    throw new Error(detail || "Organization operation failed.");
  }
  if (data === null || data === undefined) throw new Error(`${name} returned no result.`);
  return data;
}

export function normalizeOrganizationRpcResult(
  value: unknown,
  fallbackOrganizationId?: string,
): OrganizationRpcResult {
  const row = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const organizationId = String(row.organizationId ?? row.organization_id ?? fallbackOrganizationId ?? "");
  if (!organizationId) throw new Error("Organization operation returned no organization id.");
  const rawStatus = row.status;
  const status: OrganizationStatus = rawStatus === "active" || rawStatus === "archived" ? rawStatus : "draft";
  return {
    organizationId,
    status,
    setupVersion: typeof row.setupVersion === "number" ? row.setupVersion : typeof row.setup_version === "number" ? row.setup_version : null,
    setupCompletedAt: typeof row.setupCompletedAt === "string" ? row.setupCompletedAt : typeof row.setup_completed_at === "string" ? row.setup_completed_at : null,
    onboardingCompletedAt: typeof row.onboardingCompletedAt === "string" ? row.onboardingCompletedAt : typeof row.onboarding_completed_at === "string" ? row.onboarding_completed_at : null,
  };
}

export function normalizeOrganizationClassResult(
  value: unknown,
  fallbackOrganizationId?: string,
): OrganizationClassResult {
  const row = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const classId = String(row.classId ?? row.class_id ?? row.id ?? "");
  const organizationId = String(row.organizationId ?? row.organization_id ?? row.clubId ?? row.club_id ?? fallbackOrganizationId ?? "");
  if (!classId || !organizationId) throw new Error("Class operation returned incomplete result.");
  return { classId, organizationId };
}

export function normalizeOrganizationAssignmentResult(
  value: unknown,
  fallback: { organizationId?: string; classId?: string; resourceId?: string } = {},
): OrganizationAssignmentResult {
  const row = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const classId = String(row.classId ?? row.class_id ?? fallback.classId ?? "");
  const organizationId = String(row.organizationId ?? row.organization_id ?? row.clubId ?? row.club_id ?? fallback.organizationId ?? "");
  const resourceId = String(row.resourceId ?? row.resource_id ?? row.courseId ?? row.course_id ?? row.materialId ?? row.material_id ?? fallback.resourceId ?? "");
  if (!classId || !organizationId || !resourceId) throw new Error("Assignment operation returned incomplete result.");
  return { classId, organizationId, resourceId };
}

export function normalizeOrganizationInviteResult(
  value: unknown,
  fallback: Pick<OrganizationMemberInviteResult, "organizationId" | "email" | "role">,
): OrganizationMemberInviteResult {
  const row = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const invitationId = String(row.invitationId ?? row.invitation_id ?? row.id ?? "");
  if (!invitationId) throw new Error("Invitation operation returned no invitation id.");
  return {
    invitationId,
    organizationId: String(row.organizationId ?? row.organization_id ?? fallback.organizationId),
    email: String(row.email ?? fallback.email),
    role: isOrganizationRole(row.role) ? row.role : fallback.role,
    status: row.status === "accepted" ? "accepted" : "pending",
    expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : typeof row.expires_at === "string" ? row.expires_at : null,
  };
}
