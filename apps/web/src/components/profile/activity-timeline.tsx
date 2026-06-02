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
      return "bg-[#34C759]";
    case "session_started":
    case "course_enrolled":
      return "bg-[#4D86F7]";
    case "achievement_unlocked":
    case "level_up":
      return "bg-[#F5B942]";
    default:
      return "bg-[#8A96A8]";
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
    <div className="rounded-2xl border border-[#DEE8F8] bg-white p-5 shadow-[0_18px_44px_-42px_rgba(62,120,236,0.22)] md:p-6">
      <h2 className="mb-4 text-base font-semibold text-[#0B1424]">
        {t("recent_activity")}
      </h2>

      {activity.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <History className="mb-3 h-8 w-8 text-[#8A96A8]" />
          <p className="text-sm text-[#718096]">{t("no_activity")}</p>
          <p className="mt-1 text-xs text-[#8A96A8]">
            {t("no_activity_subtitle")}
          </p>
        </div>
      ) : (
        <div className="relative space-y-0">
          {activity.map((entry, index) => (
            <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Vertical line */}
              {index < activity.length - 1 && (
                <div className="absolute left-[7px] top-4 h-full w-px bg-[#DEE8F8]" />
              )}

              {/* Dot */}
              <div
                className={cn(
                  "relative z-10 mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-white shadow-sm",
                  getDotColor(entry.activity_type)
                )}
              />

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#415069]">
                  {getDescription(entry)}
                </p>
                <p className="mt-0.5 text-xs text-[#8A96A8]">
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
