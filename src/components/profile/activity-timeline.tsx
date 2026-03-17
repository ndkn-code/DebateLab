"use client";

import { useTranslations } from "next-intl";
import { History } from "lucide-react";
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
      return "bg-emerald-500";
    case "session_started":
    case "course_enrolled":
      return "bg-blue-500";
    case "achievement_unlocked":
    case "level_up":
      return "bg-amber-500";
    default:
      return "bg-gray-400";
  }
}

export function ActivityTimeline({ activity }: ActivityTimelineProps) {
  const t = useTranslations("dashboard.profile");

  function timeAgo(dateString: string): string {
    const now = Date.now();
    const then = new Date(dateString).getTime();
    const diffSeconds = Math.floor((now - then) / 1000);

    if (diffSeconds < 60) return t("time_just_now");
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return t("time_minutes_ago", { count: diffMinutes });
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return t("time_hours_ago", { count: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return t("time_days_ago", { count: diffDays });
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 5) return t("time_weeks_ago", { count: diffWeeks });
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return t("time_months_ago", { count: diffMonths });
    const diffYears = Math.floor(diffDays / 365);
    return t("time_years_ago", { count: diffYears });
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
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <h2 className="mb-4 text-base font-semibold text-gray-900">
        {t("recent_activity")}
      </h2>

      {activity.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <History className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">{t("no_activity")}</p>
          <p className="mt-1 text-xs text-gray-400">
            {t("no_activity_subtitle")}
          </p>
        </div>
      ) : (
        <div className="relative space-y-0">
          {activity.map((entry, index) => (
            <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Vertical line */}
              {index < activity.length - 1 && (
                <div className="absolute left-[7px] top-4 h-full w-px bg-gray-200" />
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
                <p className="text-sm text-gray-700">
                  {getDescription(entry)}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {timeAgo(entry.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
