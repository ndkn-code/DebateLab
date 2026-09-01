import "server-only";

import {
  executeStoredIeltsBenchmarks,
  LOCKED_IELTS_BENCHMARK_GRADER_VERSION,
} from "./benchmark-executor";

async function main() {
  const configuredVersion = process.env.AI_GRADING_GATE_VERSION?.trim();
  if (
    configuredVersion &&
    configuredVersion !== LOCKED_IELTS_BENCHMARK_GRADER_VERSION
  ) {
    throw new Error("AI_GRADING_GATE_VERSION conflicts with the locked grader");
  }
  const graderVersion = LOCKED_IELTS_BENCHMARK_GRADER_VERSION;
  const corpusVersion = Number(process.env.AI_GRADING_GATE_CORPUS_VERSION);
  const split = process.env.AI_GRADING_BENCHMARK_SPLIT?.trim() || "holdout";
  if (!Number.isInteger(corpusVersion) || corpusVersion < 1) {
    throw new Error("AI_GRADING_GATE_CORPUS_VERSION is required");
  }
  if (split !== "evaluation" && split !== "holdout") {
    throw new Error("AI_GRADING_BENCHMARK_SPLIT must be evaluation or holdout");
  }
  const benchmarkKeys = process.env.AI_GRADING_BENCHMARK_KEYS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const result = await executeStoredIeltsBenchmarks({
    graderVersion,
    corpusVersion,
    split,
    benchmarkKeys: benchmarkKeys?.length ? benchmarkKeys : undefined,
  });
  // Protected labels and predictions are intentionally never emitted.
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Benchmark execution failed"}\n`,
  );
  process.exitCode = 1;
});
