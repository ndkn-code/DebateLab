"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Layers3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LessonProgressCard } from "@/components/courses/lesson-progress-card";
import { ArticleRenderer } from "./renderers/article-renderer";
import { VideoRenderer } from "./renderers/video-renderer";
import { QuizRenderer } from "./renderers/quiz-renderer";
import { PracticeRenderer } from "./renderers/practice-renderer";
import type { LessonWithContext } from "@/lib/api/courses";

interface LessonContentProps {
  lesson: LessonWithContext;
  courseSlug: string;
}

export function LessonContent({ lesson, courseSlug }: LessonContentProps) {
  const t = useTranslations("dashboard.courses");
  const isCompleted = lesson.progress?.status === "completed";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-on-surface-variant">
        <Link
          href={`/courses/${courseSlug}`}
          className="flex items-center gap-1 hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {lesson.course.title}
        </Link>
        <span>/</span>
        <span className="text-on-surface">{lesson.module.title}</span>
      </div>

      <section className="mb-6 rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest p-6 sm:p-8 soft-shadow">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{t(`types.${lesson.type}`)}</Badge>
              <Badge variant="outline">{lesson.duration_minutes} min</Badge>
              <Badge variant="outline">{lesson.module.title}</Badge>
              {isCompleted ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {t("lesson.completed")}
                </Badge>
              ) : null}
            </div>

            <h1 className="text-3xl font-bold text-on-surface sm:text-4xl">
              {lesson.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant sm:text-base">
              {t("lesson.subtitle", { course: lesson.course.title })}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                {t("lesson.minute_lesson", { minutes: lesson.duration_minutes })}
              </span>
              <span className="inline-flex items-center gap-2">
                <Layers3 className="h-4 w-4" />
                {t("lesson.module_position", {
                  current: lesson.moduleLessonIndex,
                  total: lesson.moduleTotalLessons,
                })}
              </span>
              <span className="inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {t("lesson.course_completed", {
                  completed: lesson.courseCompletedLessons,
                  total: lesson.courseTotalLessons,
                })}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-6">
        <LessonProgressCard lesson={lesson} />
      </div>

      {/* Renderer */}
      <div className="mb-8">
        {lesson.type === "article" && (
          <ArticleRenderer lesson={lesson} courseSlug={courseSlug} />
        )}
        {lesson.type === "video" && (
          <VideoRenderer lesson={lesson} courseSlug={courseSlug} />
        )}
        {lesson.type === "quiz" && (
          <QuizRenderer lesson={lesson} courseSlug={courseSlug} />
        )}
        {lesson.type === "practice" && (
          <PracticeRenderer lesson={lesson} courseSlug={courseSlug} />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between rounded-[1.5rem] border border-outline-variant/15 bg-surface-container-lowest p-5 soft-shadow">
        {lesson.prev_lesson ? (
          <Link
            href={`/courses/${courseSlug}/lessons/${lesson.prev_lesson.slug}`}
          >
            <Button
              variant="outline"
              className="gap-2 border-outline-variant/20"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{lesson.prev_lesson.title}</span>
              <span className="sm:hidden">{t("lesson.previous")}</span>
            </Button>
          </Link>
        ) : (
          <div />
        )}

        {lesson.next_lesson ? (
          <Link
            href={`/courses/${courseSlug}/lessons/${lesson.next_lesson.slug}`}
          >
            <Button className="gap-2 bg-primary text-on-primary">
              <span className="hidden sm:inline">{lesson.next_lesson.title}</span>
              <span className="sm:hidden">{t("lesson.next")}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <Link href={`/courses/${courseSlug}`}>
            <Button className="gap-2 bg-primary text-on-primary">
              {t("lesson.back_to_course")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
