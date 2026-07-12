import { z } from "zod";

export const ResourceKindSchema = z.enum(["file", "link"]);
export const ResourceSubjectSchema = z.enum(["ielts", "debate"]);
export const ResourceAccessLevelSchema = z.enum(["public", "authenticated", "club"]);

export type ResourceKind = z.infer<typeof ResourceKindSchema>;
export type ResourceSubject = z.infer<typeof ResourceSubjectSchema>;
export type ResourceAccessLevel = z.infer<typeof ResourceAccessLevelSchema>;

export interface ResourceItem {
  id: string;
  title: string;
  description: string | null;
  kind: ResourceKind;
  storagePath: string | null;
  url: string | null;
  downloadUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  subject: ResourceSubject;
  tags: string[];
  accessLevel: ResourceAccessLevel;
  clubId: string | null;
  published: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ResourceRow = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  storage_path: string | null;
  url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  subject: string;
  tags: string[];
  access_level: string;
  club_id: string | null;
  published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const nullableUuid = z.string().uuid().nullable().optional();

export const ResourceUpsertSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().max(2_000).nullable().optional(),
    kind: ResourceKindSchema,
    storagePath: z.string().trim().min(1).max(1_000).nullable().optional(),
    url: z.string().trim().url().max(2_000).refine(
      (value) => /^https?:\/\//i.test(value),
      "Links must use http:// or https://.",
    ).nullable().optional(),
    mimeType: z.string().trim().max(255).nullable().optional(),
    sizeBytes: z.number().int().nonnegative().nullable().optional(),
    subject: ResourceSubjectSchema,
    tags: z.array(z.string()).max(20).optional(),
    accessLevel: ResourceAccessLevelSchema,
    clubId: nullableUuid,
    published: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.kind === "file" && !value.storagePath) {
      context.addIssue({ code: "custom", path: ["storagePath"], message: "A file upload is required." });
    }
    if (value.kind === "link" && !value.url) {
      context.addIssue({ code: "custom", path: ["url"], message: "A valid link is required." });
    }
    if (value.accessLevel === "club" && !value.clubId) {
      context.addIssue({ code: "custom", path: ["clubId"], message: "Choose a club." });
    }
  });

export type ResourceUpsertInput = z.input<typeof ResourceUpsertSchema>;

export function normalizeResourceTags(tags: readonly string[] | undefined): string[] {
  const normalized = (tags ?? [])
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .map((tag) => tag.slice(0, 40));
  return [...new Set(normalized)].slice(0, 20);
}

export function toResourceItem(row: ResourceRow, downloadUrl: string | null = null): ResourceItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: ResourceKindSchema.parse(row.kind),
    storagePath: row.storage_path,
    url: row.url,
    downloadUrl,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    subject: ResourceSubjectSchema.parse(row.subject),
    tags: normalizeResourceTags(row.tags),
    accessLevel: ResourceAccessLevelSchema.parse(row.access_level),
    clubId: row.club_id,
    published: row.published,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toResourceRow(input: ResourceUpsertInput) {
  const value = ResourceUpsertSchema.parse(input);
  return {
    id: value.id,
    title: value.title,
    description: value.description || null,
    kind: value.kind,
    storage_path: value.kind === "file" ? value.storagePath : null,
    url: value.kind === "link" ? value.url : null,
    mime_type: value.kind === "file" ? value.mimeType || null : null,
    size_bytes: value.kind === "file" ? value.sizeBytes ?? null : null,
    subject: value.subject,
    tags: normalizeResourceTags(value.tags),
    access_level: value.accessLevel,
    club_id: value.accessLevel === "club" ? value.clubId : null,
    published: value.published,
  };
}

export function filterResources(
  resources: readonly ResourceItem[],
  filters: { subject?: ResourceSubject | "all"; tag?: string | null },
): ResourceItem[] {
  const tag = filters.tag?.trim().toLowerCase();
  return resources.filter((resource) => {
    if (filters.subject && filters.subject !== "all" && resource.subject !== filters.subject) return false;
    if (tag && !resource.tags.includes(tag)) return false;
    return true;
  });
}

export function collectResourceTags(resources: readonly ResourceItem[]): string[] {
  return [...new Set(resources.flatMap((resource) => resource.tags))].sort((a, b) => a.localeCompare(b));
}
