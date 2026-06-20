/**
 * Timed-section blueprint for an IELTS mock (WS-2.1). Pure. Turns a test's
 * shape (kind + which skills have authored content) into the ordered list of
 * server-timed sections the attempt will create — one timed block per skill
 * (masterplan §6 / §2.7: a layer on the attempt substrate, never baked into the
 * core engine).
 *
 * Timing is per SKILL, not per passage: Reading is one 60-minute clock across
 * all three passages; Listening is one continuous block. Within a block the
 * player navigates parts freely; entering the next block starts its own clock.
 */
import type { Enums } from "@/types/supabase";

export type IeltsSkill = Enums<"ielts_skill">;
export type IeltsTestKind = Enums<"ielts_test_kind">;

const MINUTE = 60;

/**
 * Canonical per-section time limits (seconds). Listening is 30 min of audio +
 * 10 min transfer = one 40-minute answer window (masterplan §6); Speaking ~14m.
 */
export const IELTS_SECTION_TIME_LIMITS: Record<IeltsSkill, number> = {
  listening: 30 * MINUTE + 10 * MINUTE,
  reading: 60 * MINUTE,
  writing: 60 * MINUTE,
  speaking: 14 * MINUTE,
};

const SKILL_ORDER: readonly IeltsSkill[] = [
  "listening",
  "reading",
  "writing",
  "speaking",
];

const SKILL_LABELS: Record<IeltsSkill, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

export interface SectionBlueprint {
  skill: IeltsSkill;
  sectionOrder: number;
  label: string;
  timeLimitSeconds: number;
}

export interface MockBlueprintInput {
  kind: IeltsTestKind;
  /** Set for skill_set / drill; null for full_mock. */
  skill: IeltsSkill | null;
  /** Skills that actually have authored content in this test. */
  skillsWithContent: readonly IeltsSkill[];
  /** Optional per-skill time overrides (e.g. a test-specific limit). */
  timeLimitOverrides?: Partial<Record<IeltsSkill, number>>;
}

function resolveSkills(input: MockBlueprintInput): IeltsSkill[] {
  const available = new Set(input.skillsWithContent);
  if (input.kind === "full_mock") {
    return SKILL_ORDER.filter((skill) => available.has(skill));
  }
  // skill_set / drill: a single targeted skill, only if it has content.
  return input.skill !== null && available.has(input.skill) ? [input.skill] : [];
}

/** Build the ordered timed-section blueprint for an attempt. */
export function buildMockBlueprint(input: MockBlueprintInput): SectionBlueprint[] {
  return resolveSkills(input).map((skill, index) => ({
    skill,
    sectionOrder: index,
    label: SKILL_LABELS[skill],
    timeLimitSeconds:
      input.timeLimitOverrides?.[skill] ?? IELTS_SECTION_TIME_LIMITS[skill],
  }));
}
