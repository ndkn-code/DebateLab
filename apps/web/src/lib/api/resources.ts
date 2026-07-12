import "server-only";

import { randomUUID } from "node:crypto";

import { createTypedServerClient } from "@/lib/supabase/server";
import {
  toResourceItem,
  toResourceRow,
  type ResourceItem,
  type ResourceRow,
  type ResourceUpsertInput,
} from "@/lib/api/resources-model";

const RESOURCE_BUCKET = "resources";
const RESOURCE_SELECT = "id, title, description, kind, storage_path, url, mime_type, size_bytes, subject, tags, access_level, club_id, published, created_by, created_at, updated_at";
const MAX_RESOURCE_FILE_BYTES = 50 * 1024 * 1024;

type Supabase = Awaited<ReturnType<typeof createTypedServerClient>>;

export interface ResourceClubOption {
  id: string;
  name: string;
}

async function verifyAdmin(supabase: Supabase): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (error || profile?.role !== "admin") throw new Error("Forbidden");
  return user.id;
}

function safeFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .replace(/[\\/]/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 140);
  return cleaned || "resource-file";
}

async function withSignedFileUrl(supabase: Supabase, row: ResourceRow): Promise<ResourceItem> {
  if (row.kind !== "file" || !row.storage_path) return toResourceItem(row);
  const { data, error } = await supabase.storage
    .from(RESOURCE_BUCKET)
    .createSignedUrl(row.storage_path, 60 * 15);
  return toResourceItem(row, error ? null : data.signedUrl);
}

export async function listResources(): Promise<ResourceItem[]> {
  const supabase = await createTypedServerClient();
  await verifyAdmin(supabase);
  const { data, error } = await supabase
    .from("resources")
    .select(RESOURCE_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return Promise.all(((data ?? []) as ResourceRow[]).map((row) => withSignedFileUrl(supabase, row)));
}

export async function listResourceClubs(): Promise<ResourceClubOption[]> {
  const supabase = await createTypedServerClient();
  await verifyAdmin(supabase);
  const { data, error } = await supabase
    .from("clubs")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listVisibleResources(): Promise<ResourceItem[]> {
  const supabase = await createTypedServerClient();
  const { data, error } = await supabase
    .from("resources")
    .select(RESOURCE_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  // RLS filters unpublished and inaccessible club rows before any signed URL
  // is requested. Storage repeats that row visibility check.
  return Promise.all(((data ?? []) as ResourceRow[]).map((row) => withSignedFileUrl(supabase, row)));
}

export async function upsertResource(input: ResourceUpsertInput): Promise<ResourceItem> {
  const supabase = await createTypedServerClient();
  const adminId = await verifyAdmin(supabase);
  const row = toResourceRow(input);
  const resourceId = row.id ?? randomUUID();
  const { data: previous } = await supabase
    .from("resources")
    .select("storage_path, created_by")
    .eq("id", resourceId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("resources")
    .upsert({
      ...row,
      id: resourceId,
      created_by: previous?.created_by ?? adminId,
      updated_at: new Date().toISOString(),
    })
    .select(RESOURCE_SELECT)
    .single();
  if (error) {
    if (row.storage_path && row.storage_path !== previous?.storage_path) {
      await supabase.storage.from(RESOURCE_BUCKET).remove([row.storage_path]);
    }
    throw new Error(error.message);
  }

  if (previous?.storage_path && previous.storage_path !== row.storage_path) {
    const { error: removeError } = await supabase.storage.from(RESOURCE_BUCKET).remove([previous.storage_path]);
    if (removeError) throw new Error(`Resource saved, but the old file could not be removed: ${removeError.message}`);
  }
  return withSignedFileUrl(supabase, data as ResourceRow);
}

export async function deleteResource(resourceId: string): Promise<void> {
  const supabase = await createTypedServerClient();
  await verifyAdmin(supabase);
  const { data: resource, error: readError } = await supabase
    .from("resources")
    .select("storage_path")
    .eq("id", resourceId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!resource) return;

  if (resource.storage_path) {
    const { error: storageError } = await supabase.storage.from(RESOURCE_BUCKET).remove([resource.storage_path]);
    if (storageError) throw new Error(storageError.message);
  }
  const { error } = await supabase.from("resources").delete().eq("id", resourceId);
  if (error) throw new Error(error.message);
}

export async function uploadResourceFile(input: {
  resourceId: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
}) {
  const supabase = await createTypedServerClient();
  const adminId = await verifyAdmin(supabase);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.resourceId)) {
    throw new Error("Invalid resource ID.");
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 0 || input.sizeBytes > MAX_RESOURCE_FILE_BYTES) {
    throw new Error("Resource files must be 50MB or smaller.");
  }
  const storagePath = `${adminId}/${input.resourceId}/${randomUUID()}-${safeFileName(input.fileName)}`;
  const { data, error } = await supabase.storage.from(RESOURCE_BUCKET).createSignedUploadUrl(storagePath);
  if (error) throw new Error(error.message);
  return {
    storagePath,
    signedUrl: data.signedUrl,
    token: data.token,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  };
}
