"use client";

import { useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { Mic2, CheckCircle2, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markLessonCompleteAction } from "@/app/[locale]/(protected)/courses/actions";
import type { LessonWithContext } from "@/lib/api/courses";

interface PracticeRendererProps {
  lesson: LessonWithContext;
  courseSlug: string;
}

const DIFFICULTY_COLORS = {
  easy: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  hard: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

export function PracticeRenderer({ lesson }: PracticeRendererProps) {
  const [isPending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(
    lesson.progress?.status === "completed"
  );

  const config = lesson.content as {
    topic?: string;
    description?: string;
    mode?: string;
    difficulty?: "easy" | "medium" | "hard";
    side?: string;
  };

  const handleComplete = () => {
    startTransition(async () => {
      await markLessonCompleteAction(lesson.id, lesson.course.id);
      setCompleted(true);
    });
  };

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 sm:p-8 soft-shadow">
      {/* Practice config */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container/30">
          <Mic2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-on-surface">
            {config.topic ?? "Practice Session"}
          </h3>
          {config.description && (
            <p className="mt-1 text-sm text-on-surface-variant">
              {config.description}
            </p>
          )}
        </div>
      </div>

      {/* Config details */}
      <div className="mb-6 flex flex-wrap gap-2">
        {config.mode && (
          <Badge variant="outline" className="text-xs px-2.5 py-0.5">
            {config.mode} mode
          </Badge>
        )}
        {config.difficulty && (
          <Badge
            variant="outline"
            className={cn(
              "text-xs px-2.5 py-0.5",
              DIFFICULTY_COLORS[config.difficulty]
            )}
          >
            {config.difficulty}
          </Badge>
        )}
        {config.side && (
          <Badge variant="outline" className="text-xs px-2.5 py-0.5">
            {config.side}
          </Badge>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-4">
        <Link href="/practice">
          <Button size="lg" className="gap-2 bg-primary text-on-primary">
            <Mic2 className="h-4 w-4" />
            Start Practice Session
          </Button>
        </Link>

        {completed ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Practice completed</span>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={handleComplete}
            disabled={isPending}
            className="border-outline-variant/20 text-on-surface-variant"
          >
            {isPending ? "Saving..." : "Mark as Complete"}
          </Button>
        )}
      </div>
    </div>
  );
}
