import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as signPayload,
  verify as verifyPayload,
  type KeyObject,
} from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  rm,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";

import { z } from "zod";

import {
  benchmarkReleaseAttestationPayload,
  benchmarkReleaseAttestationSchema,
  gradingBenchmarkImportFileSchema,
  parseGradingBenchmarkImport,
  type GradingBenchmarkImportFile,
} from "./contracts";

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const STUDY_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,198}[a-z0-9])?$/;

const sha256Schema = z.string().regex(SHA256_PATTERN);
const studyKeySchema = z.string().min(1).max(200).regex(STUDY_KEY_PATTERN);

export const studyLeadPublicKeyConfigSchema = z
  .object({
    configVersion: z.literal(1),
    algorithm: z.literal("Ed25519"),
    keyId: studyKeySchema,
    fingerprintSha256: sha256Schema,
    publicKeySpkiDerBase64: z
      .string()
      .min(40)
      .max(500)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();

export type StudyLeadPublicKeyConfig = z.infer<
  typeof studyLeadPublicKeyConfigSchema
>;

export const studyLeadTrustSetSchema = z
  .object({
    trustSetVersion: z.literal(1),
    keys: z.array(studyLeadPublicKeyConfigSchema).min(1).max(20),
  })
  .strict()
  .superRefine((trustSet, context) => {
    const keyIds = new Set<string>();
    const fingerprints = new Set<string>();
    trustSet.keys.forEach((key, index) => {
      if (keyIds.has(key.keyId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["keys", index, "keyId"],
          message: "Duplicate study-lead key ID",
        });
      }
      if (fingerprints.has(key.fingerprintSha256.toLowerCase())) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["keys", index, "fingerprintSha256"],
          message: "Duplicate study-lead key fingerprint",
        });
      }
      keyIds.add(key.keyId);
      fingerprints.add(key.fingerprintSha256.toLowerCase());
    });
  });

export type StudyLeadTrustSet = z.infer<typeof studyLeadTrustSetSchema>;

const groupingReceiptSchema = z
  .object({
    candidateReceiptSha256: sha256Schema,
    promptFamilyReceiptSha256: sha256Schema,
    sourceGroupReceiptSha256: sha256Schema,
    captureSessionReceiptSha256: sha256Schema,
  })
  .strict();

export const studyLeadIdentityReceiptFileSchema = z
  .object({
    receiptFileVersion: z.literal(1),
    benchmarks: z
      .array(
        z
          .object({
            benchmarkKey: z.string().min(1).max(300),
            groupingReceipts: groupingReceiptSchema,
            captureIdentityReceiptSha256: sha256Schema,
          })
          .strict(),
      )
      .min(1)
      .max(100_000),
  })
  .strict()
  .superRefine((file, context) => {
    const keys = new Set<string>();
    file.benchmarks.forEach((benchmark, index) => {
      if (keys.has(benchmark.benchmarkKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["benchmarks", index, "benchmarkKey"],
          message: "Duplicate identity receipt benchmark key",
        });
      }
      keys.add(benchmark.benchmarkKey);
    });
  });

export type StudyLeadIdentityReceiptFile = z.infer<
  typeof studyLeadIdentityReceiptFileSchema
>;

export const studyLeadWithdrawalSnapshotFileSchema = z
  .object({
    snapshotFileVersion: z.literal(1),
    benchmarks: z
      .array(
        z
          .object({
            benchmarkKey: z.string().min(1).max(300),
            registryReceiptSha256: sha256Schema,
            checkedAt: z.string().datetime({ offset: true }),
          })
          .strict(),
      )
      .min(1)
      .max(100_000),
  })
  .strict()
  .superRefine((file, context) => {
    const keys = new Set<string>();
    file.benchmarks.forEach((benchmark, index) => {
      if (keys.has(benchmark.benchmarkKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["benchmarks", index, "benchmarkKey"],
          message: "Duplicate withdrawal snapshot benchmark key",
        });
      }
      keys.add(benchmark.benchmarkKey);
    });
  });

export const studyLeadAttestationRefreshFileSchema = z
  .object({
    refreshFileVersion: z.literal(1),
    createdAt: z.string().datetime({ offset: true }),
    attestations: z
      .array(
        z
          .object({
            benchmarkKey: z.string().min(1).max(300),
            releaseAttestation: benchmarkReleaseAttestationSchema,
          })
          .strict(),
      )
      .min(1)
      .max(100_000),
  })
  .strict()
  .superRefine((file, context) => {
    const keys = new Set<string>();
    file.attestations.forEach((item, index) => {
      if (keys.has(item.benchmarkKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["attestations", index, "benchmarkKey"],
          message: "Duplicate attestation refresh benchmark key",
        });
      }
      if (item.releaseAttestation.envelope.verifiedAt !== file.createdAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["attestations", index, "releaseAttestation", "envelope", "verifiedAt"],
          message: "Attestation refresh verification time must match file creation time",
        });
      }
      keys.add(item.benchmarkKey);
    });
  });

export type StudyLeadAttestationRefreshFile = z.infer<
  typeof studyLeadAttestationRefreshFileSchema
>;

const unsignedBenchmarkSchema = z
  .object({
    benchmarkKey: z.string().min(1).max(300),
    protectedLabel: z.object({
      input: z.object({ artifactSha256: sha256Schema }).passthrough(),
      consent: z
        .object({
          receiptSha256: sha256Schema,
          retentionUntil: z.string().datetime({ offset: true }),
          withdrawal: z
            .object({
              registryReceiptSha256: sha256Schema,
              checkedAt: z.string().datetime({ offset: true }),
            })
            .passthrough(),
        })
        .passthrough(),
      provenance: z
        .object({
          raterRecords: z
          .array(
            z
              .object({
                credential: z.object({ proofSha256: sha256Schema }).passthrough(),
              })
              .passthrough(),
          )
          .min(2),
        })
        .passthrough(),
    }).passthrough(),
    metadata: z
      .object({
        candidateKey: studyKeySchema,
        promptFamilyKey: studyKeySchema,
        sourceGroupKey: studyKeySchema,
        captureSessionKey: studyKeySchema,
      })
      .passthrough(),
    releaseAttestation: benchmarkReleaseAttestationSchema.optional(),
  })
  .passthrough();

const unsignedManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    studyDesign: z.unknown(),
    createdAt: z.string().datetime({ offset: true }),
    sources: z.array(z.unknown()),
    benchmarks: z.array(unsignedBenchmarkSchema).min(1).max(100_000),
  })
  .passthrough();

type UnsignedManifest = z.infer<typeof unsignedManifestSchema>;
type UnsignedBenchmark = z.infer<typeof unsignedBenchmarkSchema>;

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function publicConfigFromKey(publicKey: KeyObject): StudyLeadPublicKeyConfig {
  if (publicKey.asymmetricKeyType !== "ed25519") {
    throw new Error("Study-lead key must be Ed25519");
  }
  const spkiDer = publicKey.export({ format: "der", type: "spki" });
  if (!Buffer.isBuffer(spkiDer)) {
    throw new Error("Unable to export Ed25519 public key");
  }
  const fingerprintSha256 = sha256(spkiDer);
  return {
    configVersion: 1,
    algorithm: "Ed25519",
    keyId: `study-lead-ed25519-${fingerprintSha256.slice(0, 24)}`,
    fingerprintSha256,
    publicKeySpkiDerBase64: spkiDer.toString("base64"),
  };
}

function parsePublicKeyConfig(value: unknown): {
  config: StudyLeadPublicKeyConfig;
  publicKey: KeyObject;
} {
  const config = studyLeadPublicKeyConfigSchema.parse(value);
  const spkiDer = Buffer.from(config.publicKeySpkiDerBase64, "base64");
  if (spkiDer.toString("base64") !== config.publicKeySpkiDerBase64) {
    throw new Error("Study-lead public key is not canonical base64");
  }
  const publicKey = createPublicKey({ key: spkiDer, format: "der", type: "spki" });
  const derived = publicConfigFromKey(publicKey);
  if (
    config.keyId !== derived.keyId ||
    config.fingerprintSha256.toLowerCase() !== derived.fingerprintSha256
  ) {
    throw new Error("Study-lead public key identity does not match its SPKI bytes");
  }
  return { config, publicKey };
}

export function createStudyLeadKeyMaterial(): {
  privateKeyPkcs8Pem: string;
  publicConfig: StudyLeadPublicKeyConfig;
} {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKeyPkcs8Pem: privateKey.export({
      format: "pem",
      type: "pkcs8",
    }) as string,
    publicConfig: publicConfigFromKey(publicKey),
  };
}

function privateKeyFromPem(privateKeyPkcs8Pem: string): {
  privateKey: KeyObject;
  publicConfig: StudyLeadPublicKeyConfig;
} {
  const privateKey = createPrivateKey(privateKeyPkcs8Pem);
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("Study-lead private key must be Ed25519 PKCS#8");
  }
  return {
    privateKey,
    publicConfig: publicConfigFromKey(createPublicKey(privateKey)),
  };
}

function attestationBindings(benchmark: UnsignedBenchmark) {
  return {
    benchmarkKey: benchmark.benchmarkKey,
    artifactSha256: benchmark.protectedLabel.input.artifactSha256.toLowerCase(),
    consentReceiptSha256:
      benchmark.protectedLabel.consent.receiptSha256.toLowerCase(),
    consentRetentionUntil: benchmark.protectedLabel.consent.retentionUntil,
    withdrawalRegistryReceiptSha256:
      benchmark.protectedLabel.consent.withdrawal.registryReceiptSha256.toLowerCase(),
    withdrawalCheckedAt: benchmark.protectedLabel.consent.withdrawal.checkedAt,
    grouping: {
      candidateKey: benchmark.metadata.candidateKey,
      promptFamilyKey: benchmark.metadata.promptFamilyKey,
      sourceGroupKey: benchmark.metadata.sourceGroupKey,
      captureSessionKey: benchmark.metadata.captureSessionKey,
    },
    examinerCredentialProofsSha256:
      benchmark.protectedLabel.provenance.raterRecords
        .map((rater) => rater.credential.proofSha256.toLowerCase())
        .sort(),
  };
}

function assertEnvelopeMatchesBenchmark(
  benchmark: UnsignedBenchmark,
  options: { allowUpdatedWithdrawal?: boolean } = {},
): void {
  const attestation = benchmark.releaseAttestation;
  if (!attestation) throw new Error("Study manifest is missing a release attestation");
  const expected = attestationBindings(benchmark);
  const envelope = attestation.envelope;
  const credentials = [...envelope.examinerCredentialProofsSha256]
    .map((proof) => proof.toLowerCase())
    .sort();
  const mismatch =
    envelope.benchmarkKey !== expected.benchmarkKey ||
    envelope.artifactSha256.toLowerCase() !== expected.artifactSha256 ||
    envelope.consentReceiptSha256.toLowerCase() !== expected.consentReceiptSha256 ||
    envelope.consentRetentionUntil !== expected.consentRetentionUntil ||
    envelope.grouping.candidateKey !== expected.grouping.candidateKey ||
    envelope.grouping.promptFamilyKey !== expected.grouping.promptFamilyKey ||
    envelope.grouping.sourceGroupKey !== expected.grouping.sourceGroupKey ||
    envelope.grouping.captureSessionKey !== expected.grouping.captureSessionKey ||
    credentials.join("|") !== expected.examinerCredentialProofsSha256.join("|") ||
    (!options.allowUpdatedWithdrawal &&
      (envelope.withdrawalRegistryReceiptSha256.toLowerCase() !==
        expected.withdrawalRegistryReceiptSha256 ||
        envelope.withdrawalCheckedAt !== expected.withdrawalCheckedAt));
  if (mismatch) {
    throw new Error(
      "Study-lead attestation does not bind the current protected benchmark identity",
    );
  }
}

function validateAttestationTime(
  attestation: z.infer<typeof benchmarkReleaseAttestationSchema>,
  now: Date,
): void {
  const nowMs = now.getTime();
  if (
    !Number.isFinite(nowMs) ||
    nowMs < new Date(attestation.envelope.verifiedAt).getTime() ||
    nowMs >= new Date(attestation.envelope.expiresAt).getTime() ||
    nowMs >= new Date(attestation.envelope.consentRetentionUntil).getTime()
  ) {
    throw new Error("Study-lead attestation is expired or not yet valid");
  }
}

function verifyOneAttestation(params: {
  benchmark: UnsignedBenchmark;
  trustedKeys: Map<string, KeyObject>;
  now?: Date;
  allowUpdatedWithdrawal?: boolean;
}): void {
  const attestation = benchmarkReleaseAttestationSchema.parse(
    params.benchmark.releaseAttestation,
  );
  assertEnvelopeMatchesBenchmark(params.benchmark, {
    allowUpdatedWithdrawal: params.allowUpdatedWithdrawal,
  });
  const publicKey = params.trustedKeys.get(attestation.keyId);
  if (!publicKey) throw new Error("Study-lead signing key is not trusted");
  const verified = verifyPayload(
    null,
    benchmarkReleaseAttestationPayload(attestation.envelope),
    publicKey,
    Buffer.from(attestation.signatureBase64, "base64"),
  );
  if (!verified) throw new Error("Study-lead attestation signature is invalid");
  if (params.now) validateAttestationTime(attestation, params.now);
}

function trustedKeyMap(value: unknown): Map<string, KeyObject> {
  const trustSet = studyLeadTrustSetSchema.parse(value);
  return new Map(
    trustSet.keys.map((config) => {
      const parsed = parsePublicKeyConfig(config);
      return [parsed.config.keyId, parsed.publicKey] as const;
    }),
  );
}

export function verifyStudyLeadBenchmarkAttestation(params: {
  benchmark: unknown;
  trustSet: unknown;
  now: Date;
  allowUpdatedWithdrawal?: boolean;
}): { keyId: string } {
  const benchmark = unsignedBenchmarkSchema.parse(params.benchmark);
  verifyOneAttestation({
    benchmark,
    trustedKeys: trustedKeyMap(params.trustSet),
    now: params.now,
    allowUpdatedWithdrawal: params.allowUpdatedWithdrawal,
  });
  return { keyId: benchmark.releaseAttestation!.keyId };
}

export function createStudyLeadAttestationRefresh(params: {
  manifest: unknown;
  previousTrustSet: unknown;
  withdrawalSnapshots: unknown;
  privateKeyPkcs8Pem: string;
  verifiedAt: string;
  expiresAt: string;
}): StudyLeadAttestationRefreshFile {
  const manifest = unsignedManifestSchema.parse(params.manifest);
  const previousKeys = trustedKeyMap(params.previousTrustSet);
  for (const benchmark of manifest.benchmarks) {
    verifyOneAttestation({ benchmark, trustedKeys: previousKeys });
  }
  const snapshots = studyLeadWithdrawalSnapshotFileSchema.parse(
    params.withdrawalSnapshots,
  );
  const snapshotByKey = new Map(
    snapshots.benchmarks.map((snapshot) => [snapshot.benchmarkKey, snapshot]),
  );
  if (
    snapshotByKey.size !== manifest.benchmarks.length ||
    manifest.benchmarks.some(
      (benchmark) => !snapshotByKey.has(benchmark.benchmarkKey),
    )
  ) {
    throw new Error(
      "Withdrawal snapshot file must match the benchmark manifest exactly",
    );
  }
  const { privateKey, publicConfig } = privateKeyFromPem(
    params.privateKeyPkcs8Pem,
  );
  return studyLeadAttestationRefreshFileSchema.parse({
    refreshFileVersion: 1,
    createdAt: params.verifiedAt,
    attestations: manifest.benchmarks.map((benchmark) => {
      const previous = benchmark.releaseAttestation!.envelope;
      const snapshot = snapshotByKey.get(benchmark.benchmarkKey)!;
      if (
        new Date(params.verifiedAt).getTime() <=
        new Date(previous.verifiedAt).getTime()
      ) {
        throw new Error(
          "Attestation refresh verification time must move forward",
        );
      }
      if (
        new Date(snapshot.checkedAt).getTime() <
        new Date(previous.withdrawalCheckedAt).getTime()
      ) {
        throw new Error("Withdrawal snapshot cannot move backwards in time");
      }
      const envelope = benchmarkReleaseAttestationSchema.shape.envelope.parse({
        ...previous,
        withdrawalRegistryReceiptSha256:
          snapshot.registryReceiptSha256.toLowerCase(),
        withdrawalCheckedAt: snapshot.checkedAt,
        verifiedAt: params.verifiedAt,
        expiresAt: params.expiresAt,
      });
      return {
        benchmarkKey: benchmark.benchmarkKey,
        releaseAttestation: {
          keyId: publicConfig.keyId,
          envelope,
          signatureBase64: signPayload(
            null,
            benchmarkReleaseAttestationPayload(envelope),
            privateKey,
          ).toString("base64"),
        },
      };
    }),
  });
}

export function verifyStudyLeadAttestationRefresh(params: {
  refreshFile: unknown;
  trustSet: unknown;
  now: Date;
}): StudyLeadAttestationRefreshFile {
  const refreshFile = studyLeadAttestationRefreshFileSchema.parse(
    params.refreshFile,
  );
  const trustedKeys = trustedKeyMap(params.trustSet);
  for (const item of refreshFile.attestations) {
    const publicKey = trustedKeys.get(item.releaseAttestation.keyId);
    if (!publicKey) throw new Error("Study-lead signing key is not trusted");
    const verified = verifyPayload(
      null,
      benchmarkReleaseAttestationPayload(item.releaseAttestation.envelope),
      publicKey,
      Buffer.from(item.releaseAttestation.signatureBase64, "base64"),
    );
    if (!verified) throw new Error("Study-lead attestation signature is invalid");
    validateAttestationTime(item.releaseAttestation, params.now);
    if (item.releaseAttestation.envelope.benchmarkKey !== item.benchmarkKey) {
      throw new Error("Attestation refresh benchmark identity is invalid");
    }
  }
  return refreshFile;
}

export function signStudyLeadManifest(params: {
  manifest: unknown;
  identityReceipts: unknown;
  privateKeyPkcs8Pem: string;
  verifiedAt: string;
  expiresAt: string;
}): GradingBenchmarkImportFile {
  const manifest = unsignedManifestSchema.parse(params.manifest);
  const receipts = studyLeadIdentityReceiptFileSchema.parse(
    params.identityReceipts,
  );
  const receiptByBenchmark = new Map(
    receipts.benchmarks.map((receipt) => [receipt.benchmarkKey, receipt]),
  );
  if (
    receiptByBenchmark.size !== manifest.benchmarks.length ||
    manifest.benchmarks.some(
      (benchmark) => !receiptByBenchmark.has(benchmark.benchmarkKey),
    )
  ) {
    throw new Error("Identity receipt file must match the benchmark manifest exactly");
  }
  const { privateKey, publicConfig } = privateKeyFromPem(
    params.privateKeyPkcs8Pem,
  );
  const output = structuredClone(manifest) as UnsignedManifest;
  output.createdAt = params.verifiedAt;
  output.benchmarks = output.benchmarks.map((benchmark) => {
    const receipt = receiptByBenchmark.get(benchmark.benchmarkKey)!;
    const bindings = attestationBindings(benchmark);
    const envelope = {
      envelopeVersion: 1 as const,
      ...bindings,
      groupingReceipts: receipt.groupingReceipts,
      captureIdentityReceiptSha256: receipt.captureIdentityReceiptSha256,
      verifiedAt: params.verifiedAt,
      expiresAt: params.expiresAt,
    };
    const parsedEnvelope = benchmarkReleaseAttestationSchema.shape.envelope.parse(
      envelope,
    );
    return {
      ...benchmark,
      releaseAttestation: {
        keyId: publicConfig.keyId,
        envelope: parsedEnvelope,
        signatureBase64: signPayload(
          null,
          benchmarkReleaseAttestationPayload(parsedEnvelope),
          privateKey,
        ).toString("base64"),
      },
    };
  });
  return parseGradingBenchmarkImport(output);
}

export function verifyStudyLeadManifest(params: {
  manifest: unknown;
  trustSet: unknown;
  now: Date;
}): { benchmarkCount: number; keyIds: string[] } {
  const manifest = parseGradingBenchmarkImport(params.manifest);
  const trustedKeys = trustedKeyMap(params.trustSet);
  const keyIds = new Set<string>();
  for (const benchmark of manifest.benchmarks) {
    verifyOneAttestation({ benchmark, trustedKeys, now: params.now });
    keyIds.add(benchmark.releaseAttestation.keyId);
  }
  return { benchmarkCount: manifest.benchmarks.length, keyIds: [...keyIds].sort() };
}

export function refreshStudyLeadManifest(params: {
  manifest: unknown;
  previousTrustSet: unknown;
  privateKeyPkcs8Pem: string;
  verifiedAt: string;
  expiresAt: string;
}): GradingBenchmarkImportFile {
  const manifest = unsignedManifestSchema.parse(params.manifest);
  const trustedKeys = trustedKeyMap(params.previousTrustSet);
  for (const benchmark of manifest.benchmarks) {
    verifyOneAttestation({
      benchmark,
      trustedKeys,
      allowUpdatedWithdrawal: true,
    });
  }
  const identityReceipts: StudyLeadIdentityReceiptFile = {
    receiptFileVersion: 1,
    benchmarks: manifest.benchmarks.map((benchmark) => ({
      benchmarkKey: benchmark.benchmarkKey,
      groupingReceipts: benchmark.releaseAttestation!.envelope.groupingReceipts,
      captureIdentityReceiptSha256:
        benchmark.releaseAttestation!.envelope.captureIdentityReceiptSha256,
    })),
  };
  return signStudyLeadManifest({
    manifest,
    identityReceipts,
    privateKeyPkcs8Pem: params.privateKeyPkcs8Pem,
    verifiedAt: params.verifiedAt,
    expiresAt: params.expiresAt,
  });
}

function assertAbsoluteFilePath(path: string, description: string): void {
  if (!isAbsolute(path)) throw new Error(`${description} must be an absolute path`);
}

export async function assertMode0600(path: string, description: string): Promise<void> {
  assertAbsoluteFilePath(path, description);
  const file = await lstat(path);
  if (!file.isFile() || file.isSymbolicLink()) {
    throw new Error(`${description} must be a regular file, not a symlink`);
  }
  if ((file.mode & 0o777) !== 0o600) {
    throw new Error(`${description} must have file mode 0600`);
  }
}

async function assertOutputDoesNotExist(path: string): Promise<void> {
  try {
    await lstat(path);
    throw new Error(`Refusing to overwrite existing output: ${path}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function atomicWriteFile(params: {
  path: string;
  contents: string | Buffer;
  mode: 0o600 | 0o644;
}): Promise<void> {
  assertAbsoluteFilePath(params.path, "Output path");
  await mkdir(dirname(params.path), { recursive: true, mode: 0o700 });
  await assertOutputDoesNotExist(params.path);
  const temporaryPath = join(
    dirname(params.path),
    `.${basename(params.path)}.${process.pid}.${createHash("sha256")
      .update(`${params.path}:${Date.now()}:${Math.random()}`)
      .digest("hex")
      .slice(0, 16)}.tmp`,
  );
  let handle;
  try {
    handle = await open(temporaryPath, "wx", params.mode);
    await handle.writeFile(params.contents);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await chmod(temporaryPath, params.mode);
    await rename(temporaryPath, params.path);
    await chmod(params.path, params.mode);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readProtectedJson(path: string): Promise<unknown> {
  await assertMode0600(path, "Protected input");
  return JSON.parse(await readFile(path, "utf8"));
}

export async function readPrivateKey(path: string): Promise<string> {
  await assertMode0600(path, "Study-lead private key");
  return readFile(path, "utf8");
}

export async function writeStudyLeadKeyPair(params: {
  privateKeyPath: string;
  publicConfigPath: string;
}): Promise<StudyLeadPublicKeyConfig> {
  assertAbsoluteFilePath(params.privateKeyPath, "Private key path");
  assertAbsoluteFilePath(params.publicConfigPath, "Public config path");
  const material = createStudyLeadKeyMaterial();
  await atomicWriteFile({
    path: params.privateKeyPath,
    contents: material.privateKeyPkcs8Pem,
    mode: 0o600,
  });
  try {
    await atomicWriteFile({
      path: params.publicConfigPath,
      contents: `${JSON.stringify(material.publicConfig, null, 2)}\n`,
      mode: 0o644,
    });
  } catch (error) {
    await rm(params.privateKeyPath, { force: true });
    throw error;
  }
  return material.publicConfig;
}

export function publicKeyConfigFromPrivateKeyPem(
  privateKeyPkcs8Pem: string,
): StudyLeadPublicKeyConfig {
  return privateKeyFromPem(privateKeyPkcs8Pem).publicConfig;
}

export function parseStudyLeadTrustSet(value: unknown): StudyLeadTrustSet {
  const trustSet = studyLeadTrustSetSchema.parse(value);
  for (const config of trustSet.keys) parsePublicKeyConfig(config);
  return trustSet;
}

export function parseSignedStudyManifest(value: unknown): GradingBenchmarkImportFile {
  return gradingBenchmarkImportFileSchema.parse(value);
}
