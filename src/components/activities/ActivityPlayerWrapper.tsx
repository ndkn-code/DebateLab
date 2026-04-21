"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import type { Activity, ActivityType } from "@/lib/types/admin";
import { useActivityPlayerStore } from "@/lib/stores/activityPlayerStore";
import { completeActivity } from "@/app/actions/activities";
import { getElapsedSecondsSince } from "@/lib/time";
import { TopProgressBar } from "./TopProgressBar";
import { ActivityCompletionScreen } from "./ActivityCompletionScreen";
import { ModuleCompletionScreen } from "./ModuleCompletionScreen";
import { CourseCompletionScreen } from "./CourseCompletionScreen";
import { QuizPlayer } from "./QuizPlayer";
import { MatchingPlayer } from "./MatchingPlayer";
import { FillBlankPlayer } from "./FillBlankPlayer";
import { DragOrderPlayer } from "./DragOrderPlayer";
import { FlashcardPlayer } from "./FlashcardPlayer";
import { LessonPlayer } from "./LessonPlayer";

interface ActivitySummary {
  id: string;
  title: string;
  order_index: number;
  activity_type: ActivityType;
}

interface ModuleSummary {
  id: string;
  title: string;
  activities: ActivitySummary[];
}

interface Props {
  activity: Activity;
  courseId: string;
  courseTitle: string;
  currentModule: ModuleSummary;
  allModules: ModuleSummary[];
  completedActivityIds: string[];
  previewMode?: boolean;
  courseOverviewHref?: string;
}

type PlayerState = "playing" | "completed" | "module_complete" | "course_complete";

// XP calculation
function calculateXP(activityType: ActivityType, score: number, maxScore: number): number {
  if (activityType === "lesson") return 10;
  if (activityType === "flashcard") return maxScore > 0 ? Math.round((score / maxScore) * 10) : 5;
  return maxScore > 0 ? Math.round((score / maxScore) * 15) : 0;
}

export function ActivityPlayerWrapper({
  activity,
  courseId,
  courseTitle,
  currentModule,
  allModules,
  completedActivityIds: initialCompletedIds,
  previewMode = false,
  courseOverviewHref,
}: Props) {
  const t = useTranslations("courses.player");
  const router = useRouter();
  const { sessionXP, addSessionXP, markActivityCompleted, enterActivityMode, exitActivityMode } = useActivityPlayerStore();

  const [state, setState] = useState<PlayerState>("playing");
  const [score, setScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [completedIds, setCompletedIds] = useState(new Set(initialCompletedIds));
  const startTime = useRef<number | null>(null);

  // Enter activity mode on mount
  useEffect(() => {
    enterActivityMode();
    startTime.current = Date.now();
    return () => exitActivityMode();
  }, [enterActivityMode, exitActivityMode]);

  // Find siblings, prev/next
  const siblings = currentModule.activities;
  const currentIdx = siblings.findIndex((s) => s.id === activity.id);
  const nextActivity = currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

  // Find next module
  const moduleIdx = allModules.findIndex((m) => m.id === currentModule.id);
  const nextModule = moduleIdx < allModules.length - 1 ? allModules[moduleIdx + 1] : null;
  const isLastModule = moduleIdx === allModules.length - 1;

  const handleComplete = useCallback(
    async (s?: number, ms?: number, responses?: Record<string, unknown>) => {
      const finalScore = s ?? 1;
      const finalMaxScore = ms ?? 1;
      const elapsed = getElapsedSecondsSince(startTime.current);
      const xp = calculateXP(activity.activity_type, finalScore, finalMaxScore);

      setScore(finalScore);
      setMaxScore(finalMaxScore);
      setXpEarned(xp);
      addSessionXP(xp);
      markActivityCompleted(activity.id);
      setCompletedIds((prev) => new Set([...prev, activity.id]));

      // Save to server
      if (!previewMode) {
        try {
          await completeActivity(activity.id, courseId, finalScore, finalMaxScore, responses ?? {}, xp, elapsed);
        } catch {
          // Don't block the UI
        }
      }

      // Determine next state
      const newCompleted = new Set([...completedIds, activity.id]);
      const allModuleActivitiesComplete = siblings.every((s) => newCompleted.has(s.id));
      const allCourseActivitiesComplete = allModules.every((m) =>
        m.activities.every((a) => newCompleted.has(a.id))
      );

      if (allCourseActivitiesComplete) {
        setState("course_complete");
      } else if (allModuleActivitiesComplete && !nextActivity) {
        setState("module_complete");
      } else {
        setState("completed");
      }
    },
    [activity, courseId, addSessionXP, markActivityCompleted, completedIds, siblings, allModules, nextActivity, previewMode]
  );

  const handleContinue = () => {
    if (nextActivity) {
      router.push(`/dashboard/courses/${courseId}/activity/${nextActivity.id}${previewMode ? "?preview=1" : ""}`);
    } else if (nextModule && nextModule.activities.length > 0) {
      router.push(`/dashboard/courses/${courseId}/activity/${nextModule.activities[0].id}${previewMode ? "?preview=1" : ""}`);
    } else {
      router.push(courseOverviewHref ?? `/dashboard/courses/${courseId}`);
    }
  };

  const renderPlayer = () => {
    const onComplete = handleComplete;
    switch (activity.activity_type) {
      case "quiz":
        return <QuizPlayer content={activity.content} onComplete={onComplete} />;
      case "matching":
        return <MatchingPlayer content={activity.content} onComplete={onComplete} />;
      case "fill_blank":
        return <FillBlankPlayer content={activity.content} onComplete={onComplete} />;
      case "drag_order":
        return <DragOrderPlayer content={activity.content} onComplete={onComplete} />;
      case "flashcard":
        return <FlashcardPlayer content={activity.content} onComplete={onComplete} />;
      case "lesson":
        return <LessonPlayer content={activity.content} onComplete={() => onComplete(1, 1, {})} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
            <p className="text-lg mb-4">This activity isn&apos;t available yet.</p>
            <button onClick={() => onComplete(0, 0, {})} className="rounded-2xl bg-primary px-6 py-3 text-base font-semibold text-on-primary">
              {t("skipActivity")}
            </button>
          </div>
        );
    }
  };

  // Total XP for module completion
  const moduleTotalXP = sessionXP;

  // Course total stats
  const totalCourseActivities = allModules.reduce((sum, m) => sum + m.activities.length, 0);

  return (
    <div className="flex flex-col min-h-screen bg-[#fbf8ff]">
      {/* Top progress bar */}
      <TopProgressBar
        activities={siblings}
        currentActivityId={activity.id}
        completedIds={completedIds}
        sessionXP={sessionXP}
        moduleName={currentModule.title}
        courseId={courseId}
        courseOverviewHref={courseOverviewHref}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {state === "playing" && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col justify-center py-8"
            >
              {/* Activity header */}
              <div className="text-center mb-6 px-4">
                <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
                  <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-lg ${
                    activity.phase === "learn"
                      ? "bg-green-100 text-green-700"
                      : activity.phase === "practice"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {activity.phase}
                  </span>
                  {previewMode ? (
                    <span className="inline-block rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      {t("adminPreview")}
                    </span>
                  ) : null}
                </div>
                <h1 className="text-lg font-bold text-on-surface">{activity.title}</h1>
              </div>

              {/* Player */}
              {renderPlayer()}
            </motion.div>
          )}

          {state === "completed" && (
            <motion.div key="completed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ActivityCompletionScreen
                activityType={activity.activity_type}
                score={score}
                maxScore={maxScore}
                xpEarned={xpEarned}
                onContinue={handleContinue}
                nextActivityTitle={nextActivity?.title}
              />
            </motion.div>
          )}

          {state === "module_complete" && (
            <motion.div key="module_complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ModuleCompletionScreen
                moduleTitle={currentModule.title}
                moduleTotalXP={moduleTotalXP}
                activitiesCompleted={siblings.length}
                nextModuleTitle={nextModule?.title}
                courseId={courseId}
                nextModuleFirstActivityId={nextModule?.activities?.[0]?.id}
                isLastModule={isLastModule}
                courseOverviewHref={courseOverviewHref}
                nextModuleHref={
                  nextModule?.activities?.[0]?.id
                    ? `/dashboard/courses/${courseId}/activity/${nextModule.activities[0].id}${previewMode ? "?preview=1" : ""}`
                    : undefined
                }
              />
            </motion.div>
          )}

          {state === "course_complete" && (
            <motion.div key="course_complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CourseCompletionScreen
                courseTitle={courseTitle}
                totalXP={moduleTotalXP}
                totalActivities={totalCourseActivities}
                totalModules={allModules.length}
                previewMode={previewMode}
                courseOverviewHref={courseOverviewHref}
                editorHref={`/dashboard/admin/courses/${courseId}`}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
