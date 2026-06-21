import type {
  IeltsBandPrediction,
  IeltsGoalModel,
  IeltsSkill,
} from "@/lib/ielts/adaptive/contracts";
import type { IeltsDiagnosticTestSummary } from "@/lib/api/ielts/study-plan-repository";
import type { IeltsGeneratedStudyPlan } from "@/lib/ielts/study-plan";

export type GoalState = {
  targetOverallBand: number;
  targetSkillBands: Record<IeltsSkill, string>;
  targetTestDate: string;
  focusSkills: IeltsSkill[];
  studyDays: number[];
  dailyMinutes: number;
  timezone: string;
  feedbackLanguage: "en" | "vi";
};

export type PlanResult = {
  planId: string;
  prediction: IeltsBandPrediction;
  generatedPlan: IeltsGeneratedStudyPlan;
  persistedItemCount: number;
  skippedItemCount: number;
  diagnosticTest: IeltsDiagnosticTestSummary | null;
};

export function goalToState(goal: IeltsGoalModel): GoalState {
  return {
    targetOverallBand: goal.targetOverallBand,
    targetSkillBands: {
      listening: goal.targetSkillBands.listening?.toString() ?? "",
      reading: goal.targetSkillBands.reading?.toString() ?? "",
      writing: goal.targetSkillBands.writing?.toString() ?? "",
      speaking: goal.targetSkillBands.speaking?.toString() ?? "",
    },
    targetTestDate: goal.targetTestDate,
    focusSkills: goal.focusSkills ?? [],
    studyDays: [...goal.availability.studyDays],
    dailyMinutes: goal.availability.dailyMinutes,
    timezone: goal.availability.timezone,
    feedbackLanguage: goal.feedbackLanguage,
  };
}

export function stateToGoal(state: GoalState): IeltsGoalModel {
  const targetSkillBands = Object.fromEntries(
    Object.entries(state.targetSkillBands).map(([skill, value]) => [
      skill,
      value ? Number(value) : null,
    ]),
  ) as IeltsGoalModel["targetSkillBands"];

  return {
    module: "academic",
    targetOverallBand: state.targetOverallBand,
    targetSkillBands,
    targetTestDate: state.targetTestDate,
    focusSkills: state.focusSkills.length > 0 ? state.focusSkills : undefined,
    availability: {
      studyDays: state.studyDays as IeltsGoalModel["availability"]["studyDays"],
      dailyMinutes: state.dailyMinutes,
      timezone: state.timezone,
      preferredIntensity: "standard",
    },
    feedbackLanguage: state.feedbackLanguage,
  };
}
