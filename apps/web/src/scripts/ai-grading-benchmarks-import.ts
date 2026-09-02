import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import {
  AI_GRADING_BENCHMARK_PRIVATE_BUCKET,
  parseGradingBenchmarkImport,
} from "@/lib/ai/benchmarks/contracts";
import {
  buildIeltsBenchmarkRequest,
  ieltsBenchmarkModelInputSha256,
} from "@/lib/ai/benchmarks/request";
import { verifyStudyLeadManifest } from "@/lib/ai/benchmarks/study-attestation";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function equalJson(left: unknown, right: unknown) {
  return canonicalJson(left) === canonicalJson(right);
}

function immutableBenchmarkMetadata(value: unknown) {
  const metadata = { ...record(value) };
  delete metadata.manifestCreatedAt;
  return metadata;
}

function sha256(value: string | ArrayBuffer | Uint8Array): string {
  return createHash("sha256")
    .update(
      typeof value === "string"
        ? Buffer.from(value, "utf8")
        : value instanceof Uint8Array
          ? Buffer.from(value)
          : Buffer.from(value),
    )
    .digest("hex");
}

interface StorageObjectQuery {
  eq(column: string, value: string): StorageObjectQuery;
  maybeSingle(): PromiseLike<{
    data: {
      id?: unknown;
      public?: unknown;
      version?: unknown;
      metadata?: unknown;
    } | null;
    error: { message: string } | null;
  }>;
}

interface UntypedMutationClient {
  from(table: string): {
    select(columns: string): {
      in(
        column: string,
        values: string[],
      ): PromiseLike<{
        data: Record<string, unknown>[] | null;
        error: { message: string } | null;
      }>;
    };
    insert(
      rows: Record<string, unknown>[],
    ): PromiseLike<{ error: { message: string } | null }>;
  };
}

type StorageMetadataClient = {
  schema(name: "storage"): {
    from(table: "objects" | "buckets"): {
      select(columns: string): StorageObjectQuery;
    };
  };
};

async function assertPrivateBenchmarkBucket(client: StorageMetadataClient) {
  const { data, error } = await client
    .schema("storage")
    .from("buckets")
    .select("id,public")
    .eq("id", AI_GRADING_BENCHMARK_PRIVATE_BUCKET)
    .maybeSingle();
  if (
    error ||
    !data ||
    data.id !== AI_GRADING_BENCHMARK_PRIVATE_BUCKET ||
    data.public !== false
  ) {
    throw new Error("Benchmark private storage bucket is unavailable");
  }
}

async function verifyAcousticAttestation(
  client: ReturnType<typeof createAdminClient>,
  benchmarkKey: string,
  input: ReturnType<
    typeof parseGradingBenchmarkImport
  >["benchmarks"][number]["protectedLabel"]["input"],
) {
  const attestation = input.audioPreprocessing?.acousticAttestation;
  if (!attestation) return;
  const rpcClient = client as unknown as {
    rpc(
      name: string,
      args: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await rpcClient.rpc(
    "verify_ai_grading_benchmark_acoustic_attestation",
    {
      p_benchmark_key: benchmarkKey,
      p_envelope: attestation.envelope,
      p_signature: attestation.signature,
    },
  );
  if (error || data !== true) {
    throw new Error(`Benchmark acoustic attestation failed: ${benchmarkKey}`);
  }
}

async function verifyBenchmarkArtifacts(
  client: ReturnType<typeof createAdminClient>,
  manifest: ReturnType<typeof parseGradingBenchmarkImport>,
): Promise<Map<string, Uint8Array>> {
  const audioReports = new Map<string, Uint8Array>();
  const storageMetadataClient = client as unknown as StorageMetadataClient;
  await assertPrivateBenchmarkBucket(storageMetadataClient);
  for (const benchmark of manifest.benchmarks) {
    const input = benchmark.protectedLabel.input;
    await verifyAcousticAttestation(client, benchmark.benchmarkKey, input);
    if (input.responseText) {
      if (sha256(input.responseText) !== input.artifactSha256.toLowerCase()) {
        throw new Error(
          `Benchmark text checksum mismatch: ${benchmark.benchmarkKey}`,
        );
      }
      continue;
    }
    const storagePath = input.audioObjectPath ?? input.responseObjectPath;
    if (!storagePath)
      throw new Error(`Benchmark artifact missing: ${benchmark.benchmarkKey}`);
    const [bucket, ...nameParts] = storagePath.split("/");
    const objectName = nameParts.join("/");
    if (bucket !== AI_GRADING_BENCHMARK_PRIVATE_BUCKET || !objectName) {
      throw new Error(
        `Benchmark storage path must be bucket/object: ${benchmark.benchmarkKey}`,
      );
    }
    const { data: objectRow, error: objectError } = await storageMetadataClient
      .schema("storage")
      .from("objects")
      .select("version,metadata")
      .eq("bucket_id", bucket)
      .eq("name", objectName)
      .maybeSingle();
    if (objectError || !objectRow) {
      throw new Error(
        `Benchmark storage metadata missing: ${benchmark.benchmarkKey}`,
      );
    }
    const metadata = record(objectRow.metadata);
    const etag = metadata.eTag ?? metadata.etag;
    if (
      String(objectRow.version ?? "") !== input.artifactStorageVersion ||
      String(etag ?? "") !== input.artifactEtag
    ) {
      throw new Error(
        `Benchmark storage version/ETag mismatch: ${benchmark.benchmarkKey}`,
      );
    }
    const { data: artifact, error: downloadError } = await client.storage
      .from(bucket)
      .download(objectName);
    if (downloadError || !artifact) {
      throw new Error(
        `Benchmark artifact download failed: ${benchmark.benchmarkKey}`,
      );
    }
    if (
      sha256(await artifact.arrayBuffer()) !==
      input.artifactSha256.toLowerCase()
    ) {
      throw new Error(
        `Benchmark object checksum mismatch: ${benchmark.benchmarkKey}`,
      );
    }
    if (!input.audioObjectPath) continue;
    const report = input.audioPreprocessing?.pronunciation;
    if (!report) {
      throw new Error(
        `Benchmark Azure report provenance missing: ${benchmark.benchmarkKey}`,
      );
    }
    const [reportBucket, ...reportNameParts] =
      report.reportObjectPath.split("/");
    const reportName = reportNameParts.join("/");
    if (reportBucket !== AI_GRADING_BENCHMARK_PRIVATE_BUCKET || !reportName) {
      throw new Error(
        `Benchmark Azure report path must be bucket/object: ${benchmark.benchmarkKey}`,
      );
    }
    const { data: reportRow, error: reportObjectError } =
      await storageMetadataClient
        .schema("storage")
        .from("objects")
        .select("version,metadata")
        .eq("bucket_id", reportBucket)
        .eq("name", reportName)
        .maybeSingle();
    const reportMetadata = record(reportRow?.metadata);
    const reportEtag = reportMetadata.eTag ?? reportMetadata.etag;
    if (
      reportObjectError ||
      !reportRow ||
      String(reportRow.version ?? "") !== report.reportStorageVersion ||
      String(reportEtag ?? "") !== report.reportEtag
    ) {
      throw new Error(
        `Benchmark Azure report identity mismatch: ${benchmark.benchmarkKey}`,
      );
    }
    const { data: reportObject, error: reportDownloadError } =
      await client.storage.from(reportBucket).download(reportName);
    if (reportDownloadError || !reportObject) {
      throw new Error(
        `Benchmark Azure report download failed: ${benchmark.benchmarkKey}`,
      );
    }
    const reportBytes = new Uint8Array(await reportObject.arrayBuffer());
    if (sha256(reportBytes) !== report.reportSha256.toLowerCase()) {
      throw new Error(
        `Benchmark Azure report checksum mismatch: ${benchmark.benchmarkKey}`,
      );
    }
    audioReports.set(benchmark.benchmarkKey, reportBytes);
  }
  return audioReports;
}

async function main() {
  const filePath = process.env.AI_GRADING_BENCHMARKS_FILE;
  const trustSetPath = process.env.AI_GRADING_BENCHMARK_TRUST_SET_FILE;
  if (
    !filePath ||
    !trustSetPath ||
    !isAbsolute(filePath) ||
    !isAbsolute(trustSetPath)
  ) {
    throw new Error(
      "Absolute AI_GRADING_BENCHMARKS_FILE and AI_GRADING_BENCHMARK_TRUST_SET_FILE paths are required (along with the Supabase admin environment)",
    );
  }
  const manifestJson = JSON.parse(await readFile(filePath, "utf8"));
  const parsedManifest = parseGradingBenchmarkImport(manifestJson);
  verifyStudyLeadManifest({
    manifest: parsedManifest,
    trustSet: JSON.parse(await readFile(trustSetPath, "utf8")),
    now: new Date(),
  });
  const client = createAdminClient();
  const audioReports = await verifyBenchmarkArtifacts(client, parsedManifest);
  // Never trust manifest-supplied request, config, or report digests. The
  // artifact verifier loads the immutable private Azure report first, then the
  // shared request boundary independently checks its bytes and derived signal.
  const manifest = {
    ...parsedManifest,
    benchmarks: parsedManifest.benchmarks.map((benchmark) => {
      const request = buildIeltsBenchmarkRequest(
        {
          skill: benchmark.skill,
          taskType: benchmark.taskType,
          rubricVersion: benchmark.protectedLabel.rubricVersion,
          input: benchmark.protectedLabel.input,
        },
        {
          audioReportBytes: audioReports.get(benchmark.benchmarkKey),
        },
      );
      return {
        ...benchmark,
        protectedLabel: {
          ...benchmark.protectedLabel,
          input: {
            ...benchmark.protectedLabel.input,
            modelInputSha256: ieltsBenchmarkModelInputSha256(request),
          },
        },
      };
    }),
  };

  const collectionSlugs = [
    ...new Set(
      manifest.benchmarks.map((benchmark) => benchmark.collectionSlug),
    ),
  ];
  const { data: collectionData, error: collectionError } = await client
    .from("ai_knowledge_collections")
    .select("id,slug")
    .in("slug", collectionSlugs)
    .eq("is_active", true);
  if (collectionError) {
    throw new Error(
      `Benchmark collection lookup failed: ${collectionError.message}`,
    );
  }
  const collectionBySlug = new Map(
    (collectionData ?? []).map((row) => [String(row.slug), String(row.id)]),
  );
  if (collectionBySlug.size !== collectionSlugs.length) {
    throw new Error(
      "One or more IELTS benchmark collections are missing or inactive",
    );
  }

  const sourceUrls = manifest.sources.map((source) => source.canonicalUrl);
  const { data: existingSourceData, error: sourceLookupError } = await client
    .from("ai_knowledge_sources")
    .select(
      "id,canonical_url,authority_tier,rights_status,checksum,review_status,submitted_by,reviewed_by",
    )
    .in("canonical_url", sourceUrls);
  if (sourceLookupError) {
    throw new Error(
      `Benchmark source lookup failed: ${sourceLookupError.message}`,
    );
  }
  const existingSourceByUrl = new Map(
    (existingSourceData ?? []).map((row) => [
      String(row.canonical_url),
      record(row),
    ]),
  );
  for (const source of manifest.sources) {
    const existing = existingSourceByUrl.get(source.canonicalUrl);
    if (!existing) continue;
    const compatible =
      existing.authority_tier === source.authorityTier &&
      existing.rights_status === source.rightsStatus &&
      existing.checksum === source.checksum &&
      existing.review_status === "approved" &&
      typeof existing.submitted_by === "string" &&
      typeof existing.reviewed_by === "string" &&
      existing.submitted_by !== existing.reviewed_by;
    if (!compatible) {
      throw new Error(
        `Existing benchmark source does not match approved manifest: ${source.canonicalUrl}`,
      );
    }
  }

  const missingSources = manifest.sources.filter(
    (source) => !existingSourceByUrl.has(source.canonicalUrl),
  );
  if (missingSources.length > 0) {
    throw new Error(
      "Benchmark sources must be registered and independently approved before label import",
    );
  }
  const sourceIdByUrl = new Map(
    [...existingSourceByUrl].map(([url, source]) => [url, String(source.id)]),
  );
  if (sourceIdByUrl.size !== sourceUrls.length) {
    throw new Error(
      "One or more approved benchmark sources could not be resolved",
    );
  }

  const benchmarkKeys = manifest.benchmarks.map(
    (benchmark) => benchmark.benchmarkKey,
  );
  const { data: existingBenchmarkData, error: benchmarkLookupError } =
    await client
      .from("ai_grading_benchmarks")
      .select(
        "id,collection_id,source_id,benchmark_key,skill,task_type,band_or_score_range,accent_group,protected_label,split,metadata",
      )
      .in("benchmark_key", benchmarkKeys);
  if (benchmarkLookupError) {
    throw new Error(`Benchmark lookup failed: ${benchmarkLookupError.message}`);
  }
  const existingBenchmarkByKey = new Map(
    (existingBenchmarkData ?? []).map((row) => [
      String(row.benchmark_key),
      record(row),
    ]),
  );
  const insertRows = [];
  for (const benchmark of manifest.benchmarks) {
    const row = {
      collection_id: collectionBySlug.get(benchmark.collectionSlug)!,
      source_id: sourceIdByUrl.get(benchmark.sourceUrl)!,
      benchmark_key: benchmark.benchmarkKey,
      skill: benchmark.skill,
      task_type: benchmark.taskType,
      band_or_score_range: benchmark.bandOrScoreRange,
      accent_group: benchmark.accentGroup,
      protected_label: benchmark.protectedLabel,
      split: benchmark.split,
      is_active: true,
      metadata: {
        ...benchmark.metadata,
        manifestVersion: manifest.manifestVersion,
        manifestCreatedAt: manifest.createdAt,
      },
    };
    const existing = existingBenchmarkByKey.get(benchmark.benchmarkKey);
    if (!existing) {
      insertRows.push(row);
      continue;
    }
    const immutableMatch =
      existing.collection_id === row.collection_id &&
      existing.source_id === row.source_id &&
      existing.skill === row.skill &&
      existing.task_type === row.task_type &&
      existing.band_or_score_range === row.band_or_score_range &&
      (existing.accent_group ?? null) === row.accent_group &&
      existing.split === row.split &&
      equalJson(existing.protected_label, row.protected_label) &&
      equalJson(
        immutableBenchmarkMetadata(existing.metadata),
        immutableBenchmarkMetadata(row.metadata),
      );
    if (!immutableMatch) {
      throw new Error(
        `Existing benchmark is immutable and differs from manifest: ${benchmark.benchmarkKey}`,
      );
    }
  }
  if (insertRows.length > 0) {
    const { error } = await client
      .from("ai_grading_benchmarks")
      .insert(insertRows);
    if (error) throw new Error(`Benchmark insert failed: ${error.message}`);
  }
  const { data: persistedBenchmarkData, error: persistedLookupError } =
    await client
      .from("ai_grading_benchmarks")
      .select("id,benchmark_key")
      .in("benchmark_key", benchmarkKeys);
  if (persistedLookupError) {
    throw new Error(
      `Persisted benchmark lookup failed: ${persistedLookupError.message}`,
    );
  }
  const persistedIdByKey = new Map(
    (persistedBenchmarkData ?? []).map((row) => [
      String(row.benchmark_key),
      String(row.id),
    ]),
  );
  if (persistedIdByKey.size !== manifest.benchmarks.length) {
    throw new Error("One or more benchmark IDs could not be resolved");
  }
  const releaseAttestationRows = manifest.benchmarks.map((benchmark) => ({
    benchmark_id: persistedIdByKey.get(benchmark.benchmarkKey)!,
    key_id: benchmark.releaseAttestation.keyId,
    envelope: benchmark.releaseAttestation.envelope,
    signature_base64: benchmark.releaseAttestation.signatureBase64,
    verified_at: benchmark.releaseAttestation.envelope.verifiedAt,
    expires_at: benchmark.releaseAttestation.envelope.expiresAt,
    updated_at: new Date().toISOString(),
  }));
  const mutationClient = client as unknown as UntypedMutationClient;
  const { data: existingAttestations, error: attestationLookupError } =
    await mutationClient
      .from("ai_grading_benchmark_release_attestations")
      .select(
        "benchmark_id,key_id,envelope,signature_base64,verified_at,expires_at",
      )
      .in(
        "benchmark_id",
        releaseAttestationRows.map((row) => row.benchmark_id),
      );
  if (attestationLookupError) {
    throw new Error(
      `Benchmark release attestation lookup failed: ${attestationLookupError.message}`,
    );
  }
  const existingById = new Map(
    (existingAttestations ?? []).map((row) => [String(row.benchmark_id), row]),
  );
  for (const row of releaseAttestationRows) {
    const existing = existingById.get(row.benchmark_id);
    if (!existing) continue;
    const unchanged =
      existing.key_id === row.key_id &&
      equalJson(existing.envelope, row.envelope) &&
      existing.signature_base64 === row.signature_base64 &&
      existing.verified_at === row.verified_at &&
      existing.expires_at === row.expires_at;
    if (!unchanged) {
      throw new Error(
        "Existing release attestations are immutable during import; use the signed attestation refresh command",
      );
    }
  }
  const newAttestationRows = releaseAttestationRows.filter(
    (row) => !existingById.has(row.benchmark_id),
  );
  const { error: attestationError } =
    newAttestationRows.length === 0
      ? { error: null }
      : await mutationClient
          .from("ai_grading_benchmark_release_attestations")
          .insert(newAttestationRows);
  if (attestationError) {
    throw new Error(
      `Benchmark release attestation upsert failed: ${attestationError.message}`,
    );
  }
  process.stdout.write(
    `${JSON.stringify({
      sourcesInserted: 0,
      benchmarksInserted: insertRows.length,
      benchmarksUnchanged: manifest.benchmarks.length - insertRows.length,
      releaseAttestationsStored: newAttestationRows.length,
      releaseAttestationsUnchanged:
        releaseAttestationRows.length - newAttestationRows.length,
    })}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
