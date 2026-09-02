import { z } from "zod";

export const IELTS_BENCHMARK_STUDY_DESIGN_V1 = {
  id: "debatelab-ielts-examiner-study",
  version: 1,
  rubricVersions: {
    ielts_speaking: "ielts-speaking-rubric-v1",
    ielts_writing: "ielts-writing-rubric-v1",
  },
  requiredBands: [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9],
  taskTypes: {
    ielts_speaking: [
      "speaking_part1",
      "speaking_part2_cuecard",
      "speaking_part3",
    ],
    ielts_writing: [
      "writing_task1_academic",
      "writing_task1_general",
      "writing_task2_essay",
    ],
  },
  criteria: {
    ielts_speaking: [
      "fluencyCoherence",
      "lexicalResource",
      "grammaticalRangeAccuracy",
      "pronunciation",
    ],
    ielts_writing: [
      "taskResponse",
      "coherenceCohesion",
      "lexicalResource",
      "grammaticalRangeAccuracy",
    ],
  },
  strata: {
    accentGroups: [
      "vi_general",
      "vi_north",
      "vi_central",
      "vi_south",
      "other_documented",
    ],
    releaseAccentGroups: ["vi_general"],
    l1Groups: ["vi", "other_documented"],
    audioQualityGroups: [
      "studio",
      "quiet_room",
      "typical_device",
      "degraded",
    ],
  },
  minimumCasesPerBandTaskCriterionCell: 15,
} as const;

/**
 * V2 makes the three Vietnamese regional accent strata release-critical.
 * `vi_general` remains an allowed legacy/unknown-region label, but it cannot
 * satisfy V2 pronunciation calibration coverage.
 */
export const IELTS_BENCHMARK_STUDY_DESIGN_V2 = {
  ...IELTS_BENCHMARK_STUDY_DESIGN_V1,
  version: 2,
  strata: {
    ...IELTS_BENCHMARK_STUDY_DESIGN_V1.strata,
    releaseAccentGroups: ["vi_north", "vi_central", "vi_south"],
  },
} as const;

export const IELTS_BENCHMARK_STUDY_DESIGN_CURRENT =
  IELTS_BENCHMARK_STUDY_DESIGN_V2;

const benchmarkStudyDesignIdentityV1Schema = z.object({
  id: z.literal(IELTS_BENCHMARK_STUDY_DESIGN_V1.id),
  version: z.literal(IELTS_BENCHMARK_STUDY_DESIGN_V1.version),
});

export const currentBenchmarkStudyDesignIdentitySchema = z.object({
  id: z.literal(IELTS_BENCHMARK_STUDY_DESIGN_CURRENT.id),
  version: z.literal(IELTS_BENCHMARK_STUDY_DESIGN_CURRENT.version),
});

/** Historical records may identify either immutable design version. */
export const benchmarkStudyDesignIdentitySchema = z.union([
  benchmarkStudyDesignIdentityV1Schema,
  currentBenchmarkStudyDesignIdentitySchema,
]);

export type BenchmarkStudyDesignIdentity = z.infer<
  typeof benchmarkStudyDesignIdentitySchema
>;

export function assertBenchmarkStudyDesignIdentity(value: unknown) {
  return benchmarkStudyDesignIdentitySchema.parse(value);
}

export function assertCurrentBenchmarkStudyDesignIdentity(value: unknown) {
  return currentBenchmarkStudyDesignIdentitySchema.parse(value);
}

export function getBenchmarkStudyDesign(version: 1 | 2) {
  return version === 1
    ? IELTS_BENCHMARK_STUDY_DESIGN_V1
    : IELTS_BENCHMARK_STUDY_DESIGN_V2;
}
