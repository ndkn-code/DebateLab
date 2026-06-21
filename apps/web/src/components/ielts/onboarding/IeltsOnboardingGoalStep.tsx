import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  IELTS_SKILLS,
  type IeltsSkill,
} from "@/lib/ielts/adaptive/contracts";
import { formatBand } from "@/lib/ielts/learner/summary";
import { cn } from "@/lib/utils";
import {
  ChoiceGroup,
  Field,
  choiceClass,
} from "./IeltsOnboardingShared";
import type { GoalState } from "./types";

const BAND_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

export function IeltsOnboardingGoalStep({
  goal,
  setGoal,
  isPending,
  onBack,
  onSubmit,
}: {
  goal: GoalState;
  setGoal: Dispatch<SetStateAction<GoalState>>;
  isPending: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("ielts.onboarding");

  const toggleFocusSkill = (skill: IeltsSkill) => {
    setGoal((current) => ({
      ...current,
      focusSkills: current.focusSkills.includes(skill)
        ? current.focusSkills.filter((item) => item !== skill)
        : [...current.focusSkills, skill],
    }));
  };

  const toggleStudyDay = (day: number) => {
    setGoal((current) => {
      const next = current.studyDays.includes(day)
        ? current.studyDays.filter((item) => item !== day)
        : [...current.studyDays, day].sort((a, b) => a - b);
      return { ...current, studyDays: next.length > 0 ? next : current.studyDays };
    });
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <h2 className="type-heading-lg font-bold text-on-surface">
          {t("goal_title")}
        </h2>
        <p className="mt-2 type-body text-on-surface-variant">
          {t("goal_body")}
        </p>
      </div>
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("overall_target")}>
            <Select
              value={String(goal.targetOverallBand)}
              onChange={(event) =>
                setGoal((current) => ({
                  ...current,
                  targetOverallBand: Number(event.target.value),
                }))
              }
            >
              {BAND_OPTIONS.map((band) => (
                <option key={band} value={band}>
                  {formatBand(band)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("test_date")}>
            <Input
              type="date"
              value={goal.targetTestDate}
              onChange={(event) =>
                setGoal((current) => ({
                  ...current,
                  targetTestDate: event.target.value,
                }))
              }
            />
          </Field>
        </div>

        <div className="grid gap-3">
          <p className="type-body-sm font-semibold text-on-surface">
            {t("skill_targets")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {IELTS_SKILLS.map((skill) => (
              <Field key={skill} label={t(`skills.${skill}`)}>
                <Select
                  value={goal.targetSkillBands[skill]}
                  onChange={(event) =>
                    setGoal((current) => ({
                      ...current,
                      targetSkillBands: {
                        ...current.targetSkillBands,
                        [skill]: event.target.value,
                      },
                    }))
                  }
                >
                  <option value="">{t("same_as_overall")}</option>
                  {BAND_OPTIONS.map((band) => (
                    <option key={band} value={band}>
                      {formatBand(band)}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        </div>

        <ChoiceGroup label={t("focus_skills")}>
          {IELTS_SKILLS.map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={() => toggleFocusSkill(skill)}
              className={choiceClass(goal.focusSkills.includes(skill))}
            >
              {t(`skills.${skill}`)}
            </button>
          ))}
        </ChoiceGroup>

        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <ChoiceGroup label={t("study_days")}>
            {DAY_OPTIONS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleStudyDay(day)}
                className={choiceClass(goal.studyDays.includes(day))}
              >
                {t(`days.${day}`)}
              </button>
            ))}
          </ChoiceGroup>
          <Field label={t("daily_minutes")}>
            <Input
              type="number"
              min={5}
              max={240}
              step={5}
              value={goal.dailyMinutes}
              onChange={(event) =>
                setGoal((current) => ({
                  ...current,
                  dailyMinutes: Number(event.target.value),
                }))
              }
            />
          </Field>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-outline-variant pt-4">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
            onClick={onBack}
          >
            {t("back")}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
          >
            {isPending ? t("saving") : t("save_goal")}
            <ArrowRight className="size-4" />
          </button>
        </div>
      </form>
    </section>
  );
}
