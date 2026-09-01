import type { Dispatch, SetStateAction } from "react";
import {
  ArrowRight,
  CalendarDays,
  Languages,
  Target,
} from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import type { IeltsGoalModel } from "@/lib/ielts/adaptive/contracts";
import type { SettingsLocale } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { IELTS_SETTINGS_TIMEZONES, type IeltsSettingsCopy } from "./copy";
import {
  LabeledValue,
  SettingsSection,
  type SaveStateValue,
} from "./IeltsSettingsPrimitives";

export interface PlanSettingsDraft {
  timezone: string;
  feedbackLanguage: "en" | "vi";
}

interface SharedPlanProps {
  copy: IeltsSettingsCopy;
  goal: IeltsGoalModel | null;
  planDraft: PlanSettingsDraft;
  setPlanDraft: Dispatch<SetStateAction<PlanSettingsDraft>>;
  saveState: SaveStateValue;
  isPending: boolean;
  isDirty: boolean;
  onSave: () => void;
}

export function GoalSettings({
  copy,
  locale,
  goal,
}: {
  copy: IeltsSettingsCopy;
  locale: SettingsLocale;
  goal: IeltsGoalModel | null;
}) {
  const formatter = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-GB",
    {
      dateStyle: "medium",
    },
  );
  return (
    <SettingsSection
      icon={<Target />}
      title={copy.goalTitle}
      caption={copy.goalCaption}
      defaultOpen
    >
      {goal ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <LabeledValue
              label={copy.overallBand}
              value={goal.targetOverallBand.toFixed(1)}
            />
            <LabeledValue
              label={copy.testDate}
              value={formatter.format(
                new Date(`${goal.targetTestDate}T12:00:00`),
              )}
            />
            <LabeledValue
              label={copy.testType}
              value={
                goal.module === "general_training"
                  ? copy.generalTraining
                  : copy.academic
              }
            />
          </div>
          <Link
            href="/ielts/study-plan"
            className={cn(buttonVariants({ variant: "secondary" }), "w-fit")}
          >
            {copy.editPlan}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="type-body-sm text-on-surface-variant">{copy.noGoal}</p>
          <Link
            href="/ielts/onboarding"
            className={buttonVariants({ variant: "primary" })}
          >
            {copy.setGoal}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </SettingsSection>
  );
}

export function WeeklySettings(props: SharedPlanProps) {
  const { copy, goal, planDraft, setPlanDraft } = props;
  const dayLabels = [
    copy.monday,
    copy.tuesday,
    copy.wednesday,
    copy.thursday,
    copy.friday,
    copy.saturday,
    copy.sunday,
  ];
  return (
    <SettingsSection
      icon={<CalendarDays />}
      title={copy.weeklyTitle}
      caption={copy.weeklyCaption}
    >
      {goal ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            <LabeledValue
              label={copy.studyDays}
              value={goal.availability.studyDays
                .map((day) => dayLabels[day - 1])
                .filter(Boolean)
                .join(" · ")}
            />
            <LabeledValue
              label={copy.dailyTime}
              value={copy.minutes.replace(
                "{count}",
                String(goal.availability.dailyMinutes),
              )}
            />
          </div>
          <label className="grid gap-1.5 type-body-sm font-semibold text-on-surface">
            {copy.timezone}
            <Select
              value={planDraft.timezone}
              onChange={(event) =>
                setPlanDraft((current) => ({
                  ...current,
                  timezone: event.target.value,
                }))
              }
            >
              {IELTS_SETTINGS_TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </label>
          <p className="type-caption text-on-surface-variant">
            {copy.timezoneHint}
          </p>
          <p className="type-caption text-on-surface-variant">
            {copy.planSaveNote}
          </p>
        </div>
      ) : (
        <p className="type-body-sm text-on-surface-variant">{copy.noGoal}</p>
      )}
    </SettingsSection>
  );
}

export function CoachingSettings(props: SharedPlanProps) {
  const { copy, goal, planDraft, setPlanDraft } = props;
  return (
    <SettingsSection
      icon={<Languages />}
      title={copy.coachTitle}
      caption={copy.coachCaption}
    >
      {goal ? (
        <fieldset className="grid gap-3">
          <legend className="type-body-sm font-semibold text-on-surface">
            {copy.feedbackLanguage}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {(["en", "vi"] as const).map((language) => (
              <label
                key={language}
                className={cn(
                  "grid min-h-11 cursor-pointer place-items-center rounded-control border px-3 type-body-sm font-semibold outline-none transition-colors focus-within:ring-3 focus-within:ring-ring/40",
                  planDraft.feedbackLanguage === language
                    ? "border-primary bg-primary-container text-on-primary-container"
                    : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-high",
                )}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="ielts-feedback-language"
                  value={language}
                  checked={planDraft.feedbackLanguage === language}
                  onChange={() =>
                    setPlanDraft((current) => ({
                      ...current,
                      feedbackLanguage: language,
                    }))
                  }
                />
                {language === "en" ? copy.english : copy.vietnamese}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="type-body-sm text-on-surface-variant">{copy.noGoal}</p>
      )}
      <div className="mt-4 rounded-lg border border-outline-variant p-3">
        <p className="type-body-sm font-semibold text-on-surface">
          {copy.coachStyle}
        </p>
        <p className="mt-1 type-caption text-on-surface-variant">
          {copy.coachStyleBody}
        </p>
      </div>
    </SettingsSection>
  );
}
