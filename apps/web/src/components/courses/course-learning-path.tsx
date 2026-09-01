"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRightLeft,
  BookOpen,
  Check,
  FileText,
  HelpCircle,
  Layers3,
  Lock,
  Mic2,
  PlayCircle,
  Sparkles,
} from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Eyebrow, Heading } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { CourseWithModules } from "@/lib/api/courses";
import type { CoursePathItem, CoursePathSection } from "@/types";

const LESSON_META = {
  article: { icon: FileText, label: "Article" },
  video: { icon: PlayCircle, label: "Video" },
  quiz: { icon: HelpCircle, label: "Quiz" },
  practice: { icon: Mic2, label: "Practice" },
} as const;

const ACTIVITY_META = {
  lesson: { icon: FileText, label: "Lesson" },
  quiz: { icon: HelpCircle, label: "Quiz" },
  matching: { icon: Layers3, label: "Matching" },
  fill_blank: { icon: Sparkles, label: "Fill Blank" },
  drag_order: { icon: ArrowRightLeft, label: "Drag Order" },
  flashcard: { icon: BookOpen, label: "Flashcard" },
} as const;

const STATUS_STYLES = {
  completed: {
    node: "border-success/30 bg-success-container text-on-success-container",
    card: "bg-success-container/35",
    badge: "border-success/25 bg-success-container text-on-success-container",
  },
  active: {
    node: "border-primary bg-primary text-on-primary ring-4 ring-primary/15",
    card: "bg-primary-container",
    badge: "border-primary/20 bg-primary/10 text-primary",
  },
  locked: {
    node: "border-outline-variant/25 bg-surface-container text-on-surface-variant",
    card: "bg-surface-container-low opacity-80",
    badge:
      "border-outline-variant/20 bg-surface-container text-on-surface-variant",
  },
  default: {
    node: "border-outline-variant bg-surface text-on-surface",
    card: "bg-surface",
    badge:
      "border-outline-variant/20 bg-surface-container-low text-on-surface-variant",
  },
} as const;

interface CourseLearningPathProps {
  course: CourseWithModules;
}

interface CoursePathLabels {
  lessonTypeLabels: Record<keyof typeof LESSON_META, string>;
  activityTypeLabels: Record<string, string>;
}

interface SortableCoursePathItem extends CoursePathItem {
  orderIndex: number;
}

export function buildCoursePathSections(
  course: CourseWithModules,
  labels: CoursePathLabels,
): CoursePathSection[] {
  const isEnrolled = !!course.enrollment;
  const sections = course.modules.map((module) => {
    const items: SortableCoursePathItem[] = [
      ...module.lessons.map(
        (lesson): SortableCoursePathItem => ({
          id: lesson.id,
          title: lesson.title,
          description: null,
          kind: "lesson",
          typeKey: lesson.type,
          typeLabel: labels.lessonTypeLabels[lesson.type],
          durationMinutes: lesson.duration_minutes,
          href: isEnrolled
            ? `/courses/${course.slug}?lesson=${encodeURIComponent(lesson.slug)}`
            : null,
          completed: lesson.progress?.status === "completed",
          active: false,
          locked: !isEnrolled,
          orderIndex: lesson.order_index,
        }),
      ),
      ...(module.activities ?? []).map(
        (activity): SortableCoursePathItem => ({
          id: activity.id,
          title: activity.title,
          description: null,
          kind: "activity",
          typeKey: activity.activity_type,
          typeLabel:
            labels.activityTypeLabels[activity.activity_type] ??
            activity.activity_type.replace(/_/g, " "),
          durationMinutes: activity.duration_minutes,
          href: isEnrolled
            ? `/dashboard/courses/${course.id}/activity/${activity.id}`
            : null,
          completed: !!activity.completed,
          active: false,
          locked: !isEnrolled,
          orderIndex: activity.order_index,
        }),
      ),
    ].sort((left, right) => left.orderIndex - right.orderIndex);

    const completedCount = module.lessons.filter(
      (lesson) => lesson.progress?.status === "completed",
    ).length;
    const trackableCount = module.lessons.length;
    const progressPercent =
      trackableCount > 0
        ? Math.round((completedCount / trackableCount) * 100)
        : 0;
    const visibleItems: CoursePathItem[] = items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      kind: item.kind,
      typeKey: item.typeKey,
      typeLabel: item.typeLabel,
      durationMinutes: item.durationMinutes,
      href: item.href,
      completed: item.completed,
      active: item.active,
      locked: item.locked,
    }));

    return {
      id: module.id,
      title: module.title,
      description: module.description,
      items: visibleItems,
      completedCount,
      trackableCount,
      totalItemCount: items.length,
      progressPercent,
    };
  });

  let activeAssigned = false;

  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      const active = !activeAssigned && !item.locked && !item.completed;
      if (active) {
        activeAssigned = true;
      }
      return { ...item, active };
    }),
  }));
}

export function CourseLearningPath({ course }: CourseLearningPathProps) {
  const t = useTranslations("dashboard.courses");
  const sections = buildCoursePathSections(course, {
    lessonTypeLabels: {
      article: t("types.article"),
      video: t("types.video"),
      quiz: t("types.quiz"),
      practice: t("types.practice"),
    },
    activityTypeLabels: {
      lesson: t("activities.lesson"),
      quiz: t("activities.quiz"),
      matching: t("activities.matching"),
      fill_blank: t("activities.fill_blank"),
      drag_order: t("activities.drag_order"),
      flashcard: t("activities.flashcard"),
    },
  });

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <section key={section.id} className="space-y-3">
          <div className="rounded-xl border border-outline-variant bg-surface p-4 shadow-none">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Eyebrow className="font-semibold text-primary">
                  {t("detail.module")}
                </Eyebrow>
                <Heading level={3} as="h3" className="mt-2 font-semibold">
                  {section.title}
                </Heading>
                {section.description ? (
                  <p className="mt-1 line-clamp-2 max-w-2xl type-body-sm text-on-surface-variant">
                    {section.description}
                  </p>
                ) : null}
              </div>

              <div className="min-w-[210px] rounded-control bg-surface-container p-3">
                <div className="flex items-center justify-between text-xs text-on-surface-variant">
                  <span>
                    {t("detail.lessons_completed", {
                      completed: section.completedCount,
                      total: section.trackableCount,
                    })}
                  </span>
                  <span>
                    {t("detail.steps", { count: section.totalItemCount })}
                  </span>
                </div>
                <Progress
                  value={section.progressPercent}
                  className="mt-2 h-2"
                />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface divide-y divide-outline-variant">
            {section.items.map((item, index) => (
              <PathNode key={item.id} item={item} index={index} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PathNode({ item, index }: { item: CoursePathItem; index: number }) {
  const t = useTranslations("dashboard.courses");
  const statusKey = item.completed
    ? "completed"
    : item.locked
      ? "locked"
      : item.active
        ? "active"
        : "default";
  const styles = STATUS_STYLES[statusKey];
  const iconMeta =
    item.kind === "lesson"
      ? (LESSON_META[item.typeKey as keyof typeof LESSON_META] ??
        LESSON_META.article)
      : undefined;
  const activityMeta =
    item.kind === "activity"
      ? ACTIVITY_META[item.typeKey as keyof typeof ACTIVITY_META]
      : undefined;
  const Icon = iconMeta?.icon ?? activityMeta?.icon ?? BookOpen;

  const content = (
    <div
      className={cn(
        "flex min-h-14 w-full items-center gap-3 px-3 py-2.5 transition-colors duration-150",
        styles.card,
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-[8px] border",
          styles.node,
        )}
      >
        {item.completed ? (
          <Check className="h-4 w-4" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("capitalize", styles.badge)}>
            {item.typeLabel}
          </Badge>
          {item.active ? (
            <Badge variant="outline" className={cn("capitalize", styles.badge)}>
              {t("detail.current")}
            </Badge>
          ) : null}
          {item.locked ? (
            <Badge variant="outline" className={cn("capitalize", styles.badge)}>
              <Lock className="mr-1 h-3 w-3" />
              {t("detail.locked")}
            </Badge>
          ) : null}
        </div>
        <Heading
          level={4}
          as="h4"
          className="mt-1 line-clamp-1 type-label font-semibold"
        >
          {item.title}
        </Heading>
      </div>

      <div className="shrink-0 text-right type-caption text-on-surface-variant">
        <span className="block">
          {item.kind === "lesson" ? t("detail.lesson") : t("detail.activity")}
        </span>
        <span>{item.durationMinutes} min</span>
      </div>
    </div>
  );

  return (
    <div data-step={index + 1}>
      {item.href && !item.locked ? (
        <Link
          href={item.href}
          className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}
