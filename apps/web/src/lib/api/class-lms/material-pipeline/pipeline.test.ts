import assert from "node:assert/strict";
import test from "node:test";
import {
  canClaimMaterialLease,
  createOpaqueStoragePath,
  materialIngestSchema,
} from "./contracts";
import {
  buildDraftMaterialDocument,
  isDraftMaterialDocument,
} from "./manifest";
import {
  createFakeSandboxAdapter,
  createVercelSandboxAdapter,
  SandboxConfigurationError,
} from "./sandbox";

const ids = {
  clubId: "00000000-0000-4000-8000-000000000001",
  classId: "00000000-0000-4000-8000-000000000002",
  materialId: "00000000-0000-4000-8000-000000000003",
  versionId: "00000000-0000-4000-8000-000000000004",
};

test("ingest schema enforces per-file limits and rejects unknown fields", () => {
  const parsed = materialIngestSchema.safeParse({
    clubId: ids.clubId,
    scopeClassId: ids.classId,
    title: "Unit 1",
    fileName: "unit.pdf",
    mimeType: "application/pdf",
    sizeBytes: 10,
    idempotencyKey: "teacher-unit-1",
  });
  assert.equal(parsed.success, true);
  assert.equal(
    materialIngestSchema.safeParse({
      ...(parsed.success ? parsed.data : {}),
      path: "secret/path",
    }).success,
    false,
  );
});

test("question imports require a bound batch and versioned attestation", () => {
  const questionImport = {
    clubId: ids.clubId,
    programType: "ielts" as const,
    title: "Reading import",
    fileName: "reading.pdf",
    mimeType: "application/pdf",
    sizeBytes: 10,
    idempotencyKey: "teacher-reading-import",
    purpose: "question_import" as const,
    questionImport: {
      batchId: ids.materialId,
      rightsAttestationVersion: "2026-09-04.v1",
      rightsAttested: true as const,
    },
  };
  assert.equal(materialIngestSchema.safeParse(questionImport).success, true);
  for (const invalid of [
    { ...questionImport, programType: "debate" },
    { ...questionImport, scopeClassId: ids.classId },
    { ...questionImport, mimeType: "text/plain" },
    { ...questionImport, questionImport: { ...questionImport.questionImport, rightsAttestationVersion: "unreviewed" } },
  ]) assert.equal(materialIngestSchema.safeParse(invalid).success, false);
  assert.equal(
    materialIngestSchema.safeParse({
      ...questionImport,
      questionImport: { ...questionImport.questionImport, batchId: undefined },
    }).success,
    false,
  );
  assert.equal(
    materialIngestSchema.safeParse({
      ...questionImport,
      purpose: "material",
    }).success,
    false,
  );
});

test("storage paths bind scope IDs without exposing the uploaded filename", () => {
  const path = createOpaqueStoragePath({
    ...ids,
    scopeClassId: ids.classId,
    actorId: "00000000-0000-4000-8000-000000000005",
    fileName: "private student answers.pdf",
  });
  assert.equal(
    path,
    `${ids.clubId}/${ids.materialId}/00000000-0000-4000-8000-000000000005/${ids.versionId}/${ids.versionId}.bin`,
  );
  assert.doesNotMatch(path, /private|student|answers/i);
});

test("lease claims are fail-closed for terminal and active work", () => {
  assert.equal(
    canClaimMaterialLease({ status: "ready", leaseExpiresAt: null }),
    false,
  );
  assert.equal(
    canClaimMaterialLease({
      status: "converting",
      leaseExpiresAt: "2099-01-01T00:00:00.000Z",
    }),
    false,
  );
  assert.equal(
    canClaimMaterialLease({
      status: "converting",
      leaseExpiresAt: "2020-01-01T00:00:00.000Z",
      now: new Date("2021-01-01"),
    }),
    true,
  );
  assert.equal(
    canClaimMaterialLease({ status: "queued", leaseExpiresAt: null }),
    true,
  );
});

test("draft manifest is schema-valid and never implies published semantic conversion", () => {
  const draft = buildDraftMaterialDocument({
    title: "Unit 1",
    versionId: ids.versionId,
    renditionId: ids.materialId,
    text: "Teacher review text",
  });
  assert.equal(isDraftMaterialDocument(draft), true);
  assert.equal(draft.sections[0]?.blocks[0]?.type, "page_preview");
});

test("fake Sandbox is deterministic for local tests", async () => {
  const result = await createFakeSandboxAdapter({ text: "fixture" }).convert({
    sourceUrl: "https://signed.invalid",
    mimeType: "text/plain",
    fileName: "fixture.txt",
    materialId: ids.materialId,
    versionId: ids.versionId,
  });
  assert.deepEqual(result, { text: "fixture" });
});

test("Sandbox adapter fails closed when production configuration is absent", async () => {
  const previousEndpoint = process.env.VERCEL_SANDBOX_API_URL;
  const previousToken = process.env.VERCEL_SANDBOX_TOKEN;
  delete process.env.VERCEL_SANDBOX_API_URL;
  delete process.env.VERCEL_SANDBOX_TOKEN;
  try {
    await assert.rejects(
      () =>
        createVercelSandboxAdapter().convert({
          sourceUrl: "https://signed.invalid",
          mimeType: "text/plain",
          fileName: "fixture.txt",
          materialId: ids.materialId,
          versionId: ids.versionId,
        }),
      SandboxConfigurationError,
    );
  } finally {
    if (previousEndpoint === undefined)
      delete process.env.VERCEL_SANDBOX_API_URL;
    else process.env.VERCEL_SANDBOX_API_URL = previousEndpoint;
    if (previousToken === undefined) delete process.env.VERCEL_SANDBOX_TOKEN;
    else process.env.VERCEL_SANDBOX_TOKEN = previousToken;
  }
});
