import assert from "node:assert/strict";
import test from "node:test";
import { questionImportPrepareSchema, rateLimitPolicy, validateQuestionImportLimits, canPublishQuestion, RIGHTS_ATTESTATION_VERSION } from "./contracts";

const base = { clubId: "00000000-0000-4000-8000-000000000001", title: "Reading bank", documents: [{ fileName: "source.pdf", mimeType: "application/pdf" as const, sizeBytes: 100, storagePath: "club/source.pdf", sha256: "a".repeat(64) }], rightsAttestation: { version: RIGHTS_ATTESTATION_VERSION, accepted: true as const, locale: "en" as const }, idempotencyKey: "import-key-1" };

test("requires the versioned rights attestation and limits documents", () => {
  assert.equal(questionImportPrepareSchema.safeParse(base).success, true);
  assert.equal(questionImportPrepareSchema.safeParse({ ...base, documents: [...base.documents, ...base.documents, ...base.documents, ...base.documents, ...base.documents, ...base.documents] }).success, false);
});
test("requires inspected pages before provider work", () => {
  assert.equal(validateQuestionImportLimits(questionImportPrepareSchema.parse(base), [4]).pages, 4);
  assert.throws(() => validateQuestionImportLimits(questionImportPrepareSchema.parse(base), [101]), /100 pages/);
});
test("keeps AI answers gated", () => {
  assert.equal(canPublishQuestion({ validationIssues: [], answerSource: "ai_suggested", confirmedByTeacher: false, hasRequiredMedia: true }), false);
  assert.equal(canPublishQuestion({ validationIssues: [], answerSource: "ai_suggested", confirmedByTeacher: true, hasRequiredMedia: true }), true);
});
test("exposes monetization rate-limit policy", () => {
  assert.deepEqual(rateLimitPolicy("prepare"), { scope: "lms-question-import:prepare", limit: 10, windowSeconds: 600 });
  assert.equal(rateLimitPolicy("retry").windowSeconds, 86400);
});
