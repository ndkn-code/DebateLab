"use client";

import { useState, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Activity, ActivityPhase } from "@/lib/types/admin";
import { QuizPlayer } from "./QuizPlayer";
import { MatchingPlayer } from "./MatchingPlayer";
import { FillBlankPlayer } from "./FillBlankPlayer";
import { DragOrderPlayer } from "./DragOrderPlayer";
import { FlashcardPlayer } from "./FlashcardPlayer";
import { LessonPlayer } from "./LessonPlayer";

const PHASE_COLORS: Record<ActivityPhase, string> = {
  learn: "bg-green-100 text-green-700",
  practice: "bg-amber-100 text-amber-700",
  apply: "bg-blue-100 text-blue-700",
};

interface Props {
  activity: Activity;
  courseId: string;
  userId: string;
  siblings: { id: string; title: string; order_index: number }[];
  moduleTitle: string;
  moduleIndex: number;
}

export function ActivityPlayerWrapper({ activity, courseId, userId, siblings, moduleTitle, moduleIndex }: Props) {
  const t = useTranslations("courses.player");
  const router = useRouter();
  const supabase = createClient();
  const [completed, setCompleted] = useState(false);

  const currentIdx = siblings.findIndex((s) => s.id === activity.id);
  const prevActivity = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const nextActivity = currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;

  const handleComplete = useCallback(async (score?: number, maxScore?: number, responses?: Record<string, unknown>) => {
    setCompleted(true);

    await supabase.from("activity_attempts").insert({
      user_id: userId,
      activity_id: activity.id,
      completed_at: new Date().toISOString(),
      score: score ?? null,
      max_score: maxScore ?? null,
      is_passed: score != null && maxScore != null ? score >= maxScore * 0.6 : true,
      attempt_number: 1,
      time_spent_seconds: null,
      responses: responses ?? null,
    });
  }, [supabase, userId, activity.id]);

  const renderPlayer = () => {
    const props = { content: activity.content, onComplete: handleComplete };
    switch (activity.activity_type) {
      case "quiz": return <QuizPlayer {...props} />;
      case "matching": return <MatchingPlayer {...props} />;
      case "fill_blank": return <FillBlankPlayer {...props} />;
      case "drag_order": return <DragOrderPlayer {...props} />;
      case "flashcard": return <FlashcardPlayer {...props} />;
      case "lesson": return <LessonPlayer content={activity.content} onComplete={() => handleComplete()} />;
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href={`/dashboard/courses/${courseId}`}
          className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" />{t("backToCourse")}
        </Link>
        <span className="text-xs text-on-surface-variant">
          Module {moduleIndex + 1} / Activity {currentIdx + 1}
        </span>
      </div>

      {/* Activity header */}
      <div className="flex items-center gap-3">
        <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${PHASE_COLORS[activity.phase]}`}>
          {activity.phase}
        </span>
        <h1 className="text-xl font-bold text-on-surface">{activity.title}</h1>
        <span className="text-xs text-on-surface-variant ml-auto">{activity.duration_minutes} min</span>
      </div>

      {/* Player */}
      <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-6 shadow-sm">
        {renderPlayer()}
      </div>

      {/* Completed state */}
      {completed && (
        <div className="text-center py-4">
          <p className="text-lg font-bold text-green-600">{t("completed")}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {prevActivity ? (
          <Link
            href={`/dashboard/courses/${courseId}/activity/${prevActivity.id}`}
            className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface"
          >
            <ChevronLeft className="h-4 w-4" />{t("previousActivity")}
          </Link>
        ) : <div />}
        {nextActivity ? (
          <Link
            href={`/dashboard/courses/${courseId}/activity/${nextActivity.id}`}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
          >
            {t("nextActivity")}<ChevronRight className="h-4 w-4" />
          </Link>
        ) : <div />}
      </div>
    </div>
  );
}
