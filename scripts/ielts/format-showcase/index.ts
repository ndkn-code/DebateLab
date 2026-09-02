import { FORMAT_SHOWCASE_ACADEMIC } from "./academic";
import { FORMAT_SHOWCASE_GENERAL } from "./general";
import type { AuthoredTest } from "./types";

export { FORMAT_SHOWCASE_ACADEMIC, FORMAT_SHOWCASE_GENERAL };
export type * from "./types";

export const FORMAT_SHOWCASE_BATCH_KEY = "format-showcase-v1";

/** Academic first, then General Training. */
export const FORMAT_SHOWCASE_TESTS: AuthoredTest[] = [FORMAT_SHOWCASE_ACADEMIC, FORMAT_SHOWCASE_GENERAL];
