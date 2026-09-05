import assert from "node:assert/strict";
import test from "node:test";
import { assertQuestionImportUploadAccess } from "./access";

const batch = { club_id: "org-a", created_by: "teacher-a", status: "draft", copyright_attested: true, copyright_attestation_version: "v1" };
const input = { clubId: "org-a", actorId: "teacher-a", attestationVersion: "v1" };

test("upload authority binds actor, organisation, attestation and processing state", () => {
  for (const status of ["draft", "queued", "processing"]) assert.doesNotThrow(() => assertQuestionImportUploadAccess({ ...batch, status }, input));
  for (const changed of [null, { ...batch, club_id: "org-b" }, { ...batch, created_by: "teacher-b" },
    { ...batch, copyright_attested: false }, { ...batch, copyright_attestation_version: "stale" }]) {
    assert.throws(() => assertQuestionImportUploadAccess(changed, input), /permission/);
  }
  for (const status of ["submitted", "completed", "quarantined", "deleted", "failed", "review"]) {
    assert.throws(() => assertQuestionImportUploadAccess({ ...batch, status }, input), /permission/);
  }
});
