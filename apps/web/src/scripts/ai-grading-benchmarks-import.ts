import "server-only";

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
      "id,canonical_url,authority_tier,rights_status,checksum,review_status",
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
      existing.review_status === "approved";
    if (!compatible) {
      throw new Error(
        `Existing benchmark source does not match approved manifest: ${source.canonicalUrl}`,
      );
    }
  }

  const missingSources = manifest.sources
    .filter((source) => !existingSourceByUrl.has(source.canonicalUrl))
    .map((source) => ({
      canonical_url: source.canonicalUrl,
      publisher: source.publisher,
      title: source.title,
      authority_tier: source.authorityTier,
      rights_status: source.rightsStatus,
      checksum: source.checksum,
      review_status: "approved",
      review_notes: source.reviewNotes,
      metadata: {
        benchmarkOnly: true,
        reviewedBy: source.reviewedBy,
        reviewedAt: source.reviewedAt,
        manifestVersion: manifest.manifestVersion,
      },
    }));
  if (missingSources.length > 0) {
    const { error } = await client
      .from("ai_knowledge_sources")
      .insert(missingSources);
    if (error)
      throw new Error(`Benchmark source insert failed: ${error.message}`);
  }

  const { data: sourceData, error: refreshedSourceError } = await client
    .from("ai_knowledge_sources")
    .select("id,canonical_url")
    .in("canonical_url", sourceUrls);
  if (refreshedSourceError) {
    throw new Error(
      `Benchmark source refresh failed: ${refreshedSourceError.message}`,
    );
  }
  const sourceIdByUrl = new Map(
    (sourceData ?? []).map((row) => [
      String(row.canonical_url),
      String(row.id),
    ]),
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
      equalJson(existing.protected_label, row.protected_label);
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
      sourcesInserted: missingSources.length,
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
