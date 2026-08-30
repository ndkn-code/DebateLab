import type { AssessmentMode } from "@thinkfy/shared";
import type { IeltsSkill } from "./mock-blueprint";

export type { AssessmentMode } from "@thinkfy/shared";

export interface IeltsAssessmentReleaseGates {
  ieltsEnabled: boolean;
  assessmentModesEnabled: boolean;
}

/**
 * Practice is part of the base IELTS product and must remain startable when
 * the product is enabled. The assessment-modes rollout flag only unlocks the
 * stricter Simulation engine; otherwise a visible Practice card can render
 * successfully and then fail every start request in production.
 */
export function canStartIeltsAssessment(
  mode: AssessmentMode,
  gates: IeltsAssessmentReleaseGates,
): boolean {
  return (
    gates.ieltsEnabled &&
    (mode === "practice" || gates.assessmentModesEnabled)
  );
}

export const SIMULATION_SKILL_ORDER: readonly IeltsSkill[] = [
  "listening",
  "reading",
  "writing",
];

export interface AssessmentModePolicy {
  mode: AssessmentMode;
  skillOrder: readonly IeltsSkill[];
  canPause: boolean;
  canNavigateToSubmittedSection: boolean;
  canShowInAttemptFeedback: boolean;
  canReplayListeningAudio: boolean;
  hasSpeakingSection: boolean;
  warningSeconds: readonly number[];
  /** Display name used to keep Speaking clearly separate from simulation. */
  speakingProductLabel: "Speaking Rehearsal";
  sectionTimeLimits: Readonly<Partial<Record<IeltsSkill, number>>>;
}

/** IELTS computer-test timing: Listening includes its final review window. */
export const SIMULATION_TIME_LIMITS: Readonly<Partial<Record<IeltsSkill, number>>> = {
  // ~30 minutes of audio plus the computer-test's two-minute final review.
  listening: 32 * 60,
  reading: 60 * 60,
  writing: 60 * 60,
};

export const PRACTICE_TIME_LIMITS: Readonly<Partial<Record<IeltsSkill, number>>> = {
  listening: 40 * 60,
  reading: 60 * 60,
  writing: 60 * 60,
  speaking: 14 * 60,
};

export function assessmentModePolicy(mode: AssessmentMode): AssessmentModePolicy {
  if (mode === "simulation") {
    return {
      mode,
      skillOrder: SIMULATION_SKILL_ORDER,
      canPause: false,
      canNavigateToSubmittedSection: false,
      canShowInAttemptFeedback: false,
      canReplayListeningAudio: false,
      hasSpeakingSection: false,
      warningSeconds: [10 * 60, 5 * 60],
      speakingProductLabel: "Speaking Rehearsal",
      sectionTimeLimits: SIMULATION_TIME_LIMITS,
    };
  }

  return {
    mode,
    skillOrder: ["listening", "reading", "writing", "speaking"],
    canPause: true,
    canNavigateToSubmittedSection: true,
    canShowInAttemptFeedback: true,
    canReplayListeningAudio: true,
    hasSpeakingSection: true,
    warningSeconds: [],
    speakingProductLabel: "Speaking Rehearsal",
    sectionTimeLimits: PRACTICE_TIME_LIMITS,
  };
}

export function assessmentModeForTestKind(
  kind: "full_mock" | "skill_set" | "drill",
): AssessmentMode {
  return kind === "full_mock" ? "simulation" : "practice";
}
