"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_ADMIN_PROFILE, isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import {
  normalizeClubRecipients,
  normalizeEmailAddress,
  normalizeSocialUrl,
  validateClubAssignmentInput,
  validateClubCreationInput,
  validateClubEventInput,
} from "@/lib/api/admin-clubs-model";
import { getAppBaseUrl } from "@/lib/email/config";
import { sendClubInvitationEmail } from "@/lib/email/club-invitations";
import type {
  ClubAssignmentInput,
  ClubRecipientInput,
  ClubRecipientResult,
  CreateClubResult,
  SaveClubEventInput,
} from "@/lib/types/admin-clubs";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function verifyAdmin(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isDevAdminBypassEnabled()) return DEV_ADMIN_PROFILE.id;
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

function isDevClubId(id: string) {
  return isDevAdminBypassEnabled() && id.startsWith("00000000-0000-4c00-8000-");
}

async function verifyClubManager(supabase: Supabase, clubId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isDevAdminBypassEnabled()) return DEV_ADMIN_PROFILE.id;
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
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["owner", "coach"])
    .maybeSingle();

  if (membership) return user.id;
  if (isDevAdminBypassEnabled()) return user.id;
  throw new Error("Forbidden");
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

function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

function safeLogoExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
  return null;
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
  if (!emails.length) return new Map<string, { id: string; email: string | null; display_name: string | null }>();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, display_name")
    .in("email", emails);
  if (error) throw new Error(error.message);

  return new Map(
    (data ?? [])
      .filter((profile) => profile.email)
      .map((profile) => [String(profile.email).toLowerCase(), profile as { id: string; email: string | null; display_name: string | null }])
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
  profilesByEmail: Map<string, { id: string; email: string | null; display_name: string | null }>;
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
  profilesByEmail: Map<string, { id: string; email: string | null; display_name: string | null }>;
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
      .eq("role", recipient.role)
      .eq("status", "pending")
      .maybeSingle();

    if (existing.error && existing.error.code !== "PGRST116") {
      results.push({
        email: recipient.email,
        role: recipient.role,
        status: "failed",
        message: existing.error.message,
      });
      continue;
    }

    const invitationMutation = existing.data?.id
      ? admin
          .from("club_invitations")
          .update({
            token_hash: tokenHash,
            expires_at: expiresAt,
            invited_by: input.invitedBy,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.data.id)
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

export async function createClubAssignment(input: ClubAssignmentInput) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  const validation = validateClubAssignmentInput(input);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  if (isDevClubId(input.clubId)) {
    return "00000000-0000-4c20-8000-000000000999";
  }

  const { data, error } = await supabase
    .from("club_assignments")
    .insert({
      club_id: input.clubId,
      class_id: input.classId ?? null,
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
      created_by: adminId,
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
  const actorId = await verifyClubManager(supabase, input.clubId);
  const validation = validateClubEventInput(input);
  if (!validation.ok) throw new Error(validation.reason);

  if (isDevClubId(input.clubId)) {
    return input.id ?? "dev-club-event";
  }

  const admin = createAdminClient();
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
  await verifyClubManager(supabase, clubId);

  if (isDevClubId(clubId)) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("club_events")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("club_id", clubId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/clubs");
  revalidatePath(`/dashboard/admin/clubs/${clubId}`);
}

export async function claimClubInvitation(token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "auth_required" as const };

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email")
    .eq("id", user.id)
    .single();
  if (profileError) throw new Error(profileError.message);

  const tokenHash = invitationTokenHash(token);
  const { data: invitation, error } = await admin
    .from("club_invitations")
    .select("id, club_id, email, role, status, expires_at, invited_by")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invitation) return { status: "not_found" as const };
  if (invitation.status === "accepted") {
    return { status: "accepted" as const, clubId: invitation.club_id as string };
  }
  if (invitation.status !== "pending") return { status: invitation.status as "revoked" | "expired" };

  if (new Date(invitation.expires_at as string).getTime() < Date.now()) {
    await admin
      .from("club_invitations")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", invitation.id);
    return { status: "expired" as const };
  }

  const invitationEmail = normalizeEmailAddress(invitation.email);
  const profileEmail = normalizeEmailAddress(profile.email);
  if (!invitationEmail || !profileEmail || invitationEmail !== profileEmail) {
    return { status: "email_mismatch" as const, expectedEmail: invitation.email as string };
  }

  const { error: membershipError } = await admin.from("club_memberships").upsert(
    {
      club_id: invitation.club_id,
      user_id: user.id,
      role: invitation.role,
      status: "active",
      removed_at: null,
      invited_by: invitation.invited_by,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "club_id,user_id,role" }
  );
  if (membershipError) throw new Error(membershipError.message);

  const { error: invitationError } = await admin
    .from("club_invitations")
    .update({
      status: "accepted",
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);
  if (invitationError) throw new Error(invitationError.message);

  revalidatePath(`/dashboard/admin/clubs/${invitation.club_id}`);
  return { status: "accepted" as const, clubId: invitation.club_id as string };
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

  if (isDevClubId(input.clubId)) {
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
