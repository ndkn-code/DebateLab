"use client";

import { useTranslations } from "next-intl";
import { BookOpen, CheckCircle2, Layers3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { LessonWithContext } from "@/lib/api/courses";

interface LessonProgressCardProps {
  lesson: LessonWithContext;
}

export function LessonProgressCard({ lesson }: LessonProgressCardProps) {
  const t = useTranslations("dashboard.courses");

  return (
    <Card className="rounded-[1.5rem] border border-outline-variant/15 bg-surface-container-lowest py-0 soft-shadow">
      <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <Layers3 className="h-4 w-4" />
            {t("lesson.this_module")}
          </div>
          <div>
            <p className="text-base font-semibold text-on-surface">{lesson.module.title}</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {t("lesson.module_position", {
                current: lesson.moduleLessonIndex,
                total: lesson.moduleTotalLessons,
              })}
            </p>
          </div>
          <Progress
            value={
              lesson.moduleTotalLessons > 0
                ? Math.round(
                    (lesson.moduleCompletedLessons / lesson.moduleTotalLessons) * 100
                  )
                : 0
            }
          />
          <p className="text-xs text-on-surface-variant">
            {t("lesson.module_lessons_completed", {
              completed: lesson.moduleCompletedLessons,
              total: lesson.moduleTotalLessons,
            })}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <BookOpen className="h-4 w-4" />
            {t("lesson.course_progress")}
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-on-surface">{lesson.course.title}</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                {t("lesson.lessons_completed", {
                  completed: lesson.courseCompletedLessons,
                  total: lesson.courseTotalLessons,
                })}
              </p>
            </div>
            {lesson.progress?.status === "completed" ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            ) : null}
          </div>
          <Progress value={lesson.courseProgressPercent} />
          <p className="text-xs text-on-surface-variant">
            {t("lesson.complete", { progress: lesson.courseProgressPercent })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
