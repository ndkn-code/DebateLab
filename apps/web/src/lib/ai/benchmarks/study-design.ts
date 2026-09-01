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

export const benchmarkStudyDesignIdentitySchema = z.object({
  id: z.literal(IELTS_BENCHMARK_STUDY_DESIGN_V1.id),
  version: z.literal(IELTS_BENCHMARK_STUDY_DESIGN_V1.version),
});

export function assertBenchmarkStudyDesignIdentity(value: unknown) {
  return benchmarkStudyDesignIdentitySchema.parse(value);
}
