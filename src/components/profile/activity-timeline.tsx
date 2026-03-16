"use client";

import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityEntry } from "./profile-content";

interface ActivityTimelineProps {
  activity: ActivityEntry[];
}

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
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

function getDescription(entry: ActivityEntry): string {
  if (entry.description) return entry.description;

  const meta = entry.metadata ?? {};
  switch (entry.activity_type) {
    case "session_completed":
      return `Completed a debate${meta.topic ? ` on "${meta.topic}"` : ""}${meta.score ? ` with a score of ${meta.score}` : ""}`;
    case "session_started":
      return `Started a debate session${meta.topic ? ` on "${meta.topic}"` : ""}`;
    case "achievement_unlocked":
      return `Unlocked achievement: ${meta.title ?? "Unknown"}`;
    case "level_up":
      return `Reached Level ${meta.level ?? "?"}`;
    case "course_enrolled":
      return `Enrolled in ${meta.course_title ?? "a course"}`;
    case "course_completed":
      return `Completed the course "${meta.course_title ?? "Unknown"}"`;
    case "lesson_completed":
      return `Finished a lesson${meta.lesson_title ? `: ${meta.lesson_title}` : ""}`;
    default:
      return entry.activity_type.replace(/_/g, " ");
  }
}

export function ActivityTimeline({ activity }: ActivityTimelineProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
      <h2 className="mb-4 text-base font-semibold text-gray-900">
        Recent Activity
      </h2>

      {activity.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <History className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">No activity yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Start a debate to see your activity here
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
