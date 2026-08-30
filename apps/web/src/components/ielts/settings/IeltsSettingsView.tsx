"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft } from "@/components/ui/icons";
import { PageTransition } from "@/components/shared/page-motion";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { saveSettings } from "@/app/[locale]/(protected)/settings/actions";
import { updateIeltsStudyPlanGoalAction } from "@/app/actions/ielts/study-plan";
import { Link } from "@/i18n/navigation";
import type { IeltsGoalModel } from "@/lib/ielts/adaptive/contracts";
import type { SettingsDraft, SettingsLocale } from "@/lib/settings";
import { IELTS_SETTINGS_COPY } from "./copy";
import {
  AudioReadinessSettings,
  checkMicrophoneReadiness,
  ExamDisplaySettings,
  NotificationSettings,
  PrivacySettings,
  type AudioState,
  type NotificationDraft,
} from "./IeltsDeviceSettings";
import {
  CoachingSettings,
  GoalSettings,
  WeeklySettings,
  type PlanSettingsDraft,
} from "./IeltsPlanSettings";
import { SaveBar, settingsSaveState } from "./IeltsSettingsPrimitives";

function different(left: object, right: object) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

export function IeltsSettingsView({
  locale,
  goal,
  initialSettings,
}: {
  locale: SettingsLocale;
  goal: IeltsGoalModel | null;
  initialSettings: SettingsDraft;
}) {
  const copy = IELTS_SETTINGS_COPY[locale];
  const [planDraft, setPlanDraft] = useState<PlanSettingsDraft>(() => ({
    timezone: goal?.availability.timezone ?? "Asia/Ho_Chi_Minh",
    feedbackLanguage: goal?.feedbackLanguage ?? locale,
  }));
  const [savedPlan, setSavedPlan] = useState(planDraft);
  const [notificationDraft, setNotificationDraft] = useState<NotificationDraft>(
    () => ({
      practiceReminders: initialSettings.practiceReminders,
      emailNotifications: initialSettings.emailNotifications,
    }),
  );
  const [savedNotifications, setSavedNotifications] =
    useState(notificationDraft);
  const [planError, setPlanError] = useState(false);
  const [notificationError, setNotificationError] = useState(false);
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const [isPlanPending, startPlanTransition] = useTransition();
  const [isNotificationPending, startNotificationTransition] = useTransition();
  const planDirty = useMemo(
    () => different(planDraft, savedPlan),
    [planDraft, savedPlan],
  );
  const notificationsDirty = useMemo(
    () => different(notificationDraft, savedNotifications),
    [notificationDraft, savedNotifications],
  );

  const savePlan = () => {
    if (!goal || !planDirty) return;
    startPlanTransition(async () => {
      setPlanError(false);
      try {
        await updateIeltsStudyPlanGoalAction({
          ...goal,
          feedbackLanguage: planDraft.feedbackLanguage,
          availability: { ...goal.availability, timezone: planDraft.timezone },
        });
        setSavedPlan(planDraft);
      } catch {
        setPlanError(true);
      }
    });
  };

  const saveNotifications = () => {
    if (!notificationsDirty) return;
    startNotificationTransition(async () => {
      setNotificationError(false);
      try {
        const result = await saveSettings({
          ...initialSettings,
          practiceReminders: notificationDraft.practiceReminders,
          emailNotifications: notificationDraft.emailNotifications,
        });
        const next = {
          practiceReminders: result.saved.practiceReminders,
          emailNotifications: result.saved.emailNotifications,
        };
        setNotificationDraft(next);
        setSavedNotifications(next);
      } catch {
        setNotificationError(true);
      }
    });
  };

  const planProps = {
    copy,
    goal,
    planDraft,
    setPlanDraft,
    saveState: settingsSaveState({
      error: planError,
      pending: isPlanPending,
      dirty: planDirty,
    }),
    isPending: isPlanPending,
    isDirty: planDirty,
    onSave: savePlan,
  };

  return (
    <PageTransition>
      <ProductPageShell>
        <PageContainer
          size="standard"
          className="flex flex-col gap-5 py-5 lg:py-6"
        >
          <Link
            href="/ielts/home"
            className="inline-flex w-fit items-center gap-1 type-body-sm font-semibold text-on-surface-variant outline-none hover:text-on-surface focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <ArrowLeft className="size-4" />
            {copy.back}
          </Link>
          <header className="max-w-2xl">
            <p className="type-label font-semibold uppercase text-primary">
              {copy.eyebrow}
            </p>
            <h1 className="mt-1 type-heading-lg font-semibold text-on-surface md:type-heading-xl">
              {copy.title}
            </h1>
            <p className="mt-2 type-body text-on-surface-variant">
              {copy.intro}
            </p>
          </header>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="grid gap-4">
              <GoalSettings copy={copy} locale={locale} goal={goal} />
              <WeeklySettings {...planProps} />
              <ExamDisplaySettings copy={copy} />
            </div>
            <div className="grid gap-4">
              <AudioReadinessSettings
                copy={copy}
                state={audioState}
                onCheck={() => void checkMicrophoneReadiness(setAudioState)}
              />
              <CoachingSettings {...planProps} />
              <NotificationSettings
                copy={copy}
                draft={notificationDraft}
                setDraft={setNotificationDraft}
                saveState={settingsSaveState({
                  error: notificationError,
                  pending: isNotificationPending,
                  dirty: notificationsDirty,
                })}
                isDirty={notificationsDirty}
                isPending={isNotificationPending}
                onSave={saveNotifications}
              />
              <PrivacySettings copy={copy} />
            </div>
          </div>
          {goal ? (
            <div className="rounded-xl border border-outline-variant bg-surface-container px-4 py-4 sm:px-5">
              <p className="type-caption text-on-surface-variant">
                {copy.planSaveNote}
              </p>
              <SaveBar
                copy={copy}
                state={planProps.saveState}
                disabled={!planDirty || isPlanPending}
                pending={isPlanPending}
                onSave={savePlan}
              />
            </div>
          ) : null}
        </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}
