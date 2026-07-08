"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { RefreshCw, SlidersHorizontal } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Field,
  ChoiceGroup,
  choiceClass,
} from "@/components/ielts/onboarding/IeltsOnboardingShared";
import { showToast } from "@/components/shared/toast";
import { goalToState, type GoalState } from "@/components/ielts/onboarding/types";
import { updateIeltsStudyPlanGoalAction } from "@/app/actions/ielts/study-plan";
import {
  IELTS_SKILLS,
  type IeltsGoalModel,
  type IeltsModule,
  type IeltsSkill,
} from "@/lib/ielts/adaptive/contracts";
import { formatBand } from "@/lib/ielts/learner/summary";
import { cn } from "@/lib/utils";
import { SkillBadge, formatShortDate } from "./shared";

const BAND_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const LANGUAGES: Array<"en" | "vi"> = ["en", "vi"];

/** Build the goal payload from form state, preserving the plan's module. */
function toGoal(state: GoalState, module: IeltsModule): IeltsGoalModel {
  const targetSkillBands = Object.fromEntries(
    Object.entries(state.targetSkillBands).map(([skill, value]) => [
      skill,
      value ? Number(value) : null,
    ]),
  ) as IeltsGoalModel["targetSkillBands"];

  return {
    module,
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

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-container-low px-3 py-2">
      <p className="type-caption font-semibold uppercase text-on-surface-variant">{label}</p>
      <p className="type-body-sm font-bold text-on-surface">{value}</p>
    </div>
  );
}

function GoalSummary({ goal, onEdit }: { goal: IeltsGoalModel; onEdit: () => void }) {
  const t = useTranslations("ielts.studyPlan");
  const locale = useLocale();
  const skillTargets = IELTS_SKILLS.filter(
    (skill) => goal.targetSkillBands[skill] != null,
  );

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatPill label={t("overall_target")} value={formatBand(goal.targetOverallBand)} />
        <StatPill label={t("test_date")} value={formatShortDate(goal.targetTestDate, locale)} />
        <StatPill
          label={t("daily_minutes")}
          value={t("minutes", { count: goal.availability.dailyMinutes })}
        />
        <StatPill
          label={t("study_days")}
          value={goal.availability.studyDays
            .map((day) => t(`days.${day}`))
            .join(" · ")}
        />
      </div>

      {goal.focusSkills && goal.focusSkills.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-caption font-semibold uppercase text-on-surface-variant">
            {t("focus_skills")}
          </span>
          {goal.focusSkills.map((skill) => (
            <SkillBadge key={skill} skill={skill} />
          ))}
        </div>
      ) : null}

      {skillTargets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-caption font-semibold uppercase text-on-surface-variant">
            {t("skill_targets")}
          </span>
          {skillTargets.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-1.5 py-1 type-caption font-semibold text-on-surface-variant"
            >
              <SkillBadge skill={skill} />
              {formatBand(goal.targetSkillBands[skill])}
            </span>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onEdit}
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "w-fit")}
      >
        <SlidersHorizontal className="size-4" />
        {t("edit")}
      </button>
    </div>
  );
}

export function StudyPlanGoal({
  goal,
  module,
}: {
  goal: IeltsGoalModel;
  module: IeltsModule;
}) {
  const t = useTranslations("ielts.studyPlan");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<GoalState>(() => goalToState(goal));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openEdit = () => {
    setForm(goalToState(goal));
    setError(null);
    setEditing(true);
  };

  const toggleFocusSkill = (skill: IeltsSkill) => {
    setForm((current) => ({
      ...current,
      focusSkills: current.focusSkills.includes(skill)
        ? current.focusSkills.filter((item) => item !== skill)
        : [...current.focusSkills, skill],
    }));
  };

  const toggleStudyDay = (day: number) => {
    setForm((current) => {
      const next = current.studyDays.includes(day)
        ? current.studyDays.filter((item) => item !== day)
        : [...current.studyDays, day].sort((a, b) => a - b);
      return { ...current, studyDays: next.length > 0 ? next : current.studyDays };
    });
  };

  const submit = () => {
    startTransition(async () => {
      setError(null);
      try {
        await updateIeltsStudyPlanGoalAction(toGoal(form, module));
        setEditing(false);
        showToast(t("goal_saved"), "success");
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : t("error_generic");
        setError(message);
        showToast(message, "error");
      }
    });
  };

  if (!editing) {
    return <GoalSummary goal={goal} onEdit={openEdit} />;
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {error ? (
        <p className="rounded-lg bg-error-container px-4 py-3 type-body-sm font-medium text-error">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("overall_target")}>
          <Select
            value={String(form.targetOverallBand)}
            onChange={(event) =>
              setForm((current) => ({
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
            value={form.targetTestDate}
            onChange={(event) =>
              setForm((current) => ({ ...current, targetTestDate: event.target.value }))
            }
          />
        </Field>
      </div>

      <div className="grid gap-3">
        <p className="type-body-sm font-semibold text-on-surface">{t("skill_targets")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {IELTS_SKILLS.map((skill) => (
            <Field key={skill} label={t(`skills.${skill}`)}>
              <Select
                value={form.targetSkillBands[skill]}
                onChange={(event) =>
                  setForm((current) => ({
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
            className={choiceClass(form.focusSkills.includes(skill))}
          >
            {t(`skills.${skill}`)}
          </button>
        ))}
      </ChoiceGroup>
      <p className="-mt-3 type-caption text-on-surface-variant">{t("focus_hint")}</p>

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <ChoiceGroup label={t("study_days")}>
          {DAY_OPTIONS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleStudyDay(day)}
              className={choiceClass(form.studyDays.includes(day))}
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
            value={form.dailyMinutes}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                dailyMinutes: Number(event.target.value),
              }))
            }
          />
        </Field>
      </div>

      <ChoiceGroup label={t("feedback_language")}>
        {LANGUAGES.map((language) => (
          <button
            key={language}
            type="button"
            onClick={() => setForm((current) => ({ ...current, feedbackLanguage: language }))}
            className={choiceClass(form.feedbackLanguage === language)}
          >
            {t(`lang.${language}`)}
          </button>
        ))}
      </ChoiceGroup>

      <div className="flex flex-wrap justify-end gap-3 border-t border-outline-variant pt-4">
        <button
          type="button"
          className={cn(buttonVariants({ variant: "ghost" }))}
          onClick={() => setEditing(false)}
          disabled={isPending}
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className={cn(buttonVariants({ variant: "primary" }))}
        >
          <RefreshCw className={cn("size-4", isPending && "animate-spin")} />
          {isPending ? t("saving") : t("save_goal")}
        </button>
      </div>
    </form>
  );
}
