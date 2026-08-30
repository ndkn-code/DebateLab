import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

import {
  parseBenchmarkEvaluationImport,
  parseGradingPrediction,
} from "@/lib/ai/benchmarks/contracts";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const filePath = process.env.AI_GRADING_EVALUATIONS_FILE;
  if (!url || !serviceRole || !filePath) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and AI_GRADING_EVALUATIONS_FILE are required",
    );
  }
  const parsed = parseBenchmarkEvaluationImport(
    JSON.parse(await readFile(filePath, "utf8")),
  );
  const requestedVersion = process.env.AI_GRADING_GATE_VERSION;
  const requestedCorpusVersion = Number(
    process.env.AI_GRADING_GATE_CORPUS_VERSION,
  );
  if (
    (requestedVersion && requestedVersion !== parsed.graderVersion) ||
    (Number.isFinite(requestedCorpusVersion) &&
      requestedCorpusVersion !== parsed.corpusVersion)
  ) {
    throw new Error(
      "Evaluation import version does not match AI_GRADING_GATE_VERSION/CORPUS_VERSION",
    );
  }

  const client = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const benchmarkKeys = parsed.evaluations.map((entry) => entry.benchmarkKey);
  // Do not select protected_label here. The runner only needs the task skill
  // to validate a model output, preserving service-role-only gold labels.
  const { data, error } = await client
    .from("ai_grading_benchmarks")
    .select("id, benchmark_key, skill")
    .in("benchmark_key", benchmarkKeys)
    .eq("is_active", true);
  if (error) throw new Error(`Benchmark lookup failed: ${error.message}`);
  const benchmarkByKey = new Map(
    (data ?? []).map((row) => [String(row.benchmark_key), record(row)]),
  );
  if (benchmarkByKey.size !== benchmarkKeys.length) {
    const missing = benchmarkKeys.filter((key) => !benchmarkByKey.has(key));
    throw new Error(
      `Unknown or inactive benchmark keys: ${missing.join(", ")}`,
    );
  }

  const rows = parsed.evaluations.map((entry) => {
    const benchmark = benchmarkByKey.get(entry.benchmarkKey)!;
    const skill = String(benchmark.skill);
    if (!parseGradingPrediction(skill, entry.prediction)) {
      throw new Error(`Invalid ${skill} prediction for ${entry.benchmarkKey}`);
    }
    for (const repeat of entry.repeatPredictions) {
      if (!parseGradingPrediction(skill, repeat)) {
        throw new Error(
          `Invalid repeat ${skill} prediction for ${entry.benchmarkKey}`,
        );
      }
    }
    return {
      benchmark_id: String(benchmark.id),
      grader_version: parsed.graderVersion,
      corpus_version: parsed.corpusVersion,
      prediction: entry.prediction,
      metrics: {},
      run_metadata: {
        ...entry.runMetadata,
        repeatPredictions: entry.repeatPredictions,
        ...(entry.operationalSafetyEvidence
          ? { operationalSafetyEvidence: entry.operationalSafetyEvidence }
          : {}),
      },
    };
  });
  const { error: upsertError } = await client
    .from("ai_grading_evaluations")
    .upsert(rows, { onConflict: "benchmark_id,grader_version,corpus_version" });
  if (upsertError)
    throw new Error(`Evaluation import failed: ${upsertError.message}`);
  process.stdout.write(
    `${JSON.stringify({ imported: rows.length, graderVersion: parsed.graderVersion, corpusVersion: parsed.corpusVersion })}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
