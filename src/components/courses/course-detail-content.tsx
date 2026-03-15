"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Clock,
  BarChart3,
  CheckCircle2,
  FileText,
  Play,
  HelpCircle,
  Mic2,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { enrollAction } from "@/app/(protected)/courses/actions";
import type { CourseWithModules } from "@/lib/api/courses";

const LESSON_ICONS = {
  article: FileText,
  video: Play,
  quiz: HelpCircle,
  practice: Mic2,
};

const DIFFICULTY_COLORS = {
  beginner: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  intermediate: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  advanced: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

interface CourseDetailContentProps {
  course: CourseWithModules;
  userId: string;
}

export function CourseDetailContent({
  course,
  userId,
}: CourseDetailContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEnrolled, setIsEnrolled] = useState(!!course.enrollment);

  const handleEnroll = () => {
    startTransition(async () => {
      await enrollAction(course.id);
      setIsEnrolled(true);
      router.refresh();
    });
  };

  const totalLessons = course.total_lessons;
  const completedLessons = course.completed_lessons;
  const progress = course.enrollment?.progress_percent ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
      {/* Back link */}
      <Link
        href="/courses"
        className="mb-6 inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All Courses
      </Link>

      {/* Course Header */}
      <div className="mb-8 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 sm:p-8 soft-shadow">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="mb-3 flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs px-2 py-0.5",
                  DIFFICULTY_COLORS[course.difficulty]
                )}
              >
                {course.difficulty}
              </Badge>
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                {course.category}
              </Badge>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-on-surface sm:text-3xl">
              {course.title}
            </h1>
            <p className="text-on-surface-variant">{course.description}</p>

            {/* Meta */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {course.estimated_hours} hours
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                {totalLessons} lessons
              </span>
              <span className="flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" />
                {course.modules.length} modules
              </span>
            </div>
          </div>

          <div className="shrink-0 sm:text-right">
            {!isEnrolled ? (
              <Button
                onClick={handleEnroll}
                disabled={isPending}
                className="w-full bg-primary text-on-primary sm:w-auto"
                size="lg"
              >
                {isPending ? "Enrolling..." : "Enroll Now"}
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="text-right text-sm text-on-surface-variant">
                  {completedLessons} / {totalLessons} completed
                </div>
                <div className="h-2 w-48 overflow-hidden rounded-full bg-surface-container">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-right text-xs text-on-surface-variant">
                  {progress}% complete
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Module Accordion */}
      <h2 className="mb-4 text-lg font-semibold text-on-surface">
        Course Content
      </h2>

      <Accordion defaultValue={[0]}>
        {course.modules.map((mod, modIdx) => (
          <AccordionItem
            key={mod.id}
            value={modIdx}
            className="mb-3 overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-lowest soft-shadow"
          >
            <AccordionTrigger className="px-5 py-4 hover:no-underline">
              <div className="flex flex-1 flex-col gap-1 pr-4">
                <span className="text-base font-semibold text-on-surface">
                  {mod.title}
                </span>
                {mod.description && (
                  <span className="text-xs text-on-surface-variant">
                    {mod.description}
                  </span>
                )}
                <span className="text-xs text-on-surface-variant">
                  {mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-3">
              <div className="space-y-1">
                {mod.lessons.map((lesson) => {
                  const Icon = LESSON_ICONS[lesson.type];
                  return (
                    <Link
                      key={lesson.id}
                      href={
                        isEnrolled
                          ? `/courses/${course.slug}/lessons/${lesson.slug}`
                          : "#"
                      }
                      onClick={(e) => {
                        if (!isEnrolled) e.preventDefault();
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                        isEnrolled
                          ? "hover:bg-surface-container cursor-pointer"
                          : "opacity-60 cursor-not-allowed"
                      )}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container">
                        <Icon className="h-4 w-4 text-on-surface-variant" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-on-surface">
                          {lesson.title}
                        </p>
                        <p className="text-[10px] text-on-surface-variant">
                          {lesson.type} &middot; {lesson.duration_minutes} min
                        </p>
                      </div>
                      {isEnrolled && (
                        <ChevronRight className="h-4 w-4 shrink-0 text-on-surface-variant" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
