"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_ADMIN_PROFILE, isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import {
  normalizeClubRecipients,
  normalizeSocialUrl,
  validateClubAssignmentInput,
  validateClubCreationInput,
  validateClubEventInput,
} from "@/lib/api/admin-clubs-model";
import { getAppBaseUrl } from "@/lib/email/config";
import { sendClubInvitationEmail } from "@/lib/email/club-invitations";
import { ORGANIZATION_JOIN_CODES_ENABLED } from "@/lib/features";
import {
  formatOrganizationJoinCode,
  normalizeOrganizationJoinCode,
} from "@/lib/organizations/model";
import { normalizeOrganizationRole } from "@/lib/organizations/compatibility";
import { requireClassManager } from "@/lib/api/class-manager-access";
import type {
  ClubAssignmentInput,
  ClubRecipientInput,
  ClubRecipientResult,
  ClubRole,
  CreateClubResult,
  SaveClubEventInput,
} from "@/lib/types/admin-clubs";
import {
  activateOrganization as activateOrganizationWorkflow,
  assignOrganizationCourse as assignOrganizationCourseWorkflow,
  assignOrganizationMaterial as assignOrganizationMaterialWorkflow,
  assignOrganizationTeacher as assignOrganizationTeacherWorkflow,
  createOrganizationDraft as createOrganizationDraftWorkflow,
  createOrganizationFirstClass as createOrganizationFirstClassWorkflow,
  inviteOrganizationMember as inviteOrganizationMemberWorkflow,
  updateOrganization as updateOrganizationWorkflow,
} from "@/lib/api/organizations/workflows";
import type {
  ActivateOrganizationInput,
  AssignOrganizationResourceInput,
  AssignOrganizationTeacherInput,
  CreateOrganizationClassInput,
  CreateOrganizationDraftInput,
  InviteOrganizationMemberInput,
  UpdateOrganizationInput,
} from "@/lib/api/organizations/repository";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Keep organization mutations on the existing admin/club action boundary.
// The implementation module is server-only and is not a standalone action
// or deployment entrypoint.
export async function createOrganizationDraft(input: CreateOrganizationDraftInput) {
  return createOrganizationDraftWorkflow(input);
}

export async function updateOrganization(input: UpdateOrganizationInput) {
  return updateOrganizationWorkflow(input);
}

export async function inviteOrganizationMember(input: InviteOrganizationMemberInput) {
  return inviteOrganizationMemberWorkflow(input);
}

export async function createOrganizationFirstClass(input: CreateOrganizationClassInput) {
  return createOrganizationFirstClassWorkflow(input);
}

export async function assignOrganizationTeacher(input: AssignOrganizationTeacherInput) {
  return assignOrganizationTeacherWorkflow(input);
}

export async function assignOrganizationCourse(input: AssignOrganizationResourceInput) {
  return assignOrganizationCourseWorkflow(input);
}

export async function assignOrganizationMaterial(input: AssignOrganizationResourceInput) {
  return assignOrganizationMaterialWorkflow(input);
}

export async function activateOrganization(input: ActivateOrganizationInput) {
  return activateOrganizationWorkflow(input);
}

async function verifyAdmin(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isDevAdminBypassEnabled() || (await getDevAuthBypassUserFromServerContext())) {
      return DEV_ADMIN_PROFILE.id;
    }
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    if (isDevAdminBypassEnabled()) return user.id;
    throw new Error("Forbidden");
  }

  return user.id;
}

function cleanString(value: FormDataEntryValue | string | null | undefined) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

async function isDevClubBypassId(id: string) {
  if (!id.startsWith("00000000-0000-4c00-8000-")) return false;
  return isDevAdminBypassEnabled() || Boolean(await getDevAuthBypassUserFromServerContext());
}

async function verifyClubManager(supabase: Supabase, clubId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isDevAdminBypassEnabled() || (await getDevAuthBypassUserFromServerContext())) {
      return DEV_ADMIN_PROFILE.id;
    }
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") return user.id;

  const { data: membership } = await supabase
    .from("club_memberships")
    .select("id, role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["owner", "admin", "teacher", "coach"])
    .maybeSingle();

  const role = normalizeOrganizationRole(membership?.role);
  if (role === "owner" || role === "admin") return user.id;
  if (isDevAdminBypassEnabled()) return user.id;
  throw new Error("Forbidden");
}

async function verifyClubOwner(supabase: Supabase, clubId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (isDevAdminBypassEnabled() || (await getDevAuthBypassUserFromServerContext())) {
      return DEV_ADMIN_PROFILE.id;
    }
    throw new Error("Unauthorized");
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role === "admin" || isDevAdminBypassEnabled()) return user.id;
  const { data: membership, error } = await supabase
    .from("club_memberships")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["owner", "admin", "teacher", "coach"])
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (normalizeOrganizationRole(membership?.role) === "owner") return user.id;
  throw new Error("Forbidden");
}

async function verifyClubClassAccess(supabase: Supabase, clubId: string, classId: string) {
  const { data: classRow, error } = await supabase
    .from("classes")
    .select("id, club_id")
    .eq("id", classId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!classRow || classRow.club_id !== clubId) throw new Error("Class must belong to this organization.");
  // Class manager authorization is class-scoped for teachers and organization-wide
  // for owners/admins/platform admins.
  return requireClassManager(supabase as Parameters<typeof requireClassManager>[0], classId);
}

async function verifyClubEventAccess(
  supabase: Supabase,
  input: { clubId: string; eventId?: string | null; classId?: string | null },
) {
  let existingClassId = input.classId ?? null;
  if (input.eventId) {
    // Scope the service-role lookup to the caller-supplied event id; the
    // authorization decision still happens through the normal client below.
    const { data: event, error } = await createAdminClient()
      .from("club_events")
      .select("club_id, class_id")
      .eq("id", input.eventId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!event || event.club_id !== input.clubId) throw new Error("Event not found");
    if (input.classId && event.class_id !== input.classId) {
      throw new Error("Event cannot be moved between classes.");
    }
    existingClassId = event.class_id as string | null;
  }

  if (existingClassId) {
    return verifyClubClassAccess(supabase, input.clubId, existingClassId);
  }
  return { userId: await verifyClubManager(supabase, input.clubId), role: "admin" as const };
}

function parseRecipients(formData: FormData) {
  const raw = cleanString(formData.get("recipientsJson"));
  if (!raw) return [];
  try {
    return normalizeClubRecipients(JSON.parse(raw));
  } catch {
    return [];
  }
}

function isSkipInvitationMode(formData: FormData) {
  return cleanString(formData.get("skipInvitation")) === "true";
}

function invitationTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function joinCodeHash(code: string) {
  return createHash("sha256").update(normalizeOrganizationJoinCode(code)).digest("hex");
}

function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

function createReadableJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  let code = "";

  for (let index = 0; index < 12; index += 1) {
    code += alphabet[bytes[index] % alphabet.length];
  }

  return formatOrganizationJoinCode(code);
}

async function findActiveStudentClub(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("club_memberships")
    .select("id, club_id")
    .eq("user_id", userId)
    .eq("role", "student")
    .eq("status", "active")
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  return data as { id: string; club_id: string } | null;
}

async function assertStudentCanJoinClub(userId: string, clubId: string) {
  const activeClub = await findActiveStudentClub(userId);
  if (activeClub && activeClub.club_id !== clubId) {
    throw new Error("Student already belongs to another organization.");
  }

  return activeClub;
}

function safeLogoExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
  return null;
}

function normalizeAssignmentExtensions(values: string[] | null | undefined) {
  const normalized = (values ?? [])
    .map((value) => value.trim().toLowerCase().replace(/^\./, ""))
    .filter((value, index, source) => value.length > 0 && source.indexOf(value) === index);

  return normalized.length > 0 ? normalized : null;
}

async function uploadClubLogo(input: {
  clubId: string;
  file: FormDataEntryValue | null;
}) {
  const file = input.file;
  if (!(file instanceof File) || file.size === 0) return { logoUrl: null, logoStoragePath: null };
  if (file.size > 2 * 1024 * 1024) throw new Error("Logo must be 2MB or smaller.");

  const extension = safeLogoExtension(file);
  if (!extension) throw new Error("Logo must be PNG, JPG, WebP, or SVG.");

  const admin = createAdminClient();
  const path = `${input.clubId}/${randomUUID()}.${extension}`;
  const body = new Blob([await file.arrayBuffer()], { type: file.type });
  const { error } = await admin.storage
    .from("club-logos")
    .upload(path, body, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error(error.message);

  const { data } = admin.storage.from("club-logos").getPublicUrl(path);
  return {
    logoUrl: data.publicUrl,
    logoStoragePath: path,
  };
}

async function findProfilesByEmail(emails: string[]) {
  if (!emails.length) return new Map<string, { id: string; email: string | null; display_name: string | null; role: string | null }>();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, display_name, role")
    .in("email", emails);
  if (error) throw new Error(error.message);

  return new Map(
    (data ?? [])
      .filter((profile) => profile.email)
      .map((profile) => [String(profile.email).toLowerCase(), profile as { id: string; email: string | null; display_name: string | null; role: string | null }])
  );
}

async function generateUniqueClubCode() {
  const admin = createAdminClient();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `CLUB-${randomBytes(3).toString("hex").toUpperCase()}`;
    const { data, error } = await admin.from("clubs").select("id").eq("code", code).limit(1);
    if (error) throw new Error(error.message);
    if (!data?.length) return code;
  }
  throw new Error("Could not generate a unique club code.");
}

export async function createClub(formData: FormData): Promise<CreateClubResult> {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  const name = cleanString(formData.get("name"));
  const recipients = parseRecipients(formData);
  const validation = validateClubCreationInput({
    name,
    city: formData.get("city"),
    facebookUrl: formData.get("facebookUrl"),
    instagramUrl: formData.get("instagramUrl"),
    threadsUrl: formData.get("threadsUrl"),
    recipients,
  });

  if (!validation.ok) throw new Error(validation.reason);

  if (isDevAdminBypassEnabled()) {
    return {
      clubId: "00000000-0000-4c00-8000-000000000002",
      recipients: recipients.map((recipient) => ({
        ...recipient,
        status: isSkipInvitationMode(formData) ? "missing_account" : "invited",
      })),
    };
  }

  const logoFile = formData.get("logo");
  if (!(logoFile instanceof File) || logoFile.size === 0) {
    throw new Error("Club logo is required.");
  }

  const admin = createAdminClient();
  const skipInvitation = isSkipInvitationMode(formData);
  const profilesByEmail = await findProfilesByEmail(validation.recipients.map((recipient) => recipient.email));
  const firstExistingOwner = validation.recipients
    .filter((recipient) => recipient.role === "owner")
    .map((recipient) => profilesByEmail.get(recipient.email)?.id)
    .find(Boolean);
  const code = cleanString(formData.get("code")) ?? await generateUniqueClubCode();
  const { data, error } = await admin
    .from("clubs")
    .insert({
      code,
      name,
      club_type: cleanString(formData.get("clubType")) ?? "school",
      organization_type:
        (cleanString(formData.get("clubType")) ?? "school") === "school" ||
        (cleanString(formData.get("clubType")) ?? "school") === "center"
          ? "school"
          : "club",
      city: validation.city,
      country: "VN",
      timezone: "Asia/Ho_Chi_Minh",
      owner_user_id: firstExistingOwner ?? adminId,
      facebook_url: normalizeSocialUrl(formData.get("facebookUrl"), { required: true, hostIncludes: "facebook.com" }),
      instagram_url: normalizeSocialUrl(formData.get("instagramUrl")),
      threads_url: normalizeSocialUrl(formData.get("threadsUrl")),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await admin.from("club_memberships").upsert(
    {
      club_id: data.id,
      user_id: adminId,
      role: "owner",
      status: "active",
      invited_by: adminId,
    },
    { onConflict: "club_id,user_id,role" }
  );

  const logo = await uploadClubLogo({
    clubId: data.id as string,
    file: logoFile,
  });

  if (logo.logoUrl) {
    const { error: logoError } = await admin
      .from("clubs")
      .update({
        logo_url: logo.logoUrl,
        logo_storage_path: logo.logoStoragePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (logoError) throw new Error(logoError.message);
  }

  const recipientResults = skipInvitation
    ? await addExistingProfilesToClub({
        clubId: data.id as string,
        recipients: validation.recipients,
        profilesByEmail,
        invitedBy: adminId,
      })
    : await createAndSendInvitations({
        clubId: data.id as string,
        clubName: name!,
        city: validation.city,
        recipients: validation.recipients,
        profilesByEmail,
        invitedBy: adminId,
      });

  revalidatePath("/dashboard/admin/clubs");
  revalidatePath(`/dashboard/admin/clubs/${data.id}`);
  return { clubId: data.id as string, recipients: recipientResults };
}

async function addExistingProfilesToClub(input: {
  clubId: string;
  recipients: ClubRecipientInput[];
  profilesByEmail: Map<string, { id: string; email: string | null; display_name: string | null; role: string | null }>;
  invitedBy: string;
}): Promise<ClubRecipientResult[]> {
  const admin = createAdminClient();
  const results: ClubRecipientResult[] = [];

  for (const recipient of input.recipients) {
    const profile = input.profilesByEmail.get(recipient.email);
    if (!profile) {
      results.push({
        email: recipient.email,
        role: recipient.role,
        status: "missing_account",
        message: "No Thinkfy account exists for this email yet.",
      });
      continue;
    }

    if (recipient.role === "student") {
      const activeClub = await findActiveStudentClub(profile.id);
      if (activeClub?.club_id === input.clubId) {
        results.push({
          email: recipient.email,
          role: recipient.role,
          status: "existing_member",
          userId: profile.id,
          message: "Student is already in this organization.",
        });
        continue;
      }

      if (activeClub) {
        results.push({
          email: recipient.email,
          role: recipient.role,
          status: "failed",
          userId: profile.id,
          message: "Student already belongs to another organization.",
        });
        continue;
      }
    }

    const { error } = await admin.from("club_memberships").upsert(
      {
        club_id: input.clubId,
        user_id: profile.id,
        role: recipient.role,
        status: "active",
        removed_at: null,
        invited_by: input.invitedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "club_id,user_id,role" }
    );

    if (error) {
      results.push({
        email: recipient.email,
        role: recipient.role,
        status: "failed",
        userId: profile.id,
        message: error.message,
      });
      continue;
    }

    if (recipient.role === "teacher" && profile.role === "student") {
      const { error: promotionError } = await admin
        .from("profiles")
        .update({ role: "teacher", updated_at: new Date().toISOString() })
        .eq("id", profile.id)
        .eq("role", "student");
      if (promotionError) {
        results.push({
          email: recipient.email,
          role: recipient.role,
          status: "failed",
          userId: profile.id,
          message: promotionError.message,
        });
        continue;
      }
    }

    results.push({
      email: recipient.email,
      role: recipient.role,
      status: "added",
      userId: profile.id,
      message: "Added directly because the account already exists.",
    });
  }

  return results;
}

async function createAndSendInvitations(input: {
  clubId: string;
  clubName: string;
  city: string;
  recipients: ClubRecipientInput[];
  profilesByEmail: Map<string, { id: string; email: string | null; display_name: string | null; role: string | null }>;
  invitedBy: string;
}): Promise<ClubRecipientResult[]> {
  const admin = createAdminClient();
  const { data: inviter } = await admin
    .from("profiles")
    .select("display_name, email")
    .eq("id", input.invitedBy)
    .maybeSingle();
  const inviterName = String(inviter?.display_name ?? inviter?.email ?? "Thinkfy");
  const results: ClubRecipientResult[] = [];

  for (const recipient of input.recipients) {
    const token = createInvitationToken();
    const tokenHash = invitationTokenHash(token);
    const expiresAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
    const existing = await admin
      .from("club_invitations")
      .select("id")
      .eq("club_id", input.clubId)
      .ilike("email", recipient.email)
      .in("role", recipient.role === "teacher" ? ["teacher", "coach"] : [recipient.role])
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    if (existing.error && existing.error.code !== "PGRST116") {
      results.push({
        email: recipient.email,
        role: recipient.role,
        status: "failed",
        message: existing.error.message,
      });
      continue;
    }

    const existingInvitationId = existing.data?.[0]?.id as string | undefined;
    const invitationMutation = existingInvitationId
      ? admin
          .from("club_invitations")
          .update({
            role: recipient.role,
            token_hash: tokenHash,
            expires_at: expiresAt,
            invited_by: input.invitedBy,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingInvitationId)
          .select("id")
          .single()
      : admin
          .from("club_invitations")
          .insert({
            club_id: input.clubId,
            email: recipient.email,
            role: recipient.role,
            status: "pending",
            token_hash: tokenHash,
            expires_at: expiresAt,
            invited_by: input.invitedBy,
          })
          .select("id")
          .single();

    const { data: invitation, error } = await invitationMutation;
    if (error) {
      results.push({
        email: recipient.email,
        role: recipient.role,
        status: "failed",
        message: error.message,
      });
      continue;
    }

    const invitedProfile = input.profilesByEmail.get(recipient.email);
    const inviteUrl = `${getAppBaseUrl()}/join/club/${encodeURIComponent(token)}`;
    const sendResult = await sendClubInvitationEmail({
      supabase: admin,
      invitationId: invitation.id as string,
      toEmail: recipient.email,
      invitedUserId: invitedProfile?.id ?? null,
      clubName: input.clubName,
      clubId: input.clubId,
      role: recipient.role,
      inviterName,
      city: input.city,
      inviteUrl,
      sendKey: `club_invitation:${invitation.id}:${tokenHash.slice(0, 16)}`,
      locale: "vi",
    });

    await admin
      .from("club_invitations")
      .update({
        last_sent_at: new Date().toISOString(),
        metadata: {
          sendResult,
          inviteUrl,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    results.push({
      email: recipient.email,
      role: recipient.role,
      status: sendResult.failed ? "failed" : sendResult.skipped ? "email_skipped" : "invited",
      invitationId: invitation.id as string,
      userId: invitedProfile?.id ?? null,
      message: sendResult.reason,
    });
  }

  return results;
}

export async function searchProfilesForClub(query: string, clubId: string) {
  const supabase = await createClient();
  await verifyClubManager(supabase, clubId);
  const term = query.trim();
  if (term.length < 2) return [];

  if (await isDevClubBypassId(clubId)) {
    return [
      { id: "00000000-0000-4000-8000-000000000301", displayName: "Maya Kim", email: "maya.kim@riverside.edu", role: "student", blockedReason: null },
      { id: "00000000-0000-4000-8000-000000000302", displayName: "Aisha Nguyen", email: "aisha.nguyen@riverside.edu", role: "student", blockedReason: null },
    ].filter((profile) =>
      profile.displayName.toLowerCase().includes(term.toLowerCase()) ||
      profile.email.toLowerCase().includes(term.toLowerCase())
    );
  }
  // Do not query profiles globally from this legacy action. A service-role
  // search leaks account PII across organizations; the organization workflow
  // must provide a dedicated org-scoped search/RPC before this is re-enabled.
  throw new Error("Organization member search is not available yet.");
}

export async function addClubMember(input: {
  clubId: string;
  userId: string;
  role: ClubRole;
}) {
  const supabase = await createClient();
  const role = normalizeOrganizationRole(input.role, "student") ?? "student";
  // Ownership and administrator grants are privileged operations. A regular
  // organization admin may add teachers/students but cannot create another
  // owner/admin or transfer control.
  const actorId = role === "owner" || role === "admin"
    ? await verifyClubOwner(supabase, input.clubId)
    : await verifyClubManager(supabase, input.clubId);

  if (await isDevClubBypassId(input.clubId)) {
    return { status: "added" as const };
  }

  if (role === "student") {
    await assertStudentCanJoinClub(input.userId, input.clubId);
  }

  // Keep the mutation on the authenticated client so organization RLS remains
  // the final boundary; this legacy action must not bypass it with a service
  // role client.
  const { error } = await supabase.from("club_memberships").upsert(
    {
      club_id: input.clubId,
      user_id: input.userId,
      role,
      status: "active",
      removed_at: null,
      invited_by: actorId,
      metadata: role === "student" ? { verification_method: "admin" } : {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "club_id,user_id,role" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/clubs");
  revalidatePath(`/dashboard/admin/clubs/${input.clubId}`);
  revalidatePath("/leaderboards");
  revalidatePath("/en/leaderboards");
  return { status: "added" as const };
}

export async function createClubJoinCode(clubId: string) {
  if (!ORGANIZATION_JOIN_CODES_ENABLED) {
    throw new Error("Organization join codes are not enabled yet.");
  }

  const supabase = await createClient();
  const actorId = await verifyClubManager(supabase, clubId);

  if (await isDevClubBypassId(clubId)) {
    return {
      code: "TFY3-DEMO-2026",
      expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    };
  }

  const admin = createAdminClient();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = createReadableJoinCode();
    const { data, error } = await admin
      .from("club_join_codes")
      .insert({
        club_id: clubId,
        code_hash: joinCodeHash(code),
        status: "pending",
        role: "student",
        issued_by: actorId,
        expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      })
      .select("expires_at")
      .single();

    if (!error) {
      revalidatePath(`/dashboard/admin/clubs/${clubId}`);
      return {
        code,
        expiresAt: String(data.expires_at),
      };
    }

    if (!String(error.message).toLowerCase().includes("duplicate")) {
      throw new Error(error.message);
    }
  }

  throw new Error("Could not generate a unique organization code.");
}

export async function revokeClubJoinCode(clubId: string, codeId: string) {
  if (!ORGANIZATION_JOIN_CODES_ENABLED) {
    throw new Error("Organization join codes are not enabled yet.");
  }

  const supabase = await createClient();
  await verifyClubManager(supabase, clubId);

  if (await isDevClubBypassId(clubId)) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("club_join_codes")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", codeId)
    .eq("club_id", clubId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/admin/clubs/${clubId}`);
}

export async function createClubAssignment(input: ClubAssignmentInput) {
  const supabase = await createClient();
  const validation = validateClubAssignmentInput(input);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }
  const classId = cleanString(input.classId);
  const managerId = classId
    ? (await verifyClubClassAccess(supabase, input.clubId, classId)).userId
    : await verifyClubManager(supabase, input.clubId);

  if (await isDevClubBypassId(input.clubId)) {
    return "00000000-0000-4c20-8000-000000000999";
  }

  if (classId) {
    const { data: cohort, error: cohortError } = await supabase
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("club_id", input.clubId)
      .maybeSingle();
    if (cohortError) throw new Error(cohortError.message);
    if (!cohort) throw new Error("Assignment cohort must belong to this club.");
  }

  const textEnabled = input.submissionTextEnabled ?? true;
  const filesEnabled = input.submissionFilesEnabled ?? false;
  const { data, error } = await supabase
    .from("club_assignments")
    .insert({
      club_id: input.clubId,
      class_id: classId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      assignment_type: input.assignmentType ?? "practice",
      assigned_track: input.assignedTrack ?? "debate",
      topic_title: input.topicTitle?.trim() || null,
      topic_category: input.topicCategory?.trim() || null,
      due_at: input.dueAt ?? null,
      required_attempts: input.requiredAttempts ?? 1,
      rubric_key: input.rubricKey ?? (input.assignedTrack === "speaking" ? "speaking_v1" : "debate_v1"),
      rubric_version: input.rubricVersion ?? 1,
      status: input.status ?? "active",
      created_by: managerId,
      metadata: { submission_mode: "homework" },
      submission_text_enabled: textEnabled,
      submission_files_enabled: filesEnabled,
      submission_max_files: input.submissionMaxFiles ?? (filesEnabled ? 3 : 0),
      submission_max_file_mb: input.submissionMaxFileMb ?? 10,
      submission_allowed_ext: normalizeAssignmentExtensions(input.submissionAllowedExt),
      submission_instructions: input.submissionInstructions?.trim() || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/clubs");
  revalidatePath(`/dashboard/admin/clubs/${input.clubId}`);
  return data.id as string;
}

export async function saveClubEvent(input: SaveClubEventInput) {
  const supabase = await createClient();
  const validation = validateClubEventInput(input);
  if (!validation.ok) throw new Error(validation.reason);
  const actorId = (await verifyClubEventAccess(supabase, {
    clubId: input.clubId,
    eventId: input.id,
    classId: cleanString(input.classId),
  })).userId;

  if (await isDevClubBypassId(input.clubId)) {
    return input.id ?? "dev-club-event";
  }

  const admin = supabase;
  const classId = cleanString(input.classId);

  if (classId) {
    const { data: cohort, error: cohortError } = await admin
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("club_id", input.clubId)
      .maybeSingle();
    if (cohortError) throw new Error(cohortError.message);
    if (!cohort) throw new Error("Event cohort must belong to this club.");
  }

  const payload = {
    club_id: input.clubId,
    class_id: classId,
    title: validation.payload.title,
    event_type: validation.payload.eventType,
    room: cleanString(input.room),
    location: cleanString(input.location),
    start_date: validation.payload.startDate,
    end_date: validation.payload.endDate,
    start_time: validation.payload.startTime,
    end_time: validation.payload.endTime,
    timezone: validation.payload.timezone,
    recurrence_rule: validation.payload.recurrenceRule,
    recurrence_summary: validation.payload.recurrenceSummary,
    status: "active",
    updated_at: new Date().toISOString(),
  };
  let savedId = input.id ?? null;

  if (input.id) {
    const { error } = await admin
      .from("club_events")
      .update(payload)
      .eq("id", input.id)
      .eq("club_id", input.clubId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await admin
      .from("club_events")
      .insert({ ...payload, created_by: actorId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    savedId = data.id as string;
  }

  revalidatePath("/dashboard/admin/clubs");
  revalidatePath(`/dashboard/admin/clubs/${input.clubId}`);
  return savedId;
}

export async function deleteClubEvent(clubId: string, eventId: string) {
  const supabase = await createClient();
  await verifyClubEventAccess(supabase, { clubId, eventId });

  if (await isDevClubBypassId(clubId)) return;

  const admin = supabase;
  const { error } = await admin
    .from("club_events")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("club_id", clubId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/clubs");
  revalidatePath(`/dashboard/admin/clubs/${clubId}`);
}

export async function claimClubInvitation(token: string): Promise<
  | { status: "auth_required" | "not_found" | "expired" | "revoked" }
  | { status: "email_mismatch"; expectedEmail?: undefined }
  | { status: "already_in_org"; clubId: string }
  | { status: "accepted"; clubId: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "auth_required" as const };
  const tokenHash = invitationTokenHash(token);
  const { data, error } = await supabase.rpc("consume_organization_invitation", {
    p_token_hash: tokenHash,
  });
  if (error) throw new Error(error.message);

  const result = data && typeof data === "object"
    ? (data as { status?: unknown; clubId?: unknown; organizationId?: unknown })
    : null;
  const status = result?.status;
  if (status === "invalid" || typeof status !== "string") {
    return { status: "not_found" as const };
  }
  if (status === "expired" || status === "revoked" || status === "email_mismatch") {
    return { status } as const;
  }
  if (!result) return { status: "not_found" as const };
  const clubId = typeof result.clubId === "string"
    ? result.clubId
    : typeof result.organizationId === "string"
      ? result.organizationId
      : null;
  if (!clubId) return { status: "not_found" as const };
  if (status === "already_in_org") return { status, clubId } as const;
  if (status !== "accepted") return { status: "not_found" as const };

  revalidatePath(`/dashboard/admin/clubs/${clubId}`);
  revalidatePath(`/dashboard/admin/organizations/${clubId}`);
  return { status: "accepted" as const, clubId };
}

export async function saveCoachReview(input: {
  clubId: string;
  performanceAttemptId: string;
  comment?: string | null;
  visibility?: "coach_only" | "student_visible";
  status?: "open" | "resolved";
  scoreAdjustments?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  if (!input.clubId || !input.performanceAttemptId) throw new Error("Club and attempt are required");

  if (await isDevClubBypassId(input.clubId)) {
    return "dev-review";
  }

  const { data, error } = await supabase
    .from("coach_reviews")
    .insert({
      club_id: input.clubId,
      performance_attempt_id: input.performanceAttemptId,
      reviewer_id: adminId,
      comment: input.comment?.trim() || null,
      visibility: input.visibility ?? "coach_only",
      status: input.status ?? "open",
      score_adjustments: input.scoreAdjustments ?? {},
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/admin/clubs/${input.clubId}`);
  return data.id as string;
}
