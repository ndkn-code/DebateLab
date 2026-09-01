import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import {
  readProtectedJson,
  verifyStudyLeadAttestationRefresh,
  verifyStudyLeadBenchmarkAttestation,
} from "@/lib/ai/benchmarks/study-attestation";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonRecord = Record<string, unknown>;

type UntypedQueryResult = {
  data: unknown;
  error: { message: string } | null;
};

interface UntypedBenchmarkQuery {
  in(column: string, values: string[]): PromiseLike<UntypedQueryResult>;
}

interface UntypedRefreshClient {
  from(table: string): {
    select(columns: string): UntypedBenchmarkQuery;
  };
  rpc(
    name: "refresh_ai_grading_benchmark_release_attestations",
    args: { p_attestations: JsonRecord[] },
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

async function parseAbsoluteJson(path: string | undefined, name: string) {
  if (!path || !isAbsolute(path)) {
    throw new Error(`${name} must be an absolute file path`);
  }
  return JSON.parse(await readFile(path, "utf8"));
}

async function main(): Promise<void> {
  const now = new Date();
  const refreshPath = process.env.AI_GRADING_BENCHMARK_ATTESTATION_REFRESH_FILE;
  if (!refreshPath || !isAbsolute(refreshPath)) {
    throw new Error(
      "AI_GRADING_BENCHMARK_ATTESTATION_REFRESH_FILE must be an absolute file path",
    );
  }
  const refreshJson = await readProtectedJson(refreshPath);
  const trustSet = await parseAbsoluteJson(
    process.env.AI_GRADING_BENCHMARK_TRUST_SET_FILE,
    "AI_GRADING_BENCHMARK_TRUST_SET_FILE",
  );

  // Verify the detached file before privileged database access. This proves
  // that a service-role process cannot manufacture refreshed study evidence.
  const refresh = verifyStudyLeadAttestationRefresh({
    refreshFile: refreshJson,
    trustSet,
    now,
  });

  const client = createAdminClient() as unknown as UntypedRefreshClient;
  const benchmarkKeys = refresh.attestations.map((item) => item.benchmarkKey);
  const { data, error } = await client
    .from("ai_grading_benchmarks")
    .select("id,benchmark_key,protected_label,metadata")
    .in("benchmark_key", benchmarkKeys);
  if (error) {
    throw new Error(`Benchmark attestation refresh lookup failed: ${error.message}`);
  }
  const rows = Array.isArray(data) ? data.map(record) : [];
  const storedByKey = new Map(
    rows.map((row) => [String(row.benchmark_key), row] as const),
  );
  if (
    storedByKey.size !== refresh.attestations.length ||
    benchmarkKeys.some((key) => !storedByKey.has(key))
  ) {
    throw new Error("Attestation refresh must match stored benchmarks exactly");
  }

  const updatedAt = now.toISOString();
  const attestationRows = refresh.attestations.map((item) => {
    const stored = storedByKey.get(item.benchmarkKey)!;
    verifyStudyLeadBenchmarkAttestation({
      benchmark: {
        benchmarkKey: stored.benchmark_key,
        protectedLabel: stored.protected_label,
        metadata: stored.metadata,
        releaseAttestation: item.releaseAttestation,
      },
      trustSet,
      now,
      allowUpdatedWithdrawal: true,
    });
    return {
      benchmark_id: String(stored.id),
      key_id: item.releaseAttestation.keyId,
      envelope: item.releaseAttestation.envelope,
      signature_base64: item.releaseAttestation.signatureBase64,
      verified_at: item.releaseAttestation.envelope.verifiedAt,
      expires_at: item.releaseAttestation.envelope.expiresAt,
      updated_at: updatedAt,
    };
  });

  const { data: refreshedCount, error: upsertError } = await client.rpc(
    "refresh_ai_grading_benchmark_release_attestations",
    { p_attestations: attestationRows },
  );
  if (upsertError) {
    throw new Error(`Benchmark attestation refresh failed: ${upsertError.message}`);
  }
  if (Number(refreshedCount) !== attestationRows.length) {
    throw new Error("Benchmark attestation refresh count mismatch");
  }

  process.stdout.write(
    `${JSON.stringify({
      releaseAttestationsRefreshed: attestationRows.length,
      keyIds: [...new Set(refresh.attestations.map((item) => item.releaseAttestation.keyId))].sort(),
    })}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Benchmark attestation refresh failed"}\n`,
  );
  process.exitCode = 1;
});
