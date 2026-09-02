import { createHmac } from "node:crypto";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Signing boundary for the trusted acoustic-preprocessing Cloud Run job.
 * Import/release code deliberately has no signing import and verifies through
 * the Vault-backed Supabase RPC instead.
 */
export function signAcousticAttestationForTrustedPreprocessor(
  envelope: Readonly<Record<string, unknown>>,
  secret: string,
): string {
  if (!secret.trim()) throw new Error("Acoustic attestation secret is required");
  return createHmac("sha256", secret)
    .update(canonicalJson(envelope), "utf8")
    .digest("hex");
}
