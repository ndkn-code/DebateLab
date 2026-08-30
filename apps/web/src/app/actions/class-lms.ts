"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireClassManager, requireClubOwner } from "@/lib/api/class-manager-access";
import {
  announcementInputSchema,
  announcementUpdateSchema,
  contentAssignmentSchema,
  LMS_PILOT_FEATURE_KEY,
  LMS_RESOURCE_ALLOWED_MIME_TYPES,
  LMS_RESOURCE_BUCKET,
  LMS_RESOURCE_MAX_SIZE_BYTES,
  resourceInputSchema,
  resourceUploadInputSchema,
  vocabularyItemInputSchema,
  vocabularySetInputSchema,
  normalizeAnnouncementStatus,
  type LmsAnnouncement,
  type LmsNotification,
  type LmsResource,
  type LmsVocabularySet,
} from "@/lib/api/class-lms/model";
import { loadMyStudentLmsWeek } from "@/lib/api/class-lms/student-weekly-repository";

type Db = Awaited<ReturnType<typeof createClient>>;

async function dbClient(): Promise<Db> {
  return (await createClient()) as Db;
}

function inputError(error: unknown): never {
  const message = error instanceof Error ? error.message : "Invalid LMS input";
  throw new Error(message);
}

async function pilotEnabled(db: Db, clubId: string, classId?: string | null) {
  const query = db.from("lms_pilot_flags").select("id, class_id, enabled").eq("club_id", clubId).eq("feature_key", LMS_PILOT_FEATURE_KEY);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const specific = classId ? (data ?? []).find((row: { class_id: string | null }) => row.class_id === classId) : undefined;
  const organisation = (data ?? []).find((row: { class_id: string | null }) => row.class_id === null);
  return Boolean((specific ?? organisation)?.enabled);
}

async function assertPilot(db: Db, clubId: string, classId?: string | null) {
  if (!(await pilotEnabled(db, clubId, classId))) throw new Error("IELTS LMS pilot is not enabled for this organisation or class.");
}

async function classContext(db: Db, classId: string) {
  return requireClassManager(db as never, classId);
}

function mapAnnouncement(row: Record<string, unknown>): LmsAnnouncement {
  return {
    id: String(row.id), classId: String(row.class_id), title: String(row.title), body: String(row.body),
    status: row.status as LmsAnnouncement["status"], publishAt: (row.publish_at as string | null) ?? null,
    publishedAt: (row.published_at as string | null) ?? null, archivedAt: (row.archived_at as string | null) ?? null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function mapResource(row: Record<string, unknown>): LmsResource {
  return {
    id: String(row.id), clubId: String(row.club_id), scopeClassId: (row.scope_class_id as string | null) ?? null, title: String(row.title), description: (row.description as string | null) ?? null,
    kind: row.kind as LmsResource["kind"], url: (row.url as string | null) ?? null, storagePath: (row.storage_path as string | null) ?? null,
    mimeType: (row.mime_type as string | null) ?? null, sizeBytes: row.size_bytes === null || row.size_bytes === undefined ? null : Number(row.size_bytes),
    provenance: (row.provenance as string | null) ?? null, licenseStatus: row.license_status as LmsResource["licenseStatus"],
    status: row.status as LmsResource["status"], createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function mapVocabularySet(row: Record<string, unknown>): LmsVocabularySet {
  const items = Array.isArray(row.items) ? row.items : [];
  return {
    id: String(row.id), clubId: String(row.club_id), scopeClassId: (row.scope_class_id as string | null) ?? null, title: String(row.title), description: (row.description as string | null) ?? null,
    provenance: (row.provenance as string | null) ?? null, licenseStatus: row.license_status as LmsVocabularySet["licenseStatus"],
    status: row.status as LmsVocabularySet["status"],
    items: items.map((item: Record<string, unknown>) => ({ id: String(item.id), term: String(item.term), definition: String(item.definition), example: (item.example as string | null) ?? null, translation: (item.translation as string | null) ?? null, orderIndex: Number(item.order_index ?? 0) })),
  };
}

function relatedRecord(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : null;
}

const uuidPathPart = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeUploadFileName(fileName: string) {
  const cleaned = fileName.trim().replace(/[\\/]/g, "-").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  const extension = cleaned.includes(".") ? cleaned.slice(cleaned.lastIndexOf(".")).replace(/[^a-zA-Z0-9.]/g, "") : "";
  return `${randomUUID()}${extension.slice(0, 12)}`;
}

function assertResourceStoragePath(path: string, input: { clubId: string; scopeClassId: string | null; userId: string }) {
  const parts = path.split("/");
  if (parts.length !== 5 || parts[0] !== input.clubId || parts[1] !== (input.scopeClassId ?? "org") || parts[2] !== input.userId || !uuidPathPart.test(parts[3]) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,139}$/.test(parts[4])) {
    throw new Error("Invalid resource upload path.");
  }
}

type ResourceStorageObject = {
  name: string;
  owner: string | null;
  owner_id: string | null;
  metadata: Record<string, unknown> | null;
};

async function verifyResourceStorageObject(path: string, input: { clubId: string; scopeClassId: string | null; userId: string; mimeType: string; sizeBytes: number }) {
  assertResourceStoragePath(path, input);
  const admin = createAdminClient();
  const { data, error } = await admin.schema("storage").from("objects").select("name, owner, owner_id, metadata").eq("bucket_id", LMS_RESOURCE_BUCKET).eq("name", path).maybeSingle();
  if (error) throw new Error(error.message);
  const object = data as ResourceStorageObject | null;
  if (!object) throw new Error("Uploaded resource file was not found.");
  const owner = object.owner ?? object.owner_id;
  if (owner !== input.userId) throw new Error("Uploaded resource file ownership does not match.");
  const metadata = object.metadata ?? {};
  const actualSize = Number(metadata.size ?? metadata.size_bytes ?? NaN);
  const actualMime = String(metadata.mimetype ?? metadata.contentType ?? "").trim();
  if (!Number.isSafeInteger(actualSize) || actualSize !== input.sizeBytes) throw new Error("Uploaded resource file size does not match.");
  if (actualMime !== input.mimeType) throw new Error("Uploaded resource file MIME type does not match.");
}

export async function prepareClassResourceUpload(input: unknown) {
  const parsed = (() => { try { return resourceUploadInputSchema.parse(input); } catch (error) { return inputError(error); } })();
  if (!LMS_RESOURCE_ALLOWED_MIME_TYPES.includes(parsed.mimeType)) throw new Error("Unsupported resource MIME type.");
  const db = await dbClient();
  let userId: string;
  if (parsed.scopeClassId) {
    const context = await classContext(db, parsed.scopeClassId);
    if (context.clubId !== parsed.clubId) throw new Error("Class does not belong to this organisation.");
    await assertPilot(db, parsed.clubId, parsed.scopeClassId);
    userId = context.userId;
  } else {
    userId = await requireClubOwner(db as never, parsed.clubId);
    await assertPilot(db, parsed.clubId);
  }
  const storagePath = `${parsed.clubId}/${parsed.scopeClassId ?? "org"}/${userId}/${randomUUID()}/${safeUploadFileName(parsed.fileName)}`;
  const { data, error } = await db.storage.from(LMS_RESOURCE_BUCKET).createSignedUploadUrl(storagePath);
  if (error) throw new Error(error.message);
  return { bucket: LMS_RESOURCE_BUCKET, storagePath, token: data.token, signedUrl: data.signedUrl, mimeType: parsed.mimeType, sizeBytes: parsed.sizeBytes, maxSizeBytes: LMS_RESOURCE_MAX_SIZE_BYTES };
}

export async function setIeltsLmsPilot(input: unknown) {
  const parsed = (() => { try { return z.object({ clubId: z.string().uuid(), classId: z.string().uuid().nullable().optional(), enabled: z.boolean() }).strict().parse(input); } catch (error) { return inputError(error); } })();
  const db = await dbClient();
  const actorUserId = await requireClubOwner(db as never, parsed.clubId);
  if (parsed.classId) {
    const { data: classRow, error: classError } = await db.from("classes").select("id, club_id, program_type").eq("id", parsed.classId).maybeSingle();
    if (classError) throw new Error(classError.message);
    if (!classRow || classRow.club_id !== parsed.clubId) throw new Error("Class does not belong to this organisation.");
    if (classRow.program_type !== "ielts") throw new Error("IELTS LMS pilot requires an IELTS class.");
  }
  const now = new Date().toISOString();
  let existingQuery = db.from("lms_pilot_flags").select("id").eq("club_id", parsed.clubId).eq("feature_key", LMS_PILOT_FEATURE_KEY);
  existingQuery = parsed.classId ? existingQuery.eq("class_id", parsed.classId) : existingQuery.is("class_id", null);
  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) throw new Error(existingError.message);
  const values = { club_id: parsed.clubId, class_id: parsed.classId ?? null, feature_key: LMS_PILOT_FEATURE_KEY, enabled: parsed.enabled, enabled_by: actorUserId, enabled_at: parsed.enabled ? now : null, disabled_at: parsed.enabled ? null : now, updated_at: now };
  const result = existing ? await db.from("lms_pilot_flags").update(values).eq("id", existing.id) : await db.from("lms_pilot_flags").insert(values);
  if (result.error) throw new Error(result.error.message);
  return { ok: true, enabled: parsed.enabled, clubId: parsed.clubId, classId: parsed.classId ?? null };
}

export async function saveClassAnnouncement(input: unknown) {
  const parsed = (() => { try { return announcementInputSchema.parse(input); } catch (error) { return inputError(error); } })();
  const db = await dbClient();
  const context = await classContext(db, parsed.classId);
  if (!context.clubId) throw new Error("Class is not part of an organisation.");
  await assertPilot(db, context.clubId, parsed.classId);
  const normalized = normalizeAnnouncementStatus(parsed.status);
  const { data, error } = await db.from("lms_announcements").insert({ club_id: context.clubId, class_id: parsed.classId, title: parsed.title, body: parsed.body, status: normalized.status, publish_at: parsed.publishAt ?? null, published_at: normalized.publishedAt ?? null, archived_at: normalized.archivedAt ?? null, created_by: context.userId, updated_by: context.userId }).select("*").single();
  if (error) throw new Error(error.message);
  revalidatePath(`/classes/${parsed.classId}`);
  return mapAnnouncement(data);
}

export async function updateClassAnnouncement(input: unknown) {
  const parsed = (() => { try { return announcementUpdateSchema.parse(input); } catch (error) { return inputError(error); } })();
  const db = await dbClient();
  const context = await classContext(db, parsed.classId);
  if (!context.clubId) throw new Error("Class is not part of an organisation.");
  await assertPilot(db, context.clubId, parsed.classId);
  const normalized = normalizeAnnouncementStatus(parsed.status);
  const { data, error } = await db.from("lms_announcements").update({ title: parsed.title, body: parsed.body, status: normalized.status, publish_at: parsed.publishAt ?? null, published_at: normalized.publishedAt ?? null, archived_at: normalized.archivedAt ?? null, updated_by: context.userId, updated_at: new Date().toISOString() }).eq("id", parsed.id).eq("class_id", parsed.classId).select("*").single();
  if (error) throw new Error(error.message);
  return mapAnnouncement(data);
}

export async function listClassAnnouncements(classId: string) {
  const db = await dbClient();
  if (!classId || typeof classId !== "string") throw new Error("Invalid class id");
  const { data, error } = await db.from("lms_announcements").select("*").eq("class_id", classId).order("publish_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAnnouncement);
}

export async function createClassResource(input: unknown) {
  const parsed = (() => { try { return resourceInputSchema.parse(input); } catch (error) { return inputError(error); } })();
  const db = await dbClient();
  let actor: string;
  if (parsed.scopeClassId) {
    const context = await classContext(db, parsed.scopeClassId);
    if (context.clubId !== parsed.clubId) throw new Error("Class does not belong to this organisation.");
    actor = context.userId;
    await assertPilot(db, parsed.clubId, parsed.scopeClassId);
  } else {
    actor = await requireClubOwner(db as never, parsed.clubId);
    await assertPilot(db, parsed.clubId);
  }
  if (parsed.kind === "file") {
    await verifyResourceStorageObject(parsed.storagePath!, { clubId: parsed.clubId, scopeClassId: parsed.scopeClassId ?? null, userId: actor, mimeType: parsed.mimeType!, sizeBytes: parsed.sizeBytes! });
  }
  const { data, error } = await db.from("lms_resources").insert({ club_id: parsed.clubId, scope_class_id: parsed.scopeClassId ?? null, title: parsed.title, description: parsed.description ?? null, kind: parsed.kind, url: parsed.url ?? null, storage_path: parsed.storagePath ?? null, mime_type: parsed.mimeType ?? null, size_bytes: parsed.sizeBytes ?? null, provenance: parsed.provenance ?? null, license_status: parsed.licenseStatus, status: parsed.status, created_by: actor, published_at: parsed.status === "published" ? new Date().toISOString() : null, metadata: parsed.metadata }).select("*").single();
  if (error) throw new Error(error.message);
  return mapResource(data);
}

export async function assignClassResource(input: unknown) {
  const parsed = (() => { try { return z.object({ resourceId: z.string().uuid(), ...contentAssignmentSchema.shape }).strict().refine((value) => Boolean(value.classId || value.courseId), "Assign content to a class or course.").parse(input); } catch (error) { return inputError(error); } })();
  const db = await dbClient();
  const { data: resource, error: resourceError } = await db.from("lms_resources").select("id, club_id").eq("id", parsed.resourceId).maybeSingle();
  if (resourceError) throw new Error(resourceError.message);
  if (!resource) throw new Error("Resource not found");
  let actorUserId: string;
  if (parsed.classId) {
    const context = await classContext(db, parsed.classId);
    if (context.clubId !== resource.club_id) throw new Error("Resource organisation mismatch.");
    actorUserId = context.userId;
  } else {
    actorUserId = await requireClubOwner(db as never, resource.club_id);
  }
  await assertPilot(db, resource.club_id, parsed.classId ?? null);
  let existingQuery = db.from("lms_resource_assignments").select("id").eq("resource_id", parsed.resourceId);
  existingQuery = parsed.classId ? existingQuery.eq("class_id", parsed.classId) : existingQuery.eq("course_id", parsed.courseId);
  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) throw new Error(existingError.message);
  const values = { resource_id: parsed.resourceId, class_id: parsed.classId ?? null, course_id: parsed.courseId ?? null, assigned_by: actorUserId };
  const result = existing ? await db.from("lms_resource_assignments").update({ assigned_by: actorUserId }).eq("id", existing.id) : await db.from("lms_resource_assignments").insert(values);
  if (result.error) throw new Error(result.error.message);
  return { ok: true, resourceId: parsed.resourceId, classId: parsed.classId ?? null, courseId: parsed.courseId ?? null };
}

export async function listClassResources(classId: string) {
  const db = await dbClient();
  if (!classId || typeof classId !== "string") throw new Error("Invalid class id");
  const { data, error } = await db.from("lms_resource_assignments").select("resource:lms_resources(*)").eq("class_id", classId);
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => {
    const resource = relatedRecord(row.resource);
    return resource ? [mapResource(resource)] : [];
  });
}

export async function createVocabularySet(input: unknown) {
  const parsed = (() => { try { return vocabularySetInputSchema.parse(input); } catch (error) { return inputError(error); } })();
  const db = await dbClient();
  let actor: string;
  if (parsed.scopeClassId) {
    const context = await classContext(db, parsed.scopeClassId);
    if (context.clubId !== parsed.clubId) throw new Error("Class does not belong to this organisation.");
    actor = context.userId;
    await assertPilot(db, parsed.clubId, parsed.scopeClassId);
  } else {
    actor = await requireClubOwner(db as never, parsed.clubId);
    await assertPilot(db, parsed.clubId);
  }
  const { data, error } = await db.from("lms_vocabulary_sets").insert({ club_id: parsed.clubId, scope_class_id: parsed.scopeClassId ?? null, title: parsed.title, description: parsed.description ?? null, provenance: parsed.provenance ?? null, license_status: parsed.licenseStatus, status: parsed.status, created_by: actor, published_at: parsed.status === "published" ? new Date().toISOString() : null, metadata: parsed.metadata }).select("*").single();
  if (error) throw new Error(error.message);
  return mapVocabularySet(data);
}

export async function saveVocabularyItem(input: unknown) {
  const parsed = (() => { try { return vocabularyItemInputSchema.parse(input); } catch (error) { return inputError(error); } })();
  const db = await dbClient();
  const { data: set, error: setError } = await db.from("lms_vocabulary_sets").select("id, club_id, scope_class_id").eq("id", parsed.setId).maybeSingle();
  if (setError) throw new Error(setError.message);
  if (!set) throw new Error("Vocabulary set not found");
  if (set.scope_class_id) {
    const context = await classContext(db, set.scope_class_id);
    if (context.clubId !== set.club_id) throw new Error("Vocabulary organisation mismatch.");
    await assertPilot(db, set.club_id, set.scope_class_id);
  } else {
    await requireClubOwner(db as never, set.club_id);
    await assertPilot(db, set.club_id);
  }
  const { data, error } = await db.from("lms_vocabulary_items").upsert({ set_id: parsed.setId, term: parsed.term, definition: parsed.definition, example: parsed.example ?? null, translation: parsed.translation ?? null, order_index: parsed.orderIndex, metadata: parsed.metadata }, { onConflict: "set_id,term" }).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function assignVocabularySet(input: unknown) {
  const parsed = (() => { try { return z.object({ setId: z.string().uuid(), ...contentAssignmentSchema.shape }).strict().refine((value) => Boolean(value.classId || value.courseId), "Assign content to a class or course.").parse(input); } catch (error) { return inputError(error); } })();
  const db = await dbClient();
  const { data: set, error: setError } = await db.from("lms_vocabulary_sets").select("id, club_id").eq("id", parsed.setId).maybeSingle();
  if (setError) throw new Error(setError.message);
  if (!set) throw new Error("Vocabulary set not found");
  let actorUserId: string;
  if (parsed.classId) {
    const context = await classContext(db, parsed.classId);
    if (context.clubId !== set.club_id) throw new Error("Vocabulary organisation mismatch.");
    actorUserId = context.userId;
  } else {
    actorUserId = await requireClubOwner(db as never, set.club_id);
  }
  await assertPilot(db, set.club_id, parsed.classId ?? null);
  let existingQuery = db.from("lms_vocabulary_assignments").select("id").eq("set_id", parsed.setId);
  existingQuery = parsed.classId ? existingQuery.eq("class_id", parsed.classId) : existingQuery.eq("course_id", parsed.courseId);
  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) throw new Error(existingError.message);
  const values = { set_id: parsed.setId, class_id: parsed.classId ?? null, course_id: parsed.courseId ?? null, assigned_by: actorUserId };
  const result = existing ? await db.from("lms_vocabulary_assignments").update({ assigned_by: actorUserId }).eq("id", existing.id) : await db.from("lms_vocabulary_assignments").insert(values);
  if (result.error) throw new Error(result.error.message);
  return { ok: true, setId: parsed.setId, classId: parsed.classId ?? null, courseId: parsed.courseId ?? null };
}

export async function listClassVocabulary(classId: string) {
  const db = await dbClient();
  if (!classId || typeof classId !== "string") throw new Error("Invalid class id");
  const { data, error } = await db.from("lms_vocabulary_assignments").select("set:lms_vocabulary_sets(*, items:lms_vocabulary_items(*))").eq("class_id", classId);
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => {
    const set = relatedRecord(row.set);
    return set ? [mapVocabularySet(set)] : [];
  });
}

export async function listMyLmsNotifications(limit = 50): Promise<LmsNotification[]> {
  const db = await dbClient();
  const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? Math.floor(limit) : 50, 1), 100);
  const { data, error } = await db.from("lms_notifications").select("id, event_type, title, body, read_at, created_at").order("created_at", { ascending: false }).limit(safeLimit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => ({ id: String(row.id), eventType: row.event_type as LmsNotification["eventType"], title: String(row.title), body: String(row.body), readAt: (row.read_at as string | null) ?? null, createdAt: String(row.created_at) }));
}

export async function markLmsNotificationRead(notificationId: string) {
  const db = await dbClient();
  if (!/^[0-9a-f-]{36}$/i.test(notificationId)) throw new Error("Invalid notification id");
  const { error } = await db.from("lms_notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);
  if (error) throw new Error(error.message);
  return { ok: true, id: notificationId };
}

export async function loadMyIeltsLmsWeek(input: unknown) {
  const parsed = (() => {
    try {
      return z.object({ startDate: z.string(), endDate: z.string() }).strict().parse(input);
    } catch (error) {
      return inputError(error);
    }
  })();
  return loadMyStudentLmsWeek(parsed);
}
