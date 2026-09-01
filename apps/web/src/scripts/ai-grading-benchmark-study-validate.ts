import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateBenchmarkStudyManifest } from "@/lib/ai/benchmarks/study-validation";

async function main() {
  const argument = process.argv.find((value) => value.startsWith("--manifest="));
  const path = argument?.slice("--manifest=".length);
  if (!path) {
    throw new Error("Usage: --manifest=/absolute/path/to/protected-manifest.json");
  }
  const draft = process.argv.includes("--draft");
  const raw = JSON.parse(await readFile(resolve(path), "utf8"));
  const summary = validateBenchmarkStudyManifest(raw, {
    mode: draft ? "draft" : "release",
  });
  // Never print responses, examiner rationales, rater identities, or labels.
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Study manifest validation failed"}\n`,
  );
  process.exitCode = 1;
});
