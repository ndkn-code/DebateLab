"use client";

import { useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Layers3,
  Lock,
  Mic2,
  Scale,
  Sparkles,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Heading, Text } from "@/components/ui/typography";
import { ArticleRenderer } from "@/components/courses/renderers/article-renderer";
import { PracticeRenderer } from "@/components/courses/renderers/practice-renderer";
import { QuizRenderer } from "@/components/courses/renderers/quiz-renderer";
import { VideoRenderer } from "@/components/courses/renderers/video-renderer";
import {
  enrollAction,
  markLessonCompleteAction,
} from "@/app/actions/enrollment";
import { cn } from "@/lib/utils";
import type {
  CourseReaderData,
  CourseReaderLessonItem,
  LessonWithContext,
} from "@/lib/api/courses";

interface CourseDetailContentProps {
  course: CourseReaderData;
}

export function CourseDetailContent({ course }: CourseDetailContentProps) {
  const t = useTranslations("dashboard.courses");
  const tPractice = useTranslations("dashboard.practice");
  const router = useRouter();
  const [isEnrolling, startEnrollTransition] = useTransition();
  const selectedLesson = course.selectedLesson;
  const currentItem = course.lessonItems.find((item) => item.current) ?? null;
  const selectedIndex = currentItem ? currentItem.lessonNumber - 1 : 0;
  const nextLessonItem = course.nextLesson
    ? (course.lessonItems.find(
        (item) => item.slug === course.nextLesson?.slug,
      ) ?? null)
    : null;
  const isCompleted = selectedLesson?.progress?.status === "completed";
  const progress =
    course.enrollment?.progress_percent ??
    (course.total_lessons > 0
      ? Math.round((course.completed_lessons / course.total_lessons) * 100)
      : 0);
  const totalDurationMinutes = course.lessonItems.reduce(
    (sum, lesson) => sum + lesson.durationMinutes,
    0,
  );
  const estimatedHours =
    course.estimated_hours ||
    (totalDurationMinutes > 0
      ? Math.round((totalDurationMinutes / 60) * 10) / 10
      : 0);
  const difficultyLabel =
    course.difficulty === "beginner"
      ? tPractice("difficulty_beginner")
      : course.difficulty === "intermediate"
        ? tPractice("difficulty_intermediate")
        : tPractice("difficulty_advanced");
  const categoryLabel =
    course.category === "debate" ? t("tab_debate") : t("tab_speaking");
  const lessonSummary = selectedLesson
    ? getLessonSummary(selectedLesson, t)
    : t("reader.empty_state");
  const coachHref = selectedLesson
    ? `/chat?message=${encodeURIComponent(
        getCoachPrompt(selectedLesson),
      )}&context=course&contextId=${course.id}`
    : "/chat?context=course-home";

  const handleEnroll = () => {
    startEnrollTransition(async () => {
      await enrollAction(course.id);
      router.refresh();
    });
  };

  return (
    <div className="min-h-full bg-background px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/courses"
          className="mb-4 inline-flex h-8 items-center gap-2 rounded-[10px] px-2 type-label font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("detail.back")}
        </Link>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_292px]">
          <div className="min-w-0">
            <section className="rounded-xl border border-outline-variant bg-surface p-4 shadow-none sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-[10px] border border-outline-variant bg-primary-container sm:w-24">
                  {course.thumbnail_url ? (
                    <Image
                      src={course.thumbnail_url}
                      alt={course.title}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-primary">
                      {course.category === "public-speaking" ? (
                        <Mic2 className="h-10 w-10" />
                      ) : (
                        <Scale className="h-10 w-10" />
                      )}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
                    <span>{categoryLabel}</span>
                    <span className="h-1 w-1 rounded-full bg-surface-container-high" />
                    <span>{difficultyLabel}</span>
                    {course.isPreview ? (
                      <>
                        <span className="h-1 w-1 rounded-full bg-surface-container-high" />
                        <span className="inline-flex h-5 items-center rounded-[6px] bg-primary-container px-2 text-xs font-medium text-on-surface-variant">
                          {t("reader.preview_badge")}
                        </span>
                      </>
                    ) : null}
                  </div>

                  <Heading
                    level={1}
                    className="mt-2 font-semibold text-on-surface"
                  >
                    {course.title}
                  </Heading>
                  <Text className="mt-2 line-clamp-2 max-w-3xl leading-6 text-on-surface-variant">
                    {course.description || t("description_fallback")}
                  </Text>

                  <div className="mt-3 flex flex-wrap items-center gap-4 type-caption text-on-surface-variant">
                    <span className="inline-flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      {t("reader.lesson_count", {
                        count: course.total_lessons,
                      })}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Layers3 className="h-4 w-4 text-primary" />
                      {t("modules_count", { count: course.modules.length })}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-primary" />
                      {estimatedHours > 0
                        ? t("detail.total_hours", { hours: estimatedHours })
                        : t("detail.self_paced")}
                    </span>
                  </div>

                  <div className="mt-3 max-w-[430px]">
                    <p className="mb-2 text-sm font-medium text-on-surface-variant">
                      {t("detail.completed_lessons", {
                        completed: course.completed_lessons,
                        total: course.total_lessons,
                      })}
                    </p>
                    <Progress
                      value={progress}
                      className="h-2 bg-surface-container [&>div]:bg-primary"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-4 overflow-x-auto pb-2">
              <div className="flex min-w-max items-start">
                {course.lessonItems.map((item, index) => (
                  <LessonStepperItem
                    key={item.id}
                    item={item}
                    isLast={index === course.lessonItems.length - 1}
                    connectorComplete={index < selectedIndex}
                  />
                ))}
              </div>
            </section>

            {selectedLesson ? (
              <section className="mt-5 overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-none">
                <div className="border-b border-outline-variant p-4 sm:p-5">
                  <div className="min-w-0">
                    <div className="type-caption inline-flex h-5 items-center rounded-[6px] bg-primary-container px-2 font-medium text-on-surface-variant">
                      {t("reader.lesson_kicker", {
                        lesson: currentItem?.lessonNumber ?? 1,
                      })}
                    </div>
                    <Heading
                      level={1}
                      as="h2"
                      className="mt-3 font-semibold text-on-surface"
                    >
                      {selectedLesson.title}
                    </Heading>
                    <Text className="mt-2 max-w-3xl leading-6 text-on-surface-variant">
                      {lessonSummary}
                    </Text>

                    <div className="mt-3 flex flex-wrap items-center gap-4 type-caption text-on-surface-variant">
                      <span className="inline-flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-primary" />
                        {t("lesson.minute_lesson", {
                          minutes: selectedLesson.duration_minutes,
                        })}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Layers3 className="h-4 w-4 text-primary" />
                        {t("lesson.module_position", {
                          current: selectedLesson.moduleLessonIndex,
                          total: selectedLesson.moduleTotalLessons,
                        })}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        {t("lesson.course_completed", {
                          completed: selectedLesson.courseCompletedLessons,
                          total: selectedLesson.courseTotalLessons,
                        })}
                      </span>
                      {isCompleted ? (
                        <span className="inline-flex h-5 items-center gap-1.5 rounded-[6px] bg-success-container px-2 type-caption font-medium text-on-success-container">
                          <CheckCircle2 className="h-4 w-4" />
                          {t("lesson.completed")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  <ReaderLessonRenderer
                    lesson={selectedLesson}
                    courseSlug={course.slug}
                  />
                </div>

                <div className="border-t border-outline-variant px-4 py-4 sm:px-5">
                  <LessonActionBar
                    course={course}
                    lesson={selectedLesson}
                    currentItem={currentItem}
                  />
                </div>
              </section>
            ) : (
              <div className="mt-5 rounded-xl border border-outline-variant bg-surface p-5">
                <Heading
                  level={2}
                  className="font-semibold text-on-surface-variant"
                >
                  {t("reader.empty_title")}
                </Heading>
                <Text className="mt-3 max-w-2xl leading-8 text-on-surface-variant">
                  {t("reader.empty_state")}
                </Text>
              </div>
            )}
          </div>

          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-xl border border-outline-variant bg-surface p-4">
              <Heading
                level={2}
                as="p"
                className="font-semibold text-on-surface-variant"
              >
                {course.isPreview
                  ? t("reader.preview_title")
                  : t("reader.whats_next")}
              </Heading>

              {course.isPreview ? (
                <>
                  <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                    {t("reader.preview_description")}
                  </p>
                  <Button
                    onClick={handleEnroll}
                    disabled={isEnrolling}
                    className="mt-4 h-8 w-full rounded-[10px] bg-primary text-on-primary hover:bg-primary-dim"
                    size="lg"
                  >
                    {isEnrolling ? t("detail.enrolling") : t("detail.enroll")}
                  </Button>
                </>
              ) : course.nextLesson ? (
                <div className="mt-4 space-y-4">
                  <div className="flex gap-3">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-[10px] border border-outline-variant bg-primary-container">
                      {course.thumbnail_url ? (
                        <Image
                          src={course.thumbnail_url}
                          alt={course.nextLesson.title}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-primary">
                          {course.category === "public-speaking" ? (
                            <Mic2 className="h-7 w-7" />
                          ) : (
                            <Scale className="h-7 w-7" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm text-on-surface-variant">
                        {t("reader.lesson_number", {
                          current: course.nextLesson.lessonNumber,
                          total: course.lessonItems.length,
                        })}
                      </p>
                      <Heading
                        level={4}
                        as="h3"
                        className="mt-1 leading-7 text-on-surface-variant"
                      >
                        {course.nextLesson.title}
                      </Heading>
                      <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                        {course.nextLesson.summary ??
                          course.nextLesson.moduleTitle}
                      </p>
                      <div className="mt-3 inline-flex items-center gap-2 text-sm text-on-surface-variant">
                        <Clock3 className="h-4 w-4 text-primary" />
                        {t("estimated_minutes", {
                          minutes: course.nextLesson.durationMinutes,
                        })}
                      </div>
                    </div>
                  </div>

                  {nextLessonItem?.locked ? (
                    <Button
                      disabled
                      className="h-8 w-full rounded-[10px] bg-primary text-on-primary disabled:opacity-60"
                      size="lg"
                    >
                      {t("reader.next_locked")}
                    </Button>
                  ) : (
                    <Link href={course.nextLesson.href}>
                      <Button
                        className="h-8 w-full rounded-[10px] bg-primary text-on-primary hover:bg-primary-dim"
                        size="lg"
                      >
                        {t("reader.view_next_lesson")}
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="mt-3 rounded-[10px] bg-surface-container p-3 type-body-sm text-on-surface-variant">
                  {t("hero.completed_description")}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-outline-variant bg-surface p-4">
              <Heading level={3} as="p" className="text-on-surface-variant">
                {t("reader.lesson_outline")}
              </Heading>
              <div className="mt-4 space-y-1.5">
                {course.lessonItems.map((item) => (
                  <LessonOutlineItem key={item.id} item={item} />
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-primary/20 bg-primary-container/45 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-surface text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <Heading level={3} as="p" className="text-on-surface-variant">
                    {t("reader.need_help")}
                  </Heading>
                  <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                    {t("reader.need_help_description")}
                  </p>
                </div>
              </div>
              <Link href={coachHref} className="mt-5 block">
                <Button
                  className="h-8 w-full rounded-[10px] border border-outline-variant bg-surface text-on-surface hover:bg-surface-container"
                  variant="outline"
                >
                  {t("reader.ask_ai_coach")}
                </Button>
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function LessonStepperItem({
  item,
  isLast,
  connectorComplete,
}: {
  item: CourseReaderLessonItem;
  isLast: boolean;
  connectorComplete: boolean;
}) {
  const node = (
    <div className="relative z-10 flex size-10 items-center justify-center">
      {item.completed ? (
        <div className="flex size-10 items-center justify-center rounded-[10px] border border-success/30 bg-success-container text-on-success-container">
          <Check className="h-4 w-4" />
        </div>
      ) : item.current ? (
        <div className="flex size-10 items-center justify-center rounded-[10px] bg-primary text-label font-semibold text-on-primary ring-2 ring-primary-container">
          {item.lessonNumber}
        </div>
      ) : item.locked ? (
        <div className="flex size-10 items-center justify-center rounded-[10px] border border-outline-variant bg-surface-container text-on-surface-variant">
          <Lock className="h-4 w-4" />
        </div>
      ) : (
        <div className="flex size-10 items-center justify-center rounded-[10px] border border-outline-variant bg-surface type-label font-semibold text-on-surface-variant">
          {item.lessonNumber}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative flex min-w-[132px] flex-col items-center text-center">
      {!isLast ? (
        <div
          className={cn(
            "absolute left-1/2 top-5 h-px w-[calc(100%-12px)] -translate-y-1/2",
            connectorComplete ? "bg-success" : "bg-outline-variant",
          )}
        />
      ) : null}

      {item.href ? (
        <Link href={item.href} className="inline-flex">
          {node}
        </Link>
      ) : (
        node
      )}

      <span className="mt-1.5 type-caption font-semibold text-on-surface-variant">
        {item.lessonNumber}
      </span>
      <p
        className={cn(
          "mt-1 line-clamp-2 w-[112px] type-caption leading-5",
          item.current
            ? "font-semibold text-on-surface-variant"
            : "font-medium text-on-surface-variant",
        )}
      >
        {item.title}
      </p>
    </div>
  );
}

function LessonOutlineItem({ item }: { item: CourseReaderLessonItem }) {
  const content = (
    <div
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-[8px] px-2 py-1.5 transition-colors",
        item.current ? "bg-primary-container" : "hover:bg-surface-container",
      )}
    >
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          item.completed
            ? "bg-surface-container text-on-surface-variant"
            : item.current
              ? "bg-primary text-white"
              : item.locked
                ? "bg-surface-container text-on-surface-variant"
                : "bg-surface-container text-on-surface-variant",
        )}
      >
        {item.completed ? <Check className="h-3.5 w-3.5" /> : item.lessonNumber}
      </div>
      <p
        className={cn(
          "min-w-0 line-clamp-2 type-label leading-5",
          item.current
            ? "font-semibold text-on-surface-variant"
            : "text-on-surface-variant",
        )}
      >
        {item.title}
      </p>
    </div>
  );

  return item.href ? <Link href={item.href}>{content}</Link> : content;
}

function ReaderLessonRenderer({
  lesson,
  courseSlug,
}: {
  lesson: LessonWithContext;
  courseSlug: string;
}) {
  if (lesson.type === "article") {
    return <ArticleRenderer lesson={lesson} courseSlug={courseSlug} />;
  }

  if (lesson.type === "video") {
    return <VideoRenderer lesson={lesson} courseSlug={courseSlug} />;
  }

  if (lesson.type === "quiz") {
    return <QuizRenderer lesson={lesson} courseSlug={courseSlug} />;
  }

  return <PracticeRenderer lesson={lesson} courseSlug={courseSlug} />;
}

function LessonActionBar({
  course,
  lesson,
  currentItem,
}: {
  course: CourseReaderData;
  lesson: LessonWithContext;
  currentItem: CourseReaderLessonItem | null;
}) {
  const t = useTranslations("dashboard.courses");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isCompleted = lesson.progress?.status === "completed";
  const canMarkComplete =
    !course.isPreview && !isCompleted && lesson.type !== "quiz";

  const handleMarkComplete = () => {
    startTransition(async () => {
      await markLessonCompleteAction(
        lesson.id,
        lesson.course.id,
        undefined,
        undefined,
        course.slug,
      );
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <p className="max-w-xl type-body-sm text-on-surface-variant">
        {course.isPreview
          ? t("reader.preview_description")
          : isCompleted
            ? course.nextLesson
              ? t("reader.ready_for_next")
              : t("reader.course_complete_description")
            : lesson.type === "quiz"
              ? t("reader.complete_quiz_to_continue")
              : t("reader.mark_complete_prompt", {
                  lesson: currentItem?.lessonNumber ?? 1,
                })}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        {course.prevLesson ? (
          <Link href={course.prevLesson.href}>
            <Button
              variant="outline"
              size="lg"
              className="h-8 rounded-[10px] border-outline-variant bg-surface text-on-surface hover:bg-surface-container"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("lesson.previous")}
            </Button>
          </Link>
        ) : null}

        {course.isPreview ? (
          <EnrollButton courseId={course.id} />
        ) : canMarkComplete ? (
          <Button
            onClick={handleMarkComplete}
            disabled={isPending}
            variant="outline"
            size="lg"
            className="h-8 rounded-[10px] border-outline-variant bg-surface text-on-surface hover:bg-surface-container"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isPending ? t("practice.saving") : t("practice.mark_complete")}
          </Button>
        ) : null}

        {course.nextLesson ? (
          isCompleted ? (
            <Link href={course.nextLesson.href}>
              <Button
                className="h-8 rounded-[10px] bg-primary px-4 text-on-primary hover:bg-primary-dim"
                size="lg"
              >
                {t("reader.continue_to_lesson", {
                  lesson: course.nextLesson.lessonNumber,
                })}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Button
              disabled
              className="h-8 rounded-[10px] bg-primary px-4 text-on-primary disabled:opacity-60"
              size="lg"
            >
              {t("reader.next_locked")}
              <Lock className="h-4 w-4" />
            </Button>
          )
        ) : (
          <Link href="/courses">
            <Button
              className="h-8 rounded-[10px] bg-primary px-4 text-on-primary hover:bg-primary-dim"
              size="lg"
            >
              {t("reader.back_to_library")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function EnrollButton({ courseId }: { courseId: string }) {
  const t = useTranslations("dashboard.courses");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      await enrollAction(courseId);
      router.refresh();
    });
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      className="h-8 rounded-[10px] bg-primary px-4 text-on-primary hover:bg-primary-dim"
      size="lg"
    >
      {isPending ? t("detail.enrolling") : t("detail.enroll")}
    </Button>
  );
}

function getLessonSummary(
  lesson: LessonWithContext,
  t: ReturnType<typeof useTranslations>,
) {
  if (lesson.type === "article") {
    const markdown = (lesson.content as { markdown?: string }).markdown ?? "";
    return (
      extractFirstParagraph(markdown) || t("reader.article_summary_fallback")
    );
  }

  if (lesson.type === "video") {
    return (
      (lesson.content as { description?: string }).description ??
      t("reader.video_summary_fallback")
    );
  }

  if (lesson.type === "practice") {
    const content = lesson.content as {
      description?: string;
      practice_config?: { description?: string };
    };

    return (
      content.practice_config?.description ??
      content.description ??
      t("reader.practice_summary_fallback")
    );
  }

  return t("reader.quiz_summary", { count: lesson.quiz_questions.length });
}

function getCoachPrompt(lesson: LessonWithContext) {
  if (lesson.type === "practice") {
    return `Help me prepare for the practice lesson "${lesson.title}". Give me a clean outline, the strongest angle to take, and one likely rebuttal I should answer.`;
  }

  if (lesson.type === "quiz") {
    return `Help me review the quiz lesson "${lesson.title}". Explain the key concepts I need to master before I continue.`;
  }

  if (lesson.type === "video") {
    return `Summarize the main debate takeaways from the lesson "${lesson.title}" and give me one way to apply them in practice.`;
  }

  return `Help me understand the key lesson "${lesson.title}" from my course. Summarize the core idea, give me one example, and tell me what students most often miss.`;
}

function extractFirstParagraph(markdown: string) {
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(
      (section) =>
        section && !section.startsWith("#") && !section.startsWith("-"),
    );

  return paragraphs[0]?.replace(/\n/g, " ").trim() ?? "";
}
