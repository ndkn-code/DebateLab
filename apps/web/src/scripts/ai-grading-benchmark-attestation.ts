import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import { ZodError } from "zod";

import {
  atomicWriteFile,
  createStudyLeadAttestationRefresh,
  parseStudyLeadTrustSet,
  readPrivateKey,
  readProtectedJson,
  signStudyLeadManifest,
  verifyStudyLeadManifest,
  writeStudyLeadKeyPair,
} from "@/lib/ai/benchmarks/study-attestation";

type Command = "keygen" | "sign" | "verify" | "refresh";

function option(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix))?.slice(
    prefix.length,
  );
  if (!value) throw new Error(`Missing required option --${name}=/absolute/path`);
  if (!isAbsolute(value) && name !== "verified-at" && name !== "expires-at" && name !== "now") {
    throw new Error(`--${name} must be an absolute path`);
  }
  return value;
}

async function publicJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeProtectedJson(path: string, value: unknown): Promise<void> {
  await atomicWriteFile({
    path,
    contents: `${JSON.stringify(value, null, 2)}\n`,
    mode: 0o600,
  });
}

async function main(): Promise<void> {
  const command = process.argv[2] as Command | undefined;
  if (!command || !["keygen", "sign", "verify", "refresh"].includes(command)) {
    throw new Error("Expected one command: keygen, sign, verify, or refresh");
  }

  if (command === "keygen") {
    const config = await writeStudyLeadKeyPair({
      privateKeyPath: option("private-key"),
      publicConfigPath: option("public-config"),
    });
    process.stdout.write(
      `${JSON.stringify({
        command,
        keyId: config.keyId,
        fingerprintSha256: config.fingerprintSha256,
        written: true,
      })}\n`,
    );
    return;
  }

  const manifestPath = option("input");
  const manifest = await readProtectedJson(manifestPath);
  if (command === "sign") {
    const privateKeyPkcs8Pem = await readPrivateKey(option("private-key"));
    const signed = signStudyLeadManifest({
      manifest,
      identityReceipts: await readProtectedJson(option("identity-receipts")),
      privateKeyPkcs8Pem,
      verifiedAt: option("verified-at"),
      expiresAt: option("expires-at"),
    });
    await writeProtectedJson(option("output"), signed);
    process.stdout.write(
      `${JSON.stringify({
        command,
        benchmarkCount: signed.benchmarks.length,
        keyId: signed.benchmarks[0]?.releaseAttestation.keyId,
        written: true,
      })}\n`,
    );
    return;
  }

  const trustSet = parseStudyLeadTrustSet(
    await publicJson(option("trust-set")),
  );
  if (command === "verify") {
    const summary = verifyStudyLeadManifest({
      manifest,
      trustSet,
      now: new Date(option("now")),
    });
    process.stdout.write(
      `${JSON.stringify({ command, valid: true, ...summary })}\n`,
    );
    return;
  }

  const refreshed = createStudyLeadAttestationRefresh({
    manifest,
    previousTrustSet: trustSet,
    withdrawalSnapshots: await readProtectedJson(option("withdrawal-snapshots")),
    privateKeyPkcs8Pem: await readPrivateKey(option("private-key")),
    verifiedAt: option("verified-at"),
    expiresAt: option("expires-at"),
  });
  await writeProtectedJson(option("output"), refreshed);
  process.stdout.write(
    `${JSON.stringify({
      command,
      benchmarkCount: refreshed.attestations.length,
      keyId: refreshed.attestations[0]?.releaseAttestation.keyId,
      written: true,
    })}\n`,
  );
}

main().catch((error) => {
  const message =
    error instanceof ZodError
      ? "Protected attestation input failed validation"
      : error instanceof SyntaxError
        ? "Attestation input is not valid JSON"
        : error instanceof Error
          ? error.message
          : "Study-lead attestation command failed";
  // Errors are deliberately summarized; protected manifest contents are never logged.
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
