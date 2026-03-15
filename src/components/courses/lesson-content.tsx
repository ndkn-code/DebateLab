"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  const isCompleted = lesson.progress?.status === "completed";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
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

      {/* Lesson Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-on-surface">{lesson.title}</h1>
          {isCompleted && (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          )}
        </div>
        <p className="mt-1 text-sm text-on-surface-variant">
          {lesson.type} &middot; {lesson.duration_minutes} min
        </p>
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
      <div className="flex items-center justify-between border-t border-outline-variant/10 pt-6">
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
              <span className="sm:hidden">Previous</span>
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
              <span className="sm:hidden">Next</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <Link href={`/courses/${courseSlug}`}>
            <Button className="gap-2 bg-primary text-on-primary">
              Back to Course
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
