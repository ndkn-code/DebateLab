import "server-only";

import { createTypedAdminClient } from "@/lib/supabase/admin";
import { createTypedServerClient } from "@/lib/supabase/server";
import {
  materialAccessRuleSchema,
  materialPlacementInputSchema,
  materialRightsInputSchema,
  materialUploadInputSchema,
  type MaterialAccessRule,
  type MaterialPlacementInput,
  type MaterialRightsBasis,
  type MaterialRenditionKind,
} from "./material-contracts";
import { z } from "zod";

/**
 * Server-only adapter for the shared-material RPC boundary. The database owns
 * authorization, tenant checks, release windows, AND unlock evaluation, and
 * audit writes. No caller should query material tables directly from a
 * browser/client component.
 *
 * RPC names are kept in one place so a migration can evolve without spreading
 * SQL names throughout actions and loaders. The adapter intentionally uses a
 * narrow untyped RPC interface: generated Supabase types lag additive
 * migrations and must not become an authorization boundary.
 */
export const SHARED_MATERIAL_RPCS = {
  listManager: "lms_list_materials_manager",
  prepareUpload: "prepare_lms_material_upload",
  place: "lms_place_material",
  setAudience: "lms_set_material_audience",
  setRules: "lms_set_material_unlock_rules",
  setRights: "lms_set_material_rights",
  publish: "lms_publish_material",
  withdraw: "lms_withdraw_material",
  listLearner: "load_lms_materials_for_user",
} as const;

type RpcResponse = { data: unknown; error: { message: string } | null };
export type MaterialRpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResponse>;
  storage?: { from: (bucket: string) => { createSignedUrl: (path: string, expiresIn: number) => PromiseLike<{ data: { signedUrl?: string } | null; error: { message: string } | null }> } };
};
type MaterialStorageClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => PromiseLike<{ data: { bucket_id?: string; storage_path?: string } | null; error: { message: string } | null }>;
          };
          maybeSingle: () => PromiseLike<{ data: { bucket_id?: string; storage_path?: string } | null; error: { message: string } | null }>;
        };
        maybeSingle: () => PromiseLike<{ data: { bucket_id?: string; storage_path?: string } | null; error: { message: string } | null }>;
      };
    };
  };
  storage: { from: (bucket: string) => { createSignedUrl: (path: string, expiresIn: number) => PromiseLike<{ data: { signedUrl?: string } | null; error: { message: string } | null }> } };
};
type RpcClient = MaterialRpcClient;

type Raw = Record<string, unknown>;

export interface ManagerMaterialRow {
  id: string;
  versionId: string;
  title: string;
  description: string | null;
  processingStatus: string;
  versionNumber: number;
  createdAt: string;
  updatedAt: string;
  placements: MaterialPlacementView[];
}

export interface MaterialPlacementView {
  id: string;
  materialId: string;
  versionId: string;
  targetType: MaterialPlacementInput["targetType"];
  targetId: string;
  status: MaterialPlacementInput["status"];
  releaseAt: string | null;
  expiresAt: string | null;
  required: boolean;
  orderIndex: number;
  audienceCount: number;
  rules: MaterialAccessRule[];
}

export interface LearnerMaterialRow {
  id: string;
  placementId: string;
  versionId: string;
  title: string;
  description: string | null;
  renditionKind: Exclude<MaterialRenditionKind, "original">;
  signedUrl: string | null;
  unlocked: boolean;
  blockedBy: MaterialAccessRule[];
  releaseAt: string | null;
  expiresAt: string | null;
  required: boolean;
  orderIndex: number;
  targetType: MaterialPlacementInput["targetType"];
  courseId: string | null;
  classId: string | null;
  occurrenceId: string | null;
  assignmentId: string | null;
  processingStatus: string;
  accessState: "available" | "locked" | "processing";
  lockReasons: string[];
  previewMimeType: string | null;
  pageCount: number | null;
  nativeDocument: unknown;
}

export interface MaterialPage<T> {
  rows: T[];
  nextCursor: string | null;
}

const managerRowSchema = z.object({
  id: z.string().uuid(),
  version_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  processing_status: z.string(),
  version_number: z.number().int().nonnegative().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  placements: z.array(z.record(z.string(), z.unknown())).optional(),
}).passthrough();

function rawList(value: unknown): Raw[] {
  if (Array.isArray(value)) return value.filter((row): row is Raw => Boolean(row) && typeof row === "object");
  if (value && typeof value === "object") {
    const rows = (value as Raw).rows;
    return Array.isArray(rows) ? rows.filter((row): row is Raw => Boolean(row) && typeof row === "object") : [];
  }
  return [];
}

function nextCursor(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const cursor = (value as Raw).next_cursor ?? (value as Raw).nextCursor;
  return typeof cursor === "string" && cursor.length <= 512 ? cursor : null;
}

function text(row: Raw, snake: string, camel = snake): string {
  const value = row[snake] ?? row[camel];
  return typeof value === "string" ? value : "";
}

function nullableText(row: Raw, snake: string, camel = snake): string | null {
  const value = row[snake] ?? row[camel];
  return typeof value === "string" ? value : null;
}

function bool(row: Raw, snake: string, camel = snake): boolean {
  return (row[snake] ?? row[camel]) === true;
}

function number(row: Raw, snake: string, camel = snake): number {
  const value = row[snake] ?? row[camel];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseRules(value: unknown): MaterialAccessRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rule) => {
    const parsed = materialAccessRuleSchema.safeParse(rule);
    return parsed.success ? [parsed.data] : [];
  });
}

function mapPlacement(row: Raw, fallbackMaterialId: string, fallbackVersionId: string): MaterialPlacementView {
  const targetType = text(row, "target_type", "targetType") as MaterialPlacementInput["targetType"];
  const targetId = text(row, `${targetType}_id`, "targetId");
  return {
    id: text(row, "id"),
    materialId: text(row, "material_id", "materialId") || fallbackMaterialId,
    versionId: text(row, "version_id", "versionId") || fallbackVersionId,
    targetType,
    targetId,
    status: text(row, "status") as MaterialPlacementInput["status"],
    releaseAt: nullableText(row, "release_at", "releaseAt"),
    expiresAt: nullableText(row, "expires_at", "expiresAt"),
    required: bool(row, "required"),
    orderIndex: number(row, "order_index", "orderIndex"),
    audienceCount: number(row, "audience_count", "audienceCount"),
    rules: parseRules(row.rules),
  };
}

function mapManagerRow(row: Raw): ManagerMaterialRow | null {
  const parsed = managerRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const materialId = text(row, "id");
  const versionId = text(row, "version_id", "versionId");
  return {
    id: materialId,
    versionId,
    title: text(row, "title"),
    description: nullableText(row, "description"),
    processingStatus: text(row, "processing_status", "processingStatus"),
    versionNumber: number(row, "version_number", "versionNumber"),
    createdAt: text(row, "created_at", "createdAt"),
    updatedAt: text(row, "updated_at", "updatedAt"),
    placements: Array.isArray(row.placements) ? row.placements.filter((item): item is Raw => Boolean(item) && typeof item === "object").map((item) => mapPlacement(item, materialId, versionId)) : [],
  };
}

export function parseManagerMaterialPage(value: unknown): MaterialPage<ManagerMaterialRow> {
  const rows = rawList(value).map(mapManagerRow).filter((row): row is ManagerMaterialRow => row !== null);
  return { rows, nextCursor: nextCursor(value) };
}

function mapLearnerRow(row: Raw): LearnerMaterialRow | null {
  const id = text(row, "material_id", "materialId") || text(row, "id");
  const placementId = text(row, "placement_id", "placementId");
  const versionId = text(row, "version_id", "versionId");
  const renditionKind = text(row, "preview_kind", "previewKind") as Exclude<MaterialRenditionKind, "original">;
  const accessState = text(row, "access_state", "accessState") as LearnerMaterialRow["accessState"];
  if (!id || !placementId || !versionId || !renditionKind || renditionKind === "original") return null;
  if (!["available", "locked", "processing"].includes(accessState)) return null;
  return {
    id,
    placementId,
    versionId,
    title: text(row, "title"),
    description: nullableText(row, "description"),
    renditionKind,
    signedUrl: nullableText(row, "signed_url", "signedUrl"),
    unlocked: accessState === "available",
    blockedBy: Array.isArray(row.lock_reasons) ? row.lock_reasons.filter((value): value is MaterialAccessRule => materialAccessRuleSchema.safeParse(value).success) : [],
    releaseAt: nullableText(row, "release_at", "releaseAt"),
    expiresAt: nullableText(row, "expires_at", "expiresAt"),
    required: bool(row, "required"),
    orderIndex: number(row, "order_index", "orderIndex"),
    targetType: text(row, "target_type", "targetType") as MaterialPlacementInput["targetType"],
    courseId: nullableText(row, "course_id", "courseId"),
    classId: nullableText(row, "class_id", "classId"),
    occurrenceId: nullableText(row, "occurrence_id", "occurrenceId"),
    assignmentId: nullableText(row, "assignment_id", "assignmentId"),
    processingStatus: text(row, "processing_status", "processingStatus"),
    accessState,
    lockReasons: Array.isArray(row.lock_reasons) ? row.lock_reasons.filter((value): value is string => typeof value === "string") : [],
    previewMimeType: nullableText(row, "preview_mime_type", "previewMimeType"),
    pageCount: row.page_count === null || row.page_count === undefined ? null : number(row, "page_count", "pageCount"),
    nativeDocument: row.native_document ?? row.nativeDocument ?? null,
  };
}

export function parseLearnerMaterialRows(value: unknown): LearnerMaterialRow[] {
  return rawList(value).map(mapLearnerRow).filter((row): row is LearnerMaterialRow => row !== null);
}

async function invoke(client: RpcClient, name: string, args: Record<string, unknown>): Promise<unknown> {
  const result = await client.rpc(name, args);
  if (result.error) throw new Error(`${name}: ${result.error.message}`);
  return result.data;
}

function rpcClient(client?: RpcClient): Promise<RpcClient> {
  return client ? Promise.resolve(client) : createTypedServerClient().then((value) => value as unknown as RpcClient);
}

export async function listManagerMaterials(params: {
  classId?: string;
  courseId?: string;
  status?: MaterialPlacementInput["status"];
  cursor?: string | null;
  limit?: number;
}, client?: RpcClient): Promise<MaterialPage<ManagerMaterialRow>> {
  const db = await rpcClient(client);
  const data = await invoke(db, SHARED_MATERIAL_RPCS.listManager, {
    p_class_id: params.classId ?? null,
    p_course_id: params.courseId ?? null,
    p_status: params.status ?? null,
    p_cursor: params.cursor ?? null,
    p_limit: Math.min(Math.max(Math.floor(params.limit ?? 50), 1), 100),
  });
  return parseManagerMaterialPage(data);
}

export async function prepareSharedMaterialUpload(input: unknown, client?: RpcClient) {
  const db = await rpcClient(client);
  const parsed = materialUploadInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  return invoke(db, SHARED_MATERIAL_RPCS.prepareUpload, { p_input: parsed.data });
}

export async function publishSharedMaterial(materialId: string, versionId: string, client?: RpcClient) {
  const db = await rpcClient(client);
  const parsed = z.object({ materialId: z.string().uuid(), versionId: z.string().uuid() }).safeParse({ materialId, versionId });
  if (!parsed.success) throw new Error("Invalid material version.");
  return invoke(db, SHARED_MATERIAL_RPCS.publish, { p_material_id: materialId, p_version_id: versionId });
}

export async function withdrawSharedMaterial(materialId: string, placementId: string, client?: RpcClient) {
  const db = await rpcClient(client);
  const parsed = z.object({ materialId: z.string().uuid(), placementId: z.string().uuid() }).safeParse({ materialId, placementId });
  if (!parsed.success) throw new Error("Invalid material placement.");
  return invoke(db, SHARED_MATERIAL_RPCS.withdraw, { p_material_id: materialId, p_placement_id: placementId });
}

export async function placeSharedMaterial(input: unknown, client?: RpcClient) {
  const db = await rpcClient(client);
  const parsed = materialPlacementInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  return invoke(db, SHARED_MATERIAL_RPCS.place, { p_input: parsed.data });
}

export async function setSharedMaterialAudience(input: { placementId: string; classId: string; userIds: string[] }, client?: RpcClient) {
  const db = await rpcClient(client);
  const parsed = z.object({ placementId: z.string().uuid(), classId: z.string().uuid(), userIds: z.array(z.string().uuid()).max(500) }).strict().safeParse(input);
  if (!parsed.success) throw new Error("Invalid selected-student audience.");
  return invoke(db, SHARED_MATERIAL_RPCS.setAudience, { p_placement_id: parsed.data.placementId, p_class_id: parsed.data.classId, p_user_ids: parsed.data.userIds });
}

export async function setSharedMaterialRules(input: { placementId: string; rules: MaterialAccessRule[] }, client?: RpcClient) {
  const db = await rpcClient(client);
  const parsed = z.object({ placementId: z.string().uuid(), rules: z.array(materialAccessRuleSchema).max(20) }).strict().safeParse(input);
  if (!parsed.success) throw new Error("Invalid material unlock rules.");
  return invoke(db, SHARED_MATERIAL_RPCS.setRules, { p_placement_id: parsed.data.placementId, p_rules: parsed.data.rules });
}

export async function setSharedMaterialRights(input: { materialId: string; versionId: string; basis: MaterialRightsBasis; sourceUrl?: string | null; rightsHolder?: string | null; licenseUrl?: string | null; notes?: string | null }, client?: RpcClient) {
  const db = await rpcClient(client);
  const parsed = z.object({ materialId: z.string().uuid(), versionId: z.string().uuid(), basis: z.string(), sourceUrl: z.string().url().nullable().optional(), rightsHolder: z.string().max(300).nullable().optional(), licenseUrl: z.string().url().nullable().optional(), notes: z.string().max(4_000).nullable().optional() }).strict().safeParse(input);
  if (!parsed.success) throw new Error("Invalid material rights approval.");
  const rights = materialRightsInputSchema.parse({ basis: parsed.data.basis, sourceUrl: parsed.data.sourceUrl, rightsHolder: parsed.data.rightsHolder, licenseUrl: parsed.data.licenseUrl, notes: parsed.data.notes });
  return invoke(db, SHARED_MATERIAL_RPCS.setRights, { p_material_id: parsed.data.materialId, p_version_id: parsed.data.versionId, p_rights: rights });
}

async function signPreview(db: RpcClient, row: Raw, serviceClient?: MaterialStorageClient): Promise<string | null> {
  // First ask the cookie-bound client to re-check exact placement/version/
  // rendition access. Only a service-role client may then read the path.
  if (text(row, "access_state", "accessState") !== "available") return null;
  const renditionId = text(row, "preview_rendition_id", "previewRenditionId");
  if (!renditionId) return null;
  const allowed = await invoke(db, "can_access_lms_material_preview", {
    p_placement_id: text(row, "placement_id", "placementId"),
    p_version_id: text(row, "version_id", "versionId"),
    p_rendition_id: renditionId,
  });
  if (allowed !== true) return null;
  const admin = serviceClient ?? (createTypedAdminClient() as unknown as MaterialStorageClient);
  const result = await admin.from("lms_material_renditions").select("bucket_id, storage_path")
    .eq("id", renditionId).eq("version_id", text(row, "version_id", "versionId")).eq("rendition_kind", "preview").maybeSingle();
  if (result.error || !result.data || result.data.bucket_id !== "lms-material-previews" || !result.data.storage_path) return null;
  const signed = await admin.storage.from(result.data.bucket_id).createSignedUrl(result.data.storage_path, 120);
  return signed.error ? null : signed.data?.signedUrl ?? null;
}

export async function listLearnerMaterials(params: { classId?: string; from: string; to: string }, client?: RpcClient, serviceClient?: MaterialStorageClient): Promise<MaterialPage<LearnerMaterialRow>> {
  const db = await rpcClient(client);
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  if (!date.safeParse(params.from).success || !date.safeParse(params.to).success) throw new Error("Invalid material date range.");
  const data = await invoke(db, SHARED_MATERIAL_RPCS.listLearner, { p_class_id: params.classId ?? null, p_from: params.from, p_to: params.to });
  const rows = (await Promise.all(rawList(data).map(async (row) => {
    const mapped = mapLearnerRow({ ...row, signed_url: await signPreview(db, row, serviceClient) });
    return mapped;
  }))).filter((row): row is LearnerMaterialRow => row !== null);
  return { rows, nextCursor: null };
}

/**
 * Canonical learner weekly projection. It is intentionally the only broad
 * learner read: the database function applies exact-class membership,
 * occurrence release/expiry, selected-student audiences, and AND unlock
 * rules before returning even published metadata. No storage path is accepted
 * from the projection; preview signing is a second guarded RPC.
 */
export async function loadLearnerMaterialsForWeek(params: { classId?: string; from: string; to: string }, client?: RpcClient, serviceClient?: MaterialStorageClient): Promise<LearnerMaterialRow[]> {
  const db = await rpcClient(client);
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  if (!date.safeParse(params.from).success || !date.safeParse(params.to).success) throw new Error("Invalid material date range.");
  const data = await invoke(db, SHARED_MATERIAL_RPCS.listLearner, {
    p_class_id: params.classId ?? null,
    p_from: params.from,
    p_to: params.to,
  });
  return (await Promise.all(rawList(data).map(async (row) => mapLearnerRow({ ...row, signed_url: await signPreview(db, row, serviceClient) })))).filter((row): row is LearnerMaterialRow => row !== null);
}
