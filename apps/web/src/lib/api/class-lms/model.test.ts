import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  announcementInputSchema,
  canPublishLicensedContent,
  contentAssignmentSchema,
  createOutboxDedupeKey,
  resourceInputSchema,
  resourceUploadInputSchema,
  LMS_RESOURCE_BUCKET,
  LMS_RESOURCE_MAX_SIZE_BYTES,
  vocabularySetInputSchema,
} from "./model";

const uuid = "00000000-0000-4000-8000-000000000001";
const classId = "00000000-0000-4000-8000-000000000002";

assert.equal(announcementInputSchema.safeParse({ classId, title: "Week 1", body: "Read the task brief before class.", status: "draft" }).success, true);
assert.equal(announcementInputSchema.safeParse({ classId, title: "", body: "x" }).success, false);

const publishedLink = resourceInputSchema.safeParse({ clubId: uuid, title: "Guide", kind: "link", url: "https://example.com/guide", provenance: "Original teacher material", licenseStatus: "approved", status: "published" });
assert.equal(publishedLink.success, true);
assert.equal(resourceInputSchema.safeParse({ clubId: uuid, title: "Unlicensed", kind: "link", url: "https://example.com", status: "published" }).success, false);
assert.equal(resourceInputSchema.safeParse({ clubId: uuid, title: "Both", kind: "link", url: "https://example.com", storagePath: "x" }).success, false);
assert.equal(resourceInputSchema.safeParse({ clubId: uuid, title: "File", kind: "file", storagePath: `${uuid}/org/${uuid}/${classId}/notes.pdf`, mimeType: "application/pdf", sizeBytes: 12 }).success, true);
assert.equal(resourceInputSchema.safeParse({ clubId: uuid, title: "Incomplete file", kind: "file", storagePath: "x" }).success, false);
assert.equal(resourceUploadInputSchema.safeParse({ clubId: uuid, fileName: "notes.pdf", mimeType: "application/pdf", sizeBytes: 100 }).success, true);
assert.equal(resourceUploadInputSchema.safeParse({ clubId: uuid, fileName: "notes.pdf", mimeType: "application/pdf", sizeBytes: LMS_RESOURCE_MAX_SIZE_BYTES + 1 }).success, false);
assert.equal(LMS_RESOURCE_BUCKET, "lms-resources");
assert.equal(vocabularySetInputSchema.safeParse({ clubId: uuid, title: "Words", status: "published", provenance: "Original", licenseStatus: "approved" }).success, true);
assert.equal(vocabularySetInputSchema.safeParse({ clubId: uuid, title: "Words", status: "published", provenance: "Copied", licenseStatus: "pending" }).success, false);

assert.equal(contentAssignmentSchema.safeParse({ classId }).success, true);
assert.equal(contentAssignmentSchema.safeParse({}).success, false);
assert.equal(contentAssignmentSchema.safeParse({ classId, courseId: uuid }).success, false);
assert.equal(canPublishLicensedContent({ status: "draft", licenseStatus: "pending" }), true);
assert.equal(canPublishLicensedContent({ status: "published", licenseStatus: "pending", provenance: "x" }), false);
assert.equal(createOutboxDedupeKey("returned", uuid, 1), `returned:${uuid}:1`);

const migrationRoot = process.cwd().endsWith(join("apps", "web")) ? join("..", "..") : ".";
const migration = readFileSync(join(process.cwd(), migrationRoot, "supabase/migrations/20260829040000_ielts_lms_content_comms.sql"), "utf8");
assert.match(migration, /create table if not exists public\.lms_outbox_events/);
assert.match(migration, /on conflict \(dedupe_key\) do nothing/);
assert.match(migration, /license_status = 'approved'/);
assert.match(migration, /private\.can_view_lms_class/);
assert.match(migration, /lms_pilot_enabled/);
assert.match(migration, /lms_pilot_flags_org_feature_uidx/);
assert.match(migration, /lms_resource_assignments_course_uidx/);
assert.match(migration, /insert into storage\.buckets/);
assert.match(migration, /lms-resources/);
assert.match(migration, /validate_lms_resource_file_integrity/);
assert.match(migration, /LMS_RESOURCE_FILE_OWNER_MISMATCH/);
assert.match(migration, /LMS_RESOURCE_FILE_SIZE_MISMATCH/);
assert.match(migration, /LMS_RESOURCE_FILE_MIME_MISMATCH/);
assert.match(migration, /LMS resource files insert/);
assert.match(migration, /can_manage_lms_resource_storage/);
assert.match(migration, /new\.assignment_type = 'ielts_mock' and new\.ielts_test_id is not null/);
assert.match(migration, /a\.assignment_type = 'ielts_mock' and a\.ielts_test_id is not null/);
assert.match(migration, /LMS_RESOURCE_FILE_IDENTITY_IMMUTABLE/);
assert.match(migration, /new\.storage_path is distinct from old\.storage_path/);
assert.match(migration, /exists \(\s*select 1 from public\.lms_resource_assignments/);
assert.match(migration, /not exists \(\s*select 1 from public\.lms_resources r\s*where r\.kind = 'file' and r\.storage_path = name\s*\)/);
assert.match(migration, /LMS_RESOURCE_SCOPE_CLASS_REQUIRED/);
assert.match(migration, /LMS_VOCAB_COURSE_REQUIRES_IELTS_CLASS_ASSIGNMENT/);
assert.match(migration, /check \(\(class_id is null\) <> \(course_id is null\)\)/);
assert.match(migration, /revoke all on function public\.claim_lms_outbox_events/);
assert.match(migration, /lms_manager_recipients/);
assert.match(migration, /attempt-result-published:/);
assert.doesNotMatch(migration, /create or replace function private\.can_view_class/);
assert.doesNotMatch(migration, /private\.can_view_class\(/);
assert.doesNotMatch(migration, /insert into .*seed|cambridge|ielts\.org/i);

console.log("class LMS model tests passed");
