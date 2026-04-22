"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PracticeLaunchpad } from "./practice-launchpad";
import { ContinueLearningCard } from "./continue-learning-card";
import { AiCoachWidget } from "./ai-coach-widget";
import type { EnrollmentWithCourse } from "@/lib/api/dashboard";

interface DashboardFocusPanelProps {
  enrollments: EnrollmentWithCourse[];
  isAdmin: boolean;
}

export function DashboardFocusPanel({
  enrollments,
  isAdmin,
}: DashboardFocusPanelProps) {
  const t = useTranslations("dashboard.home");

  return (
    <Tabs
      defaultValue="practice"
      className="min-w-0 rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest p-5 soft-shadow sm:p-6"
    >
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("focus_eyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-on-surface">
            {t("focus_title")}
          </h2>
        </div>

        <TabsList className="w-full rounded-full bg-surface-container-low p-1 sm:w-auto">
          <TabsTrigger
            value="practice"
            className="rounded-full px-4 data-active:bg-primary data-active:text-on-primary"
          >
            {t("focus_tabs.practice")}
          </TabsTrigger>
          <TabsTrigger
            value="courses"
            className="rounded-full px-4 data-active:bg-primary data-active:text-on-primary"
          >
            {t("focus_tabs.courses")}
          </TabsTrigger>
          <TabsTrigger
            value="coach"
            className="rounded-full px-4 data-active:bg-primary data-active:text-on-primary"
          >
            {t("focus_tabs.coach")}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="practice" className="mt-0">
        <div className="mb-4">
          <p className="text-sm leading-6 text-on-surface-variant">
            {t("launchpad_subtitle")}
          </p>
        </div>
        <PracticeLaunchpad embedded />
      </TabsContent>

      <TabsContent value="courses" className="mt-0">
        <ContinueLearningCard
          enrollments={enrollments}
          isAdmin={isAdmin}
          compact
        />
      </TabsContent>

      <TabsContent value="coach" className="mt-0">
        <AiCoachWidget compact />
      </TabsContent>
    </Tabs>
  );
}
