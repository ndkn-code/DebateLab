"use client";

import { useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileSearch,
  Layers3,
  Lock,
  Mic2,
  Scale,
  Sparkles,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArticleRenderer } from "@/components/courses/renderers/article-renderer";
import { PracticeRenderer } from "@/components/courses/renderers/practice-renderer";
import { QuizRenderer } from "@/components/courses/renderers/quiz-renderer";
import { VideoRenderer } from "@/components/courses/renderers/video-renderer";
import { enrollAction, markLessonCompleteAction } from "@/app/actions/enrollment";
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
    ? course.lessonItems.find((item) => item.slug === course.nextLesson?.slug) ?? null
    : null;
  const isCompleted = selectedLesson?.progress?.status === "completed";
  const progress =
    course.enrollment?.progress_percent ??
    (course.total_lessons > 0
      ? Math.round((course.completed_lessons / course.total_lessons) * 100)
      : 0);
  const totalDurationMinutes = course.lessonItems.reduce(
    (sum, lesson) => sum + lesson.durationMinutes,
    0
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
        getCoachPrompt(selectedLesson)
      )}&context=course&contextId=${course.id}`
    : "/chat?context=course-home";

  const handleEnroll = () => {
    startEnrollTransition(async () => {
      await enrollAction(course.id);
      router.refresh();
    });
  };

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-[#f7fafe] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="mx-auto max-w-[1380px]">
        <Link
          href="/courses"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#3971dd] transition-colors hover:text-[#2359c8]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("detail.back")}
        </Link>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_292px]">
          <div className="min-w-0">
            <section className="rounded-[28px] border border-[#dee8f8] bg-white p-5 shadow-[0_24px_60px_-48px_rgba(22,39,91,0.28)] sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="relative h-[118px] w-full shrink-0 overflow-hidden rounded-[20px] border border-[#dee8f8] bg-[linear-gradient(135deg,#bad3ff_0%,#4d86f7_100%)] sm:h-[118px] sm:w-[118px]">
                  {course.thumbnail_url ? (
                    <Image
                      src={course.thumbnail_url}
                      alt={course.title}
                      fill
                      className="object-cover"
                      sizes="118px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white">
                      {course.category === "public-speaking" ? (
                        <Mic2 className="h-10 w-10" />
                      ) : (
                        <Scale className="h-10 w-10" />
                      )}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-[#6d7b93]">
                    <span>{categoryLabel}</span>
                    <span className="h-1 w-1 rounded-full bg-[#b8c7dc]" />
                    <span>{difficultyLabel}</span>
                    {course.isPreview ? (
                      <>
                        <span className="h-1 w-1 rounded-full bg-[#b8c7dc]" />
                        <span className="rounded-full bg-[#edf4ff] px-2.5 py-1 text-xs font-semibold text-[#3971dd]">
                          {t("reader.preview_badge")}
                        </span>
                      </>
                    ) : null}
                  </div>

                  <h1 className="mt-3 text-[2rem] font-semibold tracking-[-0.04em] text-[#10213f] sm:text-[2.35rem]">
                    {course.title}
                  </h1>
                  <p className="mt-3 max-w-3xl text-[15px] leading-8 text-[#66758d]">
                    {course.description || t("description_fallback")}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-[#718096]">
                    <span className="inline-flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-[#4d86f7]" />
                      {t("reader.lesson_count", { count: course.total_lessons })}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Layers3 className="h-4 w-4 text-[#4d86f7]" />
                      {t("modules_count", { count: course.modules.length })}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-[#4d86f7]" />
                      {estimatedHours > 0
                        ? t("detail.total_hours", { hours: estimatedHours })
                        : t("detail.self_paced")}
                    </span>
                  </div>

                  <div className="mt-5 max-w-[430px]">
                    <p className="mb-2 text-sm font-medium text-[#5f6f87]">
                      {t("detail.completed_lessons", {
                        completed: course.completed_lessons,
                        total: course.total_lessons,
                      })}
                    </p>
                    <Progress
                      value={progress}
                      className="h-2.5 bg-[#e6eefb] [&>div]:bg-[#4d86f7]"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 overflow-x-auto pb-2">
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
              <section className="mt-7 overflow-hidden rounded-[30px] border border-[#dee8f8] bg-white shadow-[0_28px_80px_-58px_rgba(22,39,91,0.3)]">
                <div className="grid gap-8 border-b border-[#edf3fd] p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_250px]">
                  <div className="min-w-0">
                    <div className="inline-flex rounded-full bg-[#edf4ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#3971dd]">
                      {t("reader.lesson_kicker", {
                        lesson: currentItem?.lessonNumber ?? 1,
                      })}
                    </div>
                    <h2 className="mt-4 text-[2.15rem] font-semibold tracking-[-0.04em] text-[#10213f] sm:text-[2.55rem]">
                      {selectedLesson.title}
                    </h2>
                    <p className="mt-3 max-w-3xl text-[15px] leading-8 text-[#66758d]">
                      {lessonSummary}
                    </p>

                    <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-[#718096]">
                      <span className="inline-flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-[#4d86f7]" />
                        {t("lesson.minute_lesson", {
                          minutes: selectedLesson.duration_minutes,
                        })}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Layers3 className="h-4 w-4 text-[#4d86f7]" />
                        {t("lesson.module_position", {
                          current: selectedLesson.moduleLessonIndex,
                          total: selectedLesson.moduleTotalLessons,
                        })}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-[#4d86f7]" />
                        {t("lesson.course_completed", {
                          completed: selectedLesson.courseCompletedLessons,
                          total: selectedLesson.courseTotalLessons,
                        })}
                      </span>
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#eaf9ee] px-3 py-1 text-sm font-medium text-[#2ca655]">
                          <CheckCircle2 className="h-4 w-4" />
                          {t("lesson.completed")}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <LessonIllustration lessonType={selectedLesson.type} />
                </div>

                <div className="p-6 pt-6 sm:p-8 sm:pt-6">
                  <ReaderLessonRenderer lesson={selectedLesson} courseSlug={course.slug} />
                </div>

                <div className="border-t border-[#edf3fd] px-6 py-5 sm:px-8">
                  <LessonActionBar
                    course={course}
                    lesson={selectedLesson}
                    currentItem={currentItem}
                  />
                </div>
              </section>
            ) : (
              <div className="mt-7 rounded-[30px] border border-[#dee8f8] bg-white p-8 shadow-[0_28px_80px_-58px_rgba(22,39,91,0.3)]">
                <h2 className="text-2xl font-semibold text-[#10213f]">
                  {t("reader.empty_title")}
                </h2>
                <p className="mt-3 max-w-2xl text-[15px] leading-8 text-[#66758d]">
                  {t("reader.empty_state")}
                </p>
              </div>
            )}
          </div>

          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-[26px] border border-[#dee8f8] bg-white p-5 shadow-[0_24px_60px_-50px_rgba(22,39,91,0.28)] xl:mt-[118px]">
              <p className="text-[1.45rem] font-semibold tracking-[-0.03em] text-[#10213f]">
                {course.isPreview ? t("reader.preview_title") : t("reader.whats_next")}
              </p>

              {course.isPreview ? (
                <>
                  <p className="mt-3 text-sm leading-7 text-[#66758d]">
                    {t("reader.preview_description")}
                  </p>
                  <Button
                    onClick={handleEnroll}
                    disabled={isEnrolling}
                    className="mt-5 w-full rounded-2xl bg-[#4d86f7] text-white shadow-[0_20px_45px_-28px_rgba(77,134,247,0.6)] hover:bg-[#3e78ec]"
                    size="lg"
                  >
                    {isEnrolling ? t("detail.enrolling") : t("detail.enroll")}
                  </Button>
                </>
              ) : course.nextLesson ? (
                <div className="mt-4 space-y-4">
                  <div className="flex gap-4">
                    <div className="relative h-[78px] w-[78px] shrink-0 overflow-hidden rounded-[18px] border border-[#dee8f8] bg-[linear-gradient(135deg,#bad3ff_0%,#4d86f7_100%)]">
                      {course.thumbnail_url ? (
                        <Image
                          src={course.thumbnail_url}
                          alt={course.nextLesson.title}
                          fill
                          className="object-cover"
                          sizes="78px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-white">
                          {course.category === "public-speaking" ? (
                            <Mic2 className="h-7 w-7" />
                          ) : (
                            <Scale className="h-7 w-7" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm text-[#6a7a92]">
                        {t("reader.lesson_number", {
                          current: course.nextLesson.lessonNumber,
                          total: course.lessonItems.length,
                        })}
                      </p>
                      <h3 className="mt-1 text-[1.1rem] font-semibold leading-7 text-[#10213f]">
                        {course.nextLesson.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[#66758d]">
                        {course.nextLesson.summary ?? course.nextLesson.moduleTitle}
                      </p>
                      <div className="mt-3 inline-flex items-center gap-2 text-sm text-[#5e718e]">
                        <Clock3 className="h-4 w-4 text-[#4d86f7]" />
                        {t("estimated_minutes", {
                          minutes: course.nextLesson.durationMinutes,
                        })}
                      </div>
                    </div>
                  </div>

                  {nextLessonItem?.locked ? (
                    <Button
                      disabled
                      className="w-full rounded-2xl bg-[#4d86f7] text-white disabled:opacity-60"
                      size="lg"
                    >
                      {t("reader.next_locked")}
                    </Button>
                  ) : (
                    <Link href={course.nextLesson.href}>
                      <Button
                        className="w-full rounded-2xl bg-[#4d86f7] text-white shadow-[0_20px_45px_-28px_rgba(77,134,247,0.6)] hover:bg-[#3e78ec]"
                        size="lg"
                      >
                        {t("reader.view_next_lesson")}
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-[22px] bg-[#eef7f1] p-4 text-sm leading-7 text-[#2ca655]">
                  {t("hero.completed_description")}
                </div>
              )}
            </section>

            <section className="rounded-[26px] border border-[#dee8f8] bg-white p-5 shadow-[0_24px_60px_-50px_rgba(22,39,91,0.28)]">
              <p className="text-xl font-semibold tracking-[-0.03em] text-[#10213f]">
                {t("reader.lesson_outline")}
              </p>
              <div className="mt-4 space-y-1.5">
                {course.lessonItems.map((item) => (
                  <LessonOutlineItem key={item.id} item={item} />
                ))}
              </div>
            </section>

            <section className="rounded-[26px] border border-[#dbe9ff] bg-[linear-gradient(180deg,#eef5ff_0%,#e8f1ff_100%)] p-5 shadow-[0_24px_60px_-50px_rgba(77,134,247,0.34)]">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#4d86f7] shadow-[0_14px_26px_-20px_rgba(77,134,247,0.45)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[1.25rem] font-semibold tracking-[-0.03em] text-[#10213f]">
                    {t("reader.need_help")}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[#66758d]">
                    {t("reader.need_help_description")}
                  </p>
                </div>
              </div>
              <Link href={coachHref} className="mt-5 block">
                <Button
                  className="w-full rounded-2xl border border-[#d8e6fb] bg-white text-[#3971dd] hover:bg-[#f7fbff]"
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
    <div className="relative z-10 flex h-[60px] w-[60px] items-center justify-center">
      {item.completed ? (
        <div className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-[#eef9f1] ring-[8px] ring-[#eff9f2]">
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#34c759] text-white shadow-[0_12px_30px_-20px_rgba(52,199,89,0.6)]">
            <Check className="h-5 w-5" />
          </div>
        </div>
      ) : item.current ? (
        <div className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-[#eef4ff] ring-[8px] ring-[#f4f8ff]">
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#4d86f7] text-lg font-semibold text-white shadow-[0_14px_34px_-20px_rgba(77,134,247,0.72)]">
            {item.lessonNumber}
          </div>
        </div>
      ) : item.locked ? (
        <div className="flex h-[48px] w-[48px] items-center justify-center rounded-full border border-[#d7e3f5] bg-[#f8fbff] text-[#7f8ea6]">
          <Lock className="h-4 w-4" />
        </div>
      ) : (
        <div className="flex h-[48px] w-[48px] items-center justify-center rounded-full border border-[#d7e3f5] bg-white text-sm font-semibold text-[#334463]">
          {item.lessonNumber}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative flex min-w-[164px] flex-col items-center text-center">
      {!isLast ? (
        <div
          className={cn(
            "absolute left-1/2 top-[30px] h-[2px] w-[calc(100%-16px)] -translate-y-1/2",
            connectorComplete
              ? "bg-[#34c759]"
              : "bg-[repeating-linear-gradient(90deg,#d8e3f6_0,#d8e3f6_8px,transparent_8px,transparent_15px)]"
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

      <span className="mt-2 text-sm font-semibold text-[#10213f]">
        {item.lessonNumber}
      </span>
      <p
        className={cn(
          "mt-1 w-[130px] text-[15px] leading-7",
          item.current ? "font-semibold text-[#2563eb]" : "font-medium text-[#1d2b45]"
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
        "flex items-center gap-3 rounded-[16px] px-3 py-2.5 transition-colors",
        item.current ? "bg-[#edf4ff]" : "hover:bg-[#f7fafe]"
      )}
    >
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          item.completed
            ? "bg-[#eaf9ee] text-[#2ca655]"
            : item.current
              ? "bg-[#4d86f7] text-white"
              : item.locked
                ? "bg-[#f1f5fb] text-[#9aa7bb]"
                : "bg-[#f1f5fb] text-[#5c6f8e]"
        )}
      >
        {item.completed ? <Check className="h-3.5 w-3.5" /> : item.lessonNumber}
      </div>
      <p
        className={cn(
          "min-w-0 text-sm leading-6",
          item.current ? "font-semibold text-[#2563eb]" : "text-[#415069]"
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
    !course.isPreview &&
    !isCompleted &&
    lesson.type !== "quiz";

  const handleMarkComplete = () => {
    startTransition(async () => {
      await markLessonCompleteAction(
        lesson.id,
        lesson.course.id,
        undefined,
        undefined,
        course.slug
      );
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <p className="max-w-xl text-sm leading-7 text-[#66758d]">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
        {course.prevLesson ? (
          <Link href={course.prevLesson.href}>
            <Button
              variant="outline"
              size="lg"
              className="rounded-2xl border-[#d8e6fb] bg-white text-[#29446d] hover:bg-[#f7fbff]"
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
            className="rounded-2xl border-[#d8e6fb] bg-white text-[#29446d] hover:bg-[#f7fbff]"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isPending ? t("practice.saving") : t("practice.mark_complete")}
          </Button>
        ) : null}

        {course.nextLesson ? (
          isCompleted ? (
            <Link href={course.nextLesson.href}>
              <Button
                className="rounded-2xl bg-[#4d86f7] px-6 text-white shadow-[0_20px_45px_-28px_rgba(77,134,247,0.6)] hover:bg-[#3e78ec]"
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
              className="rounded-2xl bg-[#4d86f7] px-6 text-white disabled:opacity-60"
              size="lg"
            >
              {t("reader.next_locked")}
              <Lock className="h-4 w-4" />
            </Button>
          )
        ) : (
          <Link href="/courses">
            <Button
              className="rounded-2xl bg-[#4d86f7] px-6 text-white shadow-[0_20px_45px_-28px_rgba(77,134,247,0.6)] hover:bg-[#3e78ec]"
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
      className="rounded-2xl bg-[#4d86f7] px-6 text-white shadow-[0_20px_45px_-28px_rgba(77,134,247,0.6)] hover:bg-[#3e78ec]"
      size="lg"
    >
      {isPending ? t("detail.enrolling") : t("detail.enroll")}
    </Button>
  );
}

function LessonIllustration({
  lessonType,
}: {
  lessonType: LessonWithContext["type"];
}) {
  const blocks =
    lessonType === "video"
      ? [
          { icon: Scale, classes: "from-[#346cf3] to-[#2459d8]", top: "top-1", left: "left-16", rotate: "-rotate-6" },
          { icon: Sparkles, classes: "from-[#2fa2ff] to-[#2c89f4]", top: "top-20", left: "left-9", rotate: "rotate-2" },
          { icon: Star, classes: "from-[#ffb63b] to-[#f59e0b]", top: "top-40", left: "left-2", rotate: "-rotate-3" },
        ]
      : lessonType === "quiz"
        ? [
            { icon: FileSearch, classes: "from-[#346cf3] to-[#2459d8]", top: "top-1", left: "left-16", rotate: "-rotate-6" },
            { icon: CheckCircle2, classes: "from-[#2fa2ff] to-[#2c89f4]", top: "top-20", left: "left-9", rotate: "rotate-2" },
            { icon: Star, classes: "from-[#ffb63b] to-[#f59e0b]", top: "top-40", left: "left-2", rotate: "-rotate-3" },
          ]
        : lessonType === "practice"
          ? [
              { icon: Mic2, classes: "from-[#346cf3] to-[#2459d8]", top: "top-1", left: "left-16", rotate: "-rotate-6" },
              { icon: BrainCircuit, classes: "from-[#2fa2ff] to-[#2c89f4]", top: "top-20", left: "left-9", rotate: "rotate-2" },
              { icon: Star, classes: "from-[#ffb63b] to-[#f59e0b]", top: "top-40", left: "left-2", rotate: "-rotate-3" },
            ]
          : [
              { icon: FileSearch, classes: "from-[#346cf3] to-[#2459d8]", top: "top-1", left: "left-16", rotate: "-rotate-6" },
              { icon: BrainCircuit, classes: "from-[#2fa2ff] to-[#2c89f4]", top: "top-20", left: "left-9", rotate: "rotate-2" },
              { icon: Star, classes: "from-[#ffb63b] to-[#f59e0b]", top: "top-40", left: "left-2", rotate: "-rotate-3" },
            ];

  return (
    <div className="relative hidden h-[240px] w-[240px] lg:flex lg:items-center lg:justify-center">
      <div className="absolute left-6 top-7 h-2.5 w-2.5 rounded-full bg-[#dce9ff]" />
      <div className="absolute right-8 top-12 text-[#9dbefc]">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="absolute right-2 top-28 text-[#9dbefc]">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="absolute left-2 top-40 text-[#9dbefc]">
        <Sparkles className="h-4 w-4" />
      </div>

      <div className="relative h-[230px] w-[190px]">
        {blocks.map(({ icon: Icon, classes, top, left, rotate }, index) => (
          <div
            key={`${left}-${top}-${index}`}
            className={cn(
              "absolute flex h-[72px] w-[96px] items-center justify-center rounded-[20px] bg-gradient-to-br text-white shadow-[0_26px_40px_-20px_rgba(34,73,146,0.45)]",
              top,
              left,
              rotate,
              classes
            )}
          >
            <Icon className="h-9 w-9" />
          </div>
        ))}
      </div>
    </div>
  );
}

function getLessonSummary(
  lesson: LessonWithContext,
  t: ReturnType<typeof useTranslations>
) {
  if (lesson.type === "article") {
    const markdown = (lesson.content as { markdown?: string }).markdown ?? "";
    return extractFirstParagraph(markdown) || t("reader.article_summary_fallback");
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
    .filter((section) => section && !section.startsWith("#") && !section.startsWith("-"));

  return paragraphs[0]?.replace(/\n/g, " ").trim() ?? "";
}
