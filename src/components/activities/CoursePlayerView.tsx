"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { ArrowLeft, BookOpen, Eye, HelpCircle, Link2, PenLine, ArrowUpDown, Layers, Lock, Unlock, Crown, Check } from "lucide-react";
import { enrollInCourse } from "@/app/actions/enrollment";
import type { ActivityType, ActivityPhase } from "@/lib/types/admin";

const TYPE_ICONS: Record<ActivityType, typeof BookOpen> = {
  lesson: BookOpen, quiz: HelpCircle, matching: Link2,
  fill_blank: PenLine, drag_order: ArrowUpDown, flashcard: Layers,
};

const PHASE_COLORS: Record<ActivityPhase, string> = {
  learn: "bg-green-100 text-green-700",
  practice: "bg-amber-100 text-amber-700",
  apply: "bg-blue-100 text-blue-700",
};

interface Props {
  course: Record<string, unknown>;
  modules: (Record<string, unknown> & { activities: { id: string; title: string; activity_type: ActivityType; phase: ActivityPhase; order_index: number; duration_minutes: number }[] })[];
  enrollment: Record<string, unknown> | null;
  completedActivityIds: string[];
  previewMode?: boolean;
  editorHref?: string;
  publicationState?: "draft" | "published";
}

export function CoursePlayerView({
  course,
  modules,
  enrollment,
  completedActivityIds,
  previewMode = false,
  editorHref,
  publicationState = "published",
}: Props) {
  const t = useTranslations("courses.player");
  const router = useRouter();
  const courseId = course.id as string;
  const completed = new Set(completedActivityIds);
  const totalActivities = modules.reduce((sum, m) => sum + m.activities.length, 0);
  const completedCount = completedActivityIds.length;
  const progressPct = totalActivities > 0 ? Math.round((completedCount / totalActivities) * 100) : 0;
  const hasAccess = previewMode || !!enrollment;
  const backHref = previewMode ? (editorHref ?? `/dashboard/admin/courses/${courseId}`) : "/courses";
  const backLabel = previewMode ? t("backToEditor") : t("backToCourse");
  const previewStateLabel =
    publicationState === "published" ? t("previewPublished") : t("previewDraft");

  const handleEnroll = async () => {
    if (previewMode) return;
    await enrollInCourse(course.id as string);
    router.refresh();
  };

  const accessBadge = (level: string) => {
    if (level === "free") return { icon: Unlock, label: t("free"), color: "text-green-600" };
    if (level === "premium") return { icon: Crown, label: t("premium"), color: "text-amber-600" };
    return { icon: Lock, label: t("locked"), color: "text-gray-400" };
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6">
      <Link href={backHref} className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface">
        <ArrowLeft className="h-4 w-4" />{backLabel}
      </Link>

      {/* Course header */}
      <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-6 shadow-sm">
        {previewMode ? (
          <div className="mb-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Eye className="h-3.5 w-3.5" />
                {t("adminPreview")}
              </span>
              <span className="inline-flex items-center rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 text-xs font-medium text-on-surface-variant">
                {previewStateLabel}
              </span>
            </div>
            <p className="mt-2 text-sm text-on-surface-variant">
              {t("previewSavedVersion")}
            </p>
          </div>
        ) : null}

        <h1 className="text-2xl font-bold text-on-surface">{course.title as string}</h1>
        {course.description ? (
          <p className="text-sm text-on-surface-variant mt-2">{String(course.description)}</p>
        ) : null}
        <div className="flex items-center gap-4 mt-3 text-xs text-on-surface-variant">
          <span className="capitalize">{course.category as string}</span>
          <span className="capitalize">{course.difficulty as string}</span>
          <span>{modules.length} modules</span>
        </div>

        {previewMode ? (
          <div className="mt-4 rounded-xl border border-dashed border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            {t("previewNoTracking")}
          </div>
        ) : enrollment ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-on-surface-variant mb-1">
              <span>{t("progress", { completed: completedCount, total: totalActivities })}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-2 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        ) : (
          <button
            onClick={handleEnroll}
            className="mt-4 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            {t("enroll")}
          </button>
        )}
      </div>

      {/* Modules */}
      <div className="space-y-4">
        {modules.map((mod, mi) => {
          const badge = accessBadge((mod.access_level as string) ?? "locked");
          const BadgeIcon = badge.icon;

          return (
            <div key={mod.id as string} className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-primary bg-primary/10 rounded-md px-1.5 py-0.5">
                    {mi + 1}
                  </span>
                  <span className="font-semibold text-on-surface">{mod.title as string}</span>
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium ${badge.color}`}>
                  <BadgeIcon className="h-3.5 w-3.5" />
                  {badge.label}
                </div>
              </div>

              <div className="divide-y divide-outline-variant/5">
                {mod.activities.map((act) => {
                  const isCompleted = completed.has(act.id);
                  const Icon = TYPE_ICONS[act.activity_type];

                  return (
                    <Link
                      key={act.id}
                      href={
                        hasAccess
                          ? `/dashboard/courses/${courseId}/activity/${act.id}${previewMode ? "?preview=1" : ""}`
                          : "#"
                      }
                      className="flex items-center gap-3 px-5 py-3 hover:bg-surface-container/50 transition-colors"
                    >
                      {isCompleted ? (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-outline-variant/20">
                      <Icon className="h-3 w-3 text-on-surface-variant" />
                    </div>
                  )}
                      <span className="flex-1 text-sm text-on-surface">{act.title}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${PHASE_COLORS[act.phase]}`}>
                        {act.phase}
                      </span>
                      <span className="text-xs text-on-surface-variant">{act.duration_minutes}m</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
