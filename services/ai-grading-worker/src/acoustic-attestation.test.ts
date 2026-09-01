import assert from "node:assert/strict";
import test from "node:test";

import { signAcousticAttestationForTrustedPreprocessor } from "./acoustic-attestation";

test("trusted acoustic signing is deterministic and content-bound", () => {
  const envelope = {
    envelopeVersion: 1,
    benchmarkKey: "speaking-001",
    captureId: "00000000-0000-4000-8000-000000000001",
    audioArtifactSha256: "a".repeat(64),
    transcriptSha256: "b".repeat(64),
    configSha256: "c".repeat(64),
    reportSha256: "d".repeat(64),
  };
  const signature = signAcousticAttestationForTrustedPreprocessor(
    envelope,
    "test-only-secret",
  );
  assert.match(signature, /^[a-f0-9]{64}$/);
  assert.equal(
    signature,
    signAcousticAttestationForTrustedPreprocessor(
      { ...envelope },
      "test-only-secret",
    ),
  );
  assert.notEqual(
    signature,
    signAcousticAttestationForTrustedPreprocessor(
      { ...envelope, reportSha256: "e".repeat(64) },
      "test-only-secret",
    ),
  );
  assert.throws(
    () => signAcousticAttestationForTrustedPreprocessor(envelope, " "),
    /secret is required/,
  );
});
