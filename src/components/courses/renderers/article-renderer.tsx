"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import checkmarkAnimation from "../../../../public/lottie/checkmark.json";
import { markLessonCompleteAction } from "@/app/actions/enrollment";
import type { LessonWithContext } from "@/lib/api/courses";

interface ArticleRendererProps {
  lesson: LessonWithContext;
  courseSlug: string;
}

export function ArticleRenderer({ lesson, courseSlug }: ArticleRendererProps) {
  const [isPending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(
    lesson.progress?.status === "completed"
  );

  const markdown =
    (lesson.content as { markdown?: string }).markdown ?? "";

  const handleComplete = () => {
    startTransition(async () => {
      await markLessonCompleteAction(
        lesson.id,
        lesson.course.id,
        undefined,
        undefined,
        courseSlug
      );
      setCompleted(true);
    });
  };

  return (
    <div>
      {/* Article content */}
      <div className="rounded-[1.5rem] border border-outline-variant/15 bg-surface-container-lowest p-6 sm:p-8 soft-shadow">
        <MarkdownRenderer content={markdown} />
      </div>

      {/* Mark complete */}
      <div className="mt-6 flex justify-center">
        {completed ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <LottieAnimation animationData={checkmarkAnimation} className="w-16 h-16" loop={false} />
            <span className="font-medium">Lesson completed</span>
          </div>
        ) : (
          <Button
            onClick={handleComplete}
            disabled={isPending}
            className="bg-primary text-on-primary"
            size="lg"
          >
            {isPending ? "Saving..." : "Mark as Complete"}
          </Button>
        )}
      </div>
    </div>
  );
}
