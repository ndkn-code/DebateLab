import assert from "node:assert/strict";
import test from "node:test";

import {
  collectResourceTags,
  filterResources,
  normalizeResourceTags,
  ResourceUpsertSchema,
  toResourceItem,
  toResourceRow,
  type ResourceRow,
} from "./resources-model";

const baseRow: ResourceRow = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Speaking checklist",
  description: null,
  kind: "link",
  storage_path: null,
  url: "https://example.com/checklist",
  mime_type: null,
  size_bytes: null,
  subject: "ielts",
  tags: ["speaking", "checklist"],
  access_level: "authenticated",
  club_id: null,
  published: true,
  created_by: null,
  created_at: "2026-07-12T00:00:00.000Z",
  updated_at: "2026-07-12T00:00:00.000Z",
};

test("resource input enforces the kind payload and club scope", () => {
  assert.equal(ResourceUpsertSchema.safeParse({
    title: "Missing upload",
    kind: "file",
    subject: "ielts",
    accessLevel: "authenticated",
    published: false,
  }).success, false);
  assert.equal(ResourceUpsertSchema.safeParse({
    title: "Missing club",
    kind: "link",
    url: "https://example.com",
    subject: "debate",
    accessLevel: "club",
    published: true,
  }).success, false);
  assert.equal(ResourceUpsertSchema.safeParse({
    title: "Unsafe link",
    kind: "link",
    url: "javascript:alert(1)",
    subject: "debate",
    accessLevel: "public",
    published: true,
  }).success, false);
});

test("resource writes clear fields that do not belong to the selected kind or access", () => {
  assert.deepEqual(toResourceRow({
    title: "Research guide",
    kind: "link",
    url: "https://example.com/research",
    storagePath: "old/file.pdf",
    mimeType: "application/pdf",
    sizeBytes: 42,
    subject: "debate",
    tags: [" Evidence ", "evidence", "Case-Building"],
    accessLevel: "public",
    clubId: "22222222-2222-4222-8222-222222222222",
    published: true,
  }), {
    id: undefined,
    title: "Research guide",
    description: null,
    kind: "link",
    storage_path: null,
    url: "https://example.com/research",
    mime_type: null,
    size_bytes: null,
    subject: "debate",
    tags: ["evidence", "case-building"],
    access_level: "public",
    club_id: null,
    published: true,
  });
});

test("library filters and tag collection are deterministic", () => {
  const ielts = toResourceItem(baseRow);
  const debate = toResourceItem({ ...baseRow, id: "33333333-3333-4333-8333-333333333333", subject: "debate", tags: ["evidence"] });
  assert.deepEqual(filterResources([ielts, debate], { subject: "ielts", tag: " Speaking " }).map((item) => item.id), [ielts.id]);
  assert.deepEqual(collectResourceTags([ielts, debate]), ["checklist", "evidence", "speaking"]);
  assert.deepEqual(normalizeResourceTags(["  PDF ", "pdf", " "]), ["pdf"]);
});
