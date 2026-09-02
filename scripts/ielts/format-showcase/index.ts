import { FORMAT_SHOWCASE_ACADEMIC } from "./academic";
import { FORMAT_SHOWCASE_GENERAL } from "./general";
import type { AuthoredTest } from "./types";

export { FORMAT_SHOWCASE_ACADEMIC, FORMAT_SHOWCASE_GENERAL };
export type * from "./types";

export const FORMAT_SHOWCASE_BATCH_KEY = "format-showcase-v1";

/** Academic first, then General Training. */
export const FORMAT_SHOWCASE_TESTS: AuthoredTest[] = [FORMAT_SHOWCASE_ACADEMIC, FORMAT_SHOWCASE_GENERAL];

/**
 * Speaking practice set derived from the Academic showcase: a full-mock
 * simulation excludes Speaking by design, so the three-part set (Part 1 list,
 * Part 2 cue card with prep timer, Part 3 discussion) is also published as a
 * guided-practice skill set. Not part of FORMAT_SHOWCASE_TESTS (no objective
 * points), imported with `--only format-showcase-speaking`.
 */
export const FORMAT_SHOWCASE_SPEAKING: AuthoredTest = {
  slug: "format-showcase-speaking",
  title: "Format Showcase — Speaking",
  description: "Three-part IELTS Speaking practice: interview questions, a cue card with one minute of preparation, and a discussion.",
  module: "academic",
  kind: "skill_set",
  skill: "speaking",
  bandConversionKey: "default",
  timeLimitSeconds: 14 * 60,
  assets: [],
  passages: [],
  listeningSections: [],
  groups: [],
  questions: FORMAT_SHOWCASE_ACADEMIC.questions
    .filter((q) => q.skill === "speaking")
    .map((q) => ({ ...q, importId: q.importId.replace(/^fsa-/, "fss-") })),
};

export const FORMAT_SHOWCASE_EXTRA_TESTS: AuthoredTest[] = [FORMAT_SHOWCASE_SPEAKING];
