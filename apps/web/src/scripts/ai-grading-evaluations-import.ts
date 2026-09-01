import { readFile } from "node:fs/promises";

import {
  parseBenchmarkEvaluationImport,
  parseGradingPrediction,
} from "@/lib/ai/benchmarks/contracts";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonRecord = Record<string, unknown>;

interface UntypedEvaluationRunsClient {
  rpc(
    functionName: "record_ai_grading_evaluation_run",
    args: {
      p_evaluation_id: string;
      p_run_kind: "primary" | "repeat";
      p_prediction: unknown;
      p_provider_request_id: string;
    },
  ): PromiseLike<{ error: { message: string } | null }>;
  from(table: "ai_grading_evaluation_runs"): {
    select(columns: string): {
      in(
        column: string,
        values: string[],
      ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
    };
  };
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function main() {
  const filePath = process.env.AI_GRADING_EVALUATIONS_FILE;
  if (!filePath) {
    throw new Error(
      "AI_GRADING_EVALUATIONS_FILE is required (along with the Supabase admin environment)",
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

  const client = createAdminClient();
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
    for (const run of entry.runs) {
      if (!parseGradingPrediction(skill, run.prediction)) {
        throw new Error(
          `Invalid ${run.runKind} ${skill} prediction for ${entry.benchmarkKey}`,
        );
      }
    }
    const primary = entry.runs.find((run) => run.runKind === "primary")!;
    return {
      benchmark_id: String(benchmark.id),
      grader_version: parsed.graderVersion,
      corpus_version: parsed.corpusVersion,
      prediction: primary.prediction,
      metrics: {},
      run_metadata: {},
    };
  });
  const { data: storedEvaluations, error: upsertError } = await client
    .from("ai_grading_evaluations")
    .upsert(rows, { onConflict: "benchmark_id,grader_version,corpus_version" })
    .select("id,benchmark_id");
  if (upsertError)
    throw new Error(`Evaluation import failed: ${upsertError.message}`);
  const evaluationIdByBenchmarkId = new Map(
    (storedEvaluations ?? []).map((evaluation) => [
      String(evaluation.benchmark_id),
      String(evaluation.id),
    ]),
  );
  const runRows = parsed.evaluations.flatMap((entry) => {
    const benchmark = benchmarkByKey.get(entry.benchmarkKey)!;
    const evaluationId = evaluationIdByBenchmarkId.get(String(benchmark.id));
    if (!evaluationId) throw new Error("Evaluation row identity is missing");
    return entry.runs.map((run) => ({
      evaluation_id: evaluationId,
      run_kind: run.runKind,
      prediction: run.prediction,
      provider_request_id: run.providerRequestId,
    }));
  });
  const runClient = client as unknown as UntypedEvaluationRunsClient;
  for (const row of runRows) {
    const { error: runInsertError } = await runClient.rpc(
      "record_ai_grading_evaluation_run",
      {
        p_evaluation_id: row.evaluation_id,
        p_run_kind: row.run_kind,
        p_prediction: row.prediction,
        p_provider_request_id: row.provider_request_id,
      },
    );
    if (runInsertError) {
      throw new Error(
        `Evaluation run import failed: ${runInsertError.message}`,
      );
    }
  }
  const { data: storedRuns, error: storedRunsError } = await runClient
    .from("ai_grading_evaluation_runs")
    .select(
      "evaluation_id,run_kind,prediction,provider_request_id",
    )
    .in("evaluation_id", [...evaluationIdByBenchmarkId.values()]);
  if (storedRunsError) {
    throw new Error(`Evaluation run verification failed: ${storedRunsError.message}`);
  }
  const expectedByKey = new Map(
    runRows.map((row) => [
      `${row.evaluation_id}|${row.run_kind}`,
      canonicalJson(row),
    ]),
  );
  for (const value of Array.isArray(storedRuns) ? storedRuns : []) {
    const stored = record(value);
    const key = `${stored.evaluation_id}|${stored.run_kind}`;
    const expected = expectedByKey.get(key);
    if (!expected || canonicalJson(stored) !== expected) {
      throw new Error(`Immutable evaluation run differs from import: ${key}`);
    }
    expectedByKey.delete(key);
  }
  if (expectedByKey.size > 0) {
    throw new Error("One or more immutable evaluation runs are missing");
  }
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
