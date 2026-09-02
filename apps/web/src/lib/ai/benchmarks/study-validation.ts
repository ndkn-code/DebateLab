import {
  parseGradingBenchmarkImport,
  type GradingBenchmarkImportFile,
} from "./contracts";
import { IELTS_BENCHMARK_STUDY_DESIGN_V1 } from "./study-design";
import { verifyStudyLeadManifest } from "./study-attestation";

export interface BenchmarkStudyDeficit {
  skill: "ielts_speaking" | "ielts_writing";
  taskType: string;
  criterion: string;
  band: number;
  accentGroup: string | null;
  observed: number;
  required: number;
}

export interface BenchmarkStudyValidationSummary {
  valid: true;
  benchmarkCount: number;
  sourceCount: number;
  splitCounts: Record<"development" | "evaluation" | "holdout", number>;
  skillCounts: Record<"ielts_speaking" | "ielts_writing", number>;
  deficitCount: number;
  deficits: BenchmarkStudyDeficit[];
  signatureVerified: boolean;
}

export type BenchmarkStudyValidationMode = "draft" | "release";

function cellKey(params: Omit<BenchmarkStudyDeficit, "observed" | "required">) {
  return [
    params.skill,
    params.taskType,
    params.criterion,
    params.band,
    params.accentGroup ?? "none",
  ].join("|");
}

export function validateBenchmarkStudyManifest(
  value: unknown,
  options: {
    mode?: BenchmarkStudyValidationMode;
    trustSet?: unknown;
    now?: Date;
  } = {},
): BenchmarkStudyValidationSummary {
  const manifest: GradingBenchmarkImportFile =
    parseGradingBenchmarkImport(value);
  const observed = new Map<string, Set<string>>();
  const representedAccents = new Set(
    manifest.benchmarks
      .filter((benchmark) => benchmark.skill === "ielts_speaking")
      .map((benchmark) => benchmark.accentGroup)
      .filter((value): value is string => Boolean(value)),
  );
  for (const required of IELTS_BENCHMARK_STUDY_DESIGN_V1.strata
    .releaseAccentGroups) {
    representedAccents.add(required);
  }
  for (const benchmark of manifest.benchmarks) {
    if (benchmark.split !== "holdout") continue;
    for (const [criterion, label] of Object.entries(
      benchmark.protectedLabel.criteria,
    )) {
      const key = cellKey({
        skill: benchmark.skill,
        taskType: benchmark.taskType,
        criterion,
        band: label.band,
        accentGroup:
          benchmark.skill === "ielts_speaking" ? benchmark.accentGroup : null,
      });
      const cases = observed.get(key) ?? new Set<string>();
      cases.add(benchmark.benchmarkKey);
      observed.set(key, cases);
    }
  }

  const deficits: BenchmarkStudyDeficit[] = [];
  for (const skill of ["ielts_speaking", "ielts_writing"] as const) {
    const accentGroups: Array<string | null> =
      skill === "ielts_speaking" ? [...representedAccents].sort() : [null];
    for (const taskType of IELTS_BENCHMARK_STUDY_DESIGN_V1.taskTypes[skill]) {
      for (const criterion of IELTS_BENCHMARK_STUDY_DESIGN_V1.criteria[skill]) {
        for (const band of IELTS_BENCHMARK_STUDY_DESIGN_V1.requiredBands) {
          for (const accentGroup of accentGroups) {
            const identity = {
              skill,
              taskType,
              criterion,
              band,
              accentGroup,
            };
            const count = observed.get(cellKey(identity))?.size ?? 0;
            const required =
              IELTS_BENCHMARK_STUDY_DESIGN_V1
                .minimumCasesPerBandTaskCriterionCell;
            if (count < required) {
              deficits.push({ ...identity, observed: count, required });
            }
          }
        }
      }
    }
  }

  const splitCounts = {
    development: 0,
    evaluation: 0,
    holdout: 0,
  };
  const skillCounts = { ielts_speaking: 0, ielts_writing: 0 };
  for (const benchmark of manifest.benchmarks) {
    splitCounts[benchmark.split] += 1;
    skillCounts[benchmark.skill] += 1;
  }
  const summary: BenchmarkStudyValidationSummary = {
    valid: true,
    benchmarkCount: manifest.benchmarks.length,
    sourceCount: manifest.sources.length,
    splitCounts,
    skillCounts,
    deficitCount: deficits.length,
    deficits,
    signatureVerified: false,
  };
  const mode = options.mode ?? "release";
  if (mode === "release" && deficits.length > 0) {
    throw new Error(
      `Benchmark release coverage is incomplete: ${deficits.length} required strata have deficits`,
    );
  }
  if (mode === "release") {
    if (!options.trustSet) {
      throw new Error("Benchmark release validation requires a trusted study-lead key set");
    }
    verifyStudyLeadManifest({
      manifest,
      trustSet: options.trustSet,
      now: options.now ?? new Date(),
    });
    summary.signatureVerified = true;
  }
  return summary;
}
