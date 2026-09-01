import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { parseGradingBenchmarkImport } from "@/lib/ai/benchmarks/contracts";
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

function sha256(value: string | ArrayBuffer): string {
  return createHash("sha256")
    .update(typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value))
    .digest("hex");
}

interface StorageObjectQuery {
  eq(column: string, value: string): StorageObjectQuery;
  maybeSingle(): PromiseLike<{
    data: { version?: unknown; metadata?: unknown } | null;
    error: { message: string } | null;
  }>;
}

async function verifyBenchmarkArtifacts(
  client: ReturnType<typeof createAdminClient>,
  manifest: ReturnType<typeof parseGradingBenchmarkImport>,
) {
  const storageMetadataClient = client as unknown as {
    schema(name: "storage"): {
      from(table: "objects"): { select(columns: string): StorageObjectQuery };
    };
  };
  for (const benchmark of manifest.benchmarks) {
    const input = benchmark.protectedLabel.input;
    if (input.responseText) {
      if (sha256(input.responseText) !== input.artifactSha256.toLowerCase()) {
        throw new Error(`Benchmark text checksum mismatch: ${benchmark.benchmarkKey}`);
      }
      continue;
    }
    const storagePath = input.audioObjectPath ?? input.responseObjectPath;
    if (!storagePath) throw new Error(`Benchmark artifact missing: ${benchmark.benchmarkKey}`);
    const [bucket, ...nameParts] = storagePath.split("/");
    const objectName = nameParts.join("/");
    if (!bucket || !objectName) {
      throw new Error(`Benchmark storage path must be bucket/object: ${benchmark.benchmarkKey}`);
    }
    const { data: objectRow, error: objectError } = await storageMetadataClient
      .schema("storage")
      .from("objects")
      .select("version,metadata")
      .eq("bucket_id", bucket)
      .eq("name", objectName)
      .maybeSingle();
    if (objectError || !objectRow) {
      throw new Error(`Benchmark storage metadata missing: ${benchmark.benchmarkKey}`);
    }
    const metadata = record(objectRow.metadata);
    const etag = metadata.eTag ?? metadata.etag;
    if (
      String(objectRow.version ?? "") !== input.artifactStorageVersion ||
      String(etag ?? "") !== input.artifactEtag
    ) {
      throw new Error(`Benchmark storage version/ETag mismatch: ${benchmark.benchmarkKey}`);
    }
    const { data: artifact, error: downloadError } = await client.storage
      .from(bucket)
      .download(objectName);
    if (downloadError || !artifact) {
      throw new Error(`Benchmark artifact download failed: ${benchmark.benchmarkKey}`);
    }
    if (sha256(await artifact.arrayBuffer()) !== input.artifactSha256.toLowerCase()) {
      throw new Error(`Benchmark object checksum mismatch: ${benchmark.benchmarkKey}`);
    }
  }
}

async function main() {
  const filePath = process.env.AI_GRADING_BENCHMARKS_FILE;
  if (!filePath) {
    throw new Error(
      "AI_GRADING_BENCHMARKS_FILE is required (along with the Supabase admin environment)",
    );
  }
  const manifest = parseGradingBenchmarkImport(
    JSON.parse(await readFile(filePath, "utf8")),
  );
  const client = createAdminClient();
  await verifyBenchmarkArtifacts(client, manifest);

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
      equalJson(existing.metadata, row.metadata);
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
  process.stdout.write(
    `${JSON.stringify({
      sourcesInserted: 0,
      benchmarksInserted: insertRows.length,
      benchmarksUnchanged: manifest.benchmarks.length - insertRows.length,
    })}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
