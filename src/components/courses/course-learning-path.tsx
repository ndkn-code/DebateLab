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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
    node: "border-emerald-500 bg-emerald-500 text-white",
    card: "border-emerald-500/15 bg-emerald-500/5",
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
  },
  active: {
    node: "border-primary bg-primary text-on-primary ring-4 ring-primary/15",
    card: "border-primary/20 bg-primary/5 shadow-[0_20px_40px_-28px_rgba(47,79,221,0.6)]",
    badge: "border-primary/20 bg-primary/10 text-primary",
  },
  locked: {
    node: "border-outline-variant/25 bg-surface-container text-on-surface-variant",
    card: "border-outline-variant/10 bg-surface-container-low opacity-80",
    badge: "border-outline-variant/20 bg-surface-container text-on-surface-variant",
  },
  default: {
    node: "border-outline-variant/30 bg-surface-container-lowest text-on-surface",
    card: "border-outline-variant/15 bg-surface-container-lowest",
    badge: "border-outline-variant/20 bg-surface-container-low text-on-surface-variant",
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
  labels: CoursePathLabels
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
          href: isEnrolled ? `/courses/${course.slug}/lessons/${lesson.slug}` : null,
          completed: lesson.progress?.status === "completed",
          active: false,
          locked: !isEnrolled,
          orderIndex: lesson.order_index,
        })
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
        })
      ),
    ].sort((left, right) => left.orderIndex - right.orderIndex);

    const completedCount = module.lessons.filter(
      (lesson) => lesson.progress?.status === "completed"
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
    <div className="space-y-10">
      {sections.map((section) => (
        <section key={section.id} className="space-y-5">
          <div className="rounded-[1.75rem] border border-outline-variant/15 bg-surface-container-lowest p-5 soft-shadow sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  {t("detail.module")}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-on-surface">
                  {section.title}
                </h3>
                {section.description ? (
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
                    {section.description}
                  </p>
                ) : null}
              </div>

              <div className="min-w-[220px] rounded-2xl bg-surface-container p-4">
                <div className="flex items-center justify-between text-xs text-on-surface-variant">
                  <span>
                    {t("detail.lessons_completed", {
                      completed: section.completedCount,
                      total: section.trackableCount,
                    })}
                  </span>
                  <span>{t("detail.steps", { count: section.totalItemCount })}</span>
                </div>
                <Progress value={section.progressPercent} className="mt-3" />
              </div>
            </div>
          </div>

          <div className="relative space-y-5">
            <div className="absolute bottom-0 left-5 top-6 w-px bg-outline-variant/20 md:hidden" />
            <div className="absolute bottom-0 left-1/2 top-6 hidden w-px -translate-x-1/2 bg-outline-variant/20 md:block" />

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
  const side = index % 2 === 0 ? "md:justify-start" : "md:justify-end";
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
      ? LESSON_META[item.typeKey as keyof typeof LESSON_META] ?? LESSON_META.article
      : undefined;
  const activityMeta =
    item.kind === "activity"
      ? ACTIVITY_META[item.typeKey as keyof typeof ACTIVITY_META]
      : undefined;
  const Icon = iconMeta?.icon ?? activityMeta?.icon ?? BookOpen;

  const content = (
    <div
      className={cn(
        "w-full rounded-[1.5rem] border p-5 transition-colors md:w-[calc(50%-2.5rem)]",
        styles.card
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
            styles.node
          )}
        >
          {item.completed ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
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

          <h4 className="mt-3 text-base font-semibold text-on-surface">{item.title}</h4>
          {item.description ? (
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              {item.description}
            </p>
          ) : null}

          <div className="mt-4 flex items-center gap-3 text-xs text-on-surface-variant">
            <span>{item.kind === "lesson" ? t("detail.lesson") : t("detail.activity")}</span>
            <span>&middot;</span>
            <span>{item.durationMinutes} min</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn("relative flex", side)}>
      <div
        className={cn(
          "absolute left-2 top-6 h-6 w-6 rounded-full border-4 border-background md:left-1/2 md:-translate-x-1/2",
          styles.node
        )}
      />

      <div className="w-full pl-12 md:pl-0">
        {item.href && !item.locked ? (
          <Link href={item.href} className="group block">
            {content}
          </Link>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
