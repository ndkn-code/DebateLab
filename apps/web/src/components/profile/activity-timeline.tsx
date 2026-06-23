"use client";

import { useTranslations } from "next-intl";
import { History } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { ActivityEntry } from "./profile-content";

interface ActivityTimelineProps {
  activity: ActivityEntry[];
}

function getDotColor(activityType: string): string {
  switch (activityType) {
    case "session_completed":
    case "course_completed":
    case "lesson_completed":
      return "bg-success";
    case "session_started":
    case "course_enrolled":
      return "bg-primary";
    case "achievement_unlocked":
    case "level_up":
      return "bg-warning";
    default:
      return "bg-surface-container-high";
  }
}

export function ActivityTimeline({ activity }: ActivityTimelineProps) {
  const t = useTranslations("dashboard.profile");

  function formatActivityTime(dateString: string): string {
    return new Date(dateString).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getDescription(entry: ActivityEntry): string {
    if (entry.description) return entry.description;

    const meta = (entry.metadata ?? {}) as Record<string, string>;
    switch (entry.activity_type) {
      case "session_completed":
        return meta.topic
          ? t("activity_session_completed", { topic: String(meta.topic) })
          : t("activity_session_completed_no_topic");
      case "session_started":
        return meta.topic
          ? t("activity_session_started", { topic: String(meta.topic) })
          : t("activity_session_started_no_topic");
      case "achievement_unlocked":
        return t("activity_achievement_unlocked", { title: String(meta.title ?? "?") });
      case "level_up":
        return t("activity_level_up", { level: String(meta.level ?? "?") });
      case "course_enrolled":
        return t("activity_course_enrolled", { course: String(meta.course_title ?? "?") });
      case "course_completed":
        return t("activity_course_completed", { course: String(meta.course_title ?? "?") });
      case "lesson_completed":
        return meta.lesson_title
          ? t("activity_lesson_completed", { lesson: String(meta.lesson_title) })
          : t("activity_lesson_completed_no_title");
      default:
        return entry.activity_type.replace(/_/g, " ");
    }
  }

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-token-card md:p-6">
      <h2 className="mb-4 text-base font-semibold text-on-surface">
        {t("recent_activity")}
      </h2>

      {activity.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <History className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-on-surface-variant">{t("no_activity")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("no_activity_subtitle")}
          </p>
        </div>
      ) : (
        <div className="relative space-y-0">
          {activity.map((entry, index) => (
            <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Vertical line */}
              {index < activity.length - 1 && (
                <div className="absolute left-[7px] top-4 h-full w-px bg-surface-container-high" />
              )}

              {/* Dot */}
              <div
                className={cn(
                  "relative z-10 mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-surface-container-lowest shadow-sm",
                  getDotColor(entry.activity_type)
                )}
              />

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-on-surface-variant">
                  {getDescription(entry)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatActivityTime(entry.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
