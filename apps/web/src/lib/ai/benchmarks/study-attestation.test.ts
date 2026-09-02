import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  assertMode0600,
  atomicWriteFile,
  createStudyLeadAttestationRefresh,
  createStudyLeadKeyMaterial,
  publicKeyConfigFromPrivateKeyPem,
  refreshStudyLeadManifest,
  signStudyLeadManifest,
  verifyStudyLeadManifest,
  verifyStudyLeadAttestationRefresh,
  verifyStudyLeadBenchmarkAttestation,
  writeStudyLeadKeyPair,
} from "./study-attestation";

async function main() {
const templatePath = resolve(
  process.cwd(),
  "src/scripts/manifests/ielts-benchmark-study-manifest.template.json",
);
const template = JSON.parse(await readFile(templatePath, "utf8"));
const benchmark = template.benchmarks[0];
const identityReceipts = {
  receiptFileVersion: 1 as const,
  benchmarks: [
    {
      benchmarkKey: benchmark.benchmarkKey,
      groupingReceipts:
        benchmark.releaseAttestation.envelope.groupingReceipts,
      captureIdentityReceiptSha256:
        benchmark.releaseAttestation.envelope.captureIdentityReceiptSha256,
    },
  ],
};

const keyA = createStudyLeadKeyMaterial();
const keyB = createStudyLeadKeyMaterial();
assert.deepEqual(
  publicKeyConfigFromPrivateKeyPem(keyA.privateKeyPkcs8Pem),
  keyA.publicConfig,
);
assert.match(keyA.publicConfig.publicKeySpkiDerBase64, /^[A-Za-z0-9+/]+=*$/);
assert.equal(
  keyA.publicConfig.keyId,
  `study-lead-ed25519-${keyA.publicConfig.fingerprintSha256.slice(0, 24)}`,
);

const trustA = { trustSetVersion: 1 as const, keys: [keyA.publicConfig] };
const trustB = { trustSetVersion: 1 as const, keys: [keyB.publicConfig] };
const rotatingTrust = {
  trustSetVersion: 1 as const,
  keys: [keyA.publicConfig, keyB.publicConfig],
};

function signWithA() {
  return signStudyLeadManifest({
    manifest: structuredClone(template),
    identityReceipts,
    privateKeyPkcs8Pem: keyA.privateKeyPkcs8Pem,
    verifiedAt: "2026-09-01T10:30:00.000Z",
    expiresAt: "2026-09-02T09:59:00.000Z",
  });
}

const signedA = signWithA();
const signedAAgain = signWithA();
assert.equal(
  signedA.benchmarks[0]?.releaseAttestation.signatureBase64,
  signedAAgain.benchmarks[0]?.releaseAttestation.signatureBase64,
  "Ed25519 signing must be deterministic for the same canonical envelope",
);
assert.deepEqual(
  verifyStudyLeadManifest({
    manifest: signedA,
    trustSet: rotatingTrust,
    now: new Date("2026-09-01T12:00:00.000Z"),
  }),
  { benchmarkCount: 1, keyIds: [keyA.publicConfig.keyId] },
);

const swappedWithdrawalReceipt = structuredClone(signedA);
swappedWithdrawalReceipt.benchmarks[0].protectedLabel.consent.withdrawal.registryReceiptSha256 =
  "9".repeat(64);
assert.throws(
  () =>
    verifyStudyLeadManifest({
      manifest: swappedWithdrawalReceipt,
      trustSet: trustA,
      now: new Date("2026-09-01T12:00:00.000Z"),
    }),
  /does not bind the (current protected benchmark identity|benchmark artifact)/,
);

assert.throws(
  () =>
    verifyStudyLeadManifest({
      manifest: signedA,
      trustSet: trustA,
      now: new Date("2026-09-02T10:00:00.000Z"),
    }),
  /expired or not yet valid/,
);
assert.throws(
  () =>
    verifyStudyLeadManifest({
      manifest: signedA,
      trustSet: trustB,
      now: new Date("2026-09-01T12:00:00.000Z"),
    }),
  /signing key is not trusted/,
);

const withdrawalRefreshed = structuredClone(signedA);
withdrawalRefreshed.benchmarks[0].protectedLabel.consent.withdrawal = {
  status: "not_withdrawn",
  checkedAt: "2026-09-02T08:30:00.000Z",
  registryReceiptSha256: "8".repeat(64),
};
const refreshed = refreshStudyLeadManifest({
  manifest: withdrawalRefreshed,
  previousTrustSet: trustA,
  privateKeyPkcs8Pem: keyB.privateKeyPkcs8Pem,
  verifiedAt: "2026-09-02T09:00:00.000Z",
  expiresAt: "2026-09-02T09:30:00.000Z",
});
assert.equal(refreshed.createdAt, "2026-09-02T09:00:00.000Z");
assert.equal(
  refreshed.benchmarks[0]?.releaseAttestation.envelope
    .withdrawalRegistryReceiptSha256,
  "8".repeat(64),
);
assert.equal(
  refreshed.benchmarks[0]?.releaseAttestation.keyId,
  keyB.publicConfig.keyId,
);
assert.deepEqual(
  verifyStudyLeadManifest({
    manifest: refreshed,
    trustSet: rotatingTrust,
    now: new Date("2026-09-02T09:15:00.000Z"),
  }),
  { benchmarkCount: 1, keyIds: [keyB.publicConfig.keyId] },
);

const protectedLabelBeforeDetachedRefresh = JSON.stringify(
  signedA.benchmarks[0]?.protectedLabel,
);
const detachedRefresh = createStudyLeadAttestationRefresh({
  manifest: signedA,
  previousTrustSet: trustA,
  withdrawalSnapshots: {
    snapshotFileVersion: 1,
    benchmarks: [
      {
        benchmarkKey: benchmark.benchmarkKey,
        registryReceiptSha256: "7".repeat(64),
        checkedAt: "2026-09-02T08:30:00.000Z",
      },
    ],
  },
  privateKeyPkcs8Pem: keyB.privateKeyPkcs8Pem,
  verifiedAt: "2026-09-02T09:00:00.000Z",
  expiresAt: "2026-09-02T09:30:00.000Z",
});
assert.equal(
  JSON.stringify(signedA.benchmarks[0]?.protectedLabel),
  protectedLabelBeforeDetachedRefresh,
  "Detached refresh must not mutate the immutable benchmark label",
);
assert.equal(
  detachedRefresh.attestations[0]?.releaseAttestation.envelope
    .withdrawalRegistryReceiptSha256,
  "7".repeat(64),
);
assert.deepEqual(
  verifyStudyLeadAttestationRefresh({
    refreshFile: detachedRefresh,
    trustSet: rotatingTrust,
    now: new Date("2026-09-02T09:15:00.000Z"),
  }),
  detachedRefresh,
);
assert.throws(
  () =>
    verifyStudyLeadAttestationRefresh({
      refreshFile: detachedRefresh,
      trustSet: trustA,
      now: new Date("2026-09-02T09:15:00.000Z"),
    }),
  /signing key is not trusted/,
);
assert.deepEqual(
  verifyStudyLeadBenchmarkAttestation({
    benchmark: {
      ...signedA.benchmarks[0],
      releaseAttestation:
        detachedRefresh.attestations[0]?.releaseAttestation,
    },
    trustSet: rotatingTrust,
    now: new Date("2026-09-02T09:15:00.000Z"),
    allowUpdatedWithdrawal: true,
  }),
  { keyId: keyB.publicConfig.keyId },
);
const tamperedDetachedRefresh = structuredClone(detachedRefresh);
tamperedDetachedRefresh.attestations[0].releaseAttestation.envelope.withdrawalRegistryReceiptSha256 =
  "6".repeat(64);
assert.throws(
  () =>
    verifyStudyLeadAttestationRefresh({
      refreshFile: tamperedDetachedRefresh,
      trustSet: rotatingTrust,
      now: new Date("2026-09-02T09:15:00.000Z"),
    }),
  /signature is invalid/,
);
assert.throws(
  () =>
    createStudyLeadAttestationRefresh({
      manifest: signedA,
      previousTrustSet: trustA,
      withdrawalSnapshots: {
        snapshotFileVersion: 1,
        benchmarks: [
          {
            benchmarkKey: benchmark.benchmarkKey,
            registryReceiptSha256: "5".repeat(64),
            checkedAt: "2026-09-01T09:00:00.000Z",
          },
        ],
      },
      privateKeyPkcs8Pem: keyB.privateKeyPkcs8Pem,
      verifiedAt: "2026-09-02T09:00:00.000Z",
      expiresAt: "2026-09-02T09:30:00.000Z",
    }),
  /cannot move backwards/,
);
assert.throws(
  () =>
    createStudyLeadAttestationRefresh({
      manifest: signedA,
      previousTrustSet: trustA,
      withdrawalSnapshots: {
        snapshotFileVersion: 1,
        benchmarks: [
          {
            benchmarkKey: benchmark.benchmarkKey,
            registryReceiptSha256: "5".repeat(64),
            checkedAt: "2026-09-01T10:20:00.000Z",
          },
        ],
      },
      privateKeyPkcs8Pem: keyB.privateKeyPkcs8Pem,
      verifiedAt: "2026-09-01T10:30:00.000Z",
      expiresAt: "2026-09-01T11:00:00.000Z",
    }),
  /verification time must move forward/,
);

const work = await mkdtemp(join(tmpdir(), "debatelab-study-attestation-"));
const protectedPath = join(work, "signed-manifest.json");
await atomicWriteFile({
  path: protectedPath,
  contents: `${JSON.stringify(refreshed)}\n`,
  mode: 0o600,
});
assert.equal((await stat(protectedPath)).mode & 0o777, 0o600);
await chmod(protectedPath, 0o644);
await assert.rejects(
  () => assertMode0600(protectedPath, "Protected test manifest"),
  /file mode 0600/,
);

const privateKeyPath = join(work, "study-lead-private.pem");
const publicConfigPath = join(work, "study-lead-public.json");
const writtenConfig = await writeStudyLeadKeyPair({
  privateKeyPath,
  publicConfigPath,
});
assert.equal((await stat(privateKeyPath)).mode & 0o777, 0o600);
assert.equal((await stat(publicConfigPath)).mode & 0o777, 0o644);
assert.deepEqual(
  JSON.parse(await readFile(publicConfigPath, "utf8")),
  writtenConfig,
);

const cliSource = await readFile(
  resolve(process.cwd(), "src/scripts/ai-grading-benchmark-attestation.ts"),
  "utf8",
);
assert.doesNotMatch(cliSource, /JSON\.stringify\((manifest|signed|refreshed)\)/);
assert.match(cliSource, /Protected attestation input failed validation/);
assert.match(cliSource, /withdrawal-snapshots/);

const refreshScript = await readFile(
  resolve(
    process.cwd(),
    "src/scripts/ai-grading-benchmark-attestations-refresh.ts",
  ),
  "utf8",
);
assert.ok(
  refreshScript.indexOf("verifyStudyLeadAttestationRefresh({") <
    refreshScript.indexOf("const client = createAdminClient()"),
  "Detached signatures must be verified before privileged database access",
);
assert.match(
  refreshScript,
  /refresh_ai_grading_benchmark_release_attestations/,
);
assert.match(
  refreshScript,
  /from\("ai_grading_benchmarks"\)\s*\.select\("id,benchmark_key,protected_label,metadata"\)/,
);
assert.doesNotMatch(
  refreshScript,
  /from\("ai_grading_benchmarks"\)\s*\.upsert/,
);
assert.doesNotMatch(refreshScript, /\.upsert\(/);
assert.doesNotMatch(refreshScript, /protected_label\s*:/);

const withdrawalMigration = await readFile(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260901200000_external_benchmark_withdrawal_verification.sql",
  ),
  "utf8",
);
assert.match(
  withdrawalMigration,
  /revoke update on public\.ai_grading_benchmark_release_attestations\s+from service_role/,
);

const benchmarkImporter = await readFile(
  resolve(process.cwd(), "src/scripts/ai-grading-benchmarks-import.ts"),
  "utf8",
);
assert.doesNotMatch(
  benchmarkImporter,
  /ai_grading_benchmark_release_attestations"\)\s*\.upsert/,
);
assert.match(
  benchmarkImporter,
  /use the signed attestation refresh command/,
);

const releaseGateSource = await readFile(
  resolve(process.cwd(), "src/scripts/ai-grading-release-gate.ts"),
  "utf8",
);
assert.match(
  releaseGateSource,
  /verifyStudyLeadBenchmarkAttestation\(\{[\s\S]*?allowUpdatedWithdrawal: true/,
  "The release gate must accept a separately signed fresh withdrawal snapshot",
);

console.log("IELTS benchmark study-lead attestation tests passed");
}

void main();
