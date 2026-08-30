import assert from "node:assert/strict";
import {
  MATERIAL_AUDIO_MAX_BYTES,
  MATERIAL_DOCUMENT_MAX_BYTES,
  materialDocumentV1Schema,
  materialPlacementInputSchema,
  materialUploadInputSchema,
  rightsRequireOwnerApproval,
} from "./material-contracts";

const clubId = "00000000-0000-4000-8000-000000000001";
const materialId = "00000000-0000-4000-8000-000000000002";
const versionId = "00000000-0000-4000-8000-000000000003";
const classId = "00000000-0000-4000-8000-000000000004";
const assignmentId = "00000000-0000-4000-8000-000000000005";

assert.equal(
  materialUploadInputSchema.safeParse({
    clubId,
    fileName: "unit-1.pptx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    sizeBytes: MATERIAL_DOCUMENT_MAX_BYTES,
  }).success,
  true,
);
assert.equal(
  materialUploadInputSchema.safeParse({
    clubId,
    fileName: "listening.mp3",
    mimeType: "audio/mpeg",
    sizeBytes: MATERIAL_AUDIO_MAX_BYTES,
  }).success,
  true,
);
assert.equal(
  materialUploadInputSchema.safeParse({
    clubId,
    fileName: "too-large.pdf",
    mimeType: "application/pdf",
    sizeBytes: MATERIAL_DOCUMENT_MAX_BYTES + 1,
  }).success,
  false,
);

const placement = {
  materialId,
  versionId,
  targetType: "class",
  classId,
  status: "published",
  audienceUserIds: [],
  rules: [
    { kind: "assignment_submitted", assignmentId },
    { kind: "minimum_score", assignmentId, minimumScore: 70 },
  ],
};
assert.equal(materialPlacementInputSchema.safeParse(placement).success, true);
assert.equal(
  materialPlacementInputSchema.safeParse({
    ...placement,
    targetType: "course",
  }).success,
  false,
);
assert.equal(
  materialPlacementInputSchema.safeParse({
    ...placement,
    status: "scheduled",
  }).success,
  false,
);
assert.equal(
  materialPlacementInputSchema.safeParse({
    ...placement,
    releaseAt: "2026-09-02T12:00:00.000Z",
    expiresAt: "2026-09-01T12:00:00.000Z",
  }).success,
  false,
);

assert.equal(rightsRequireOwnerApproval("original"), false);
assert.equal(rightsRequireOwnerApproval("commercial_license"), true);
assert.equal(rightsRequireOwnerApproval("unknown"), true);

assert.equal(
  materialDocumentV1Schema.safeParse({
    schemaVersion: 1,
    title: "Friends abroad",
    sourceVersionId: versionId,
    language: "en",
    sections: [
      {
        id: "slide-1",
        title: "Unit 1",
        blocks: [
          { id: "heading-1", type: "heading", level: 1, text: "Friends abroad" },
          { id: "page-1", type: "page_preview", renditionId: materialId, pageNumber: 1, alt: "Unit title slide" },
        ],
      },
    ],
  }).success,
  true,
);

console.log("shared LMS material contracts tests passed");
