"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markLessonCompleteAction } from "@/app/(protected)/courses/actions";
import type { LessonWithContext } from "@/lib/api/courses";

interface ArticleRendererProps {
  lesson: LessonWithContext;
  courseSlug: string;
}

export function ArticleRenderer({ lesson }: ArticleRendererProps) {
  const [isPending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(
    lesson.progress?.status === "completed"
  );

  const markdown =
    (lesson.content as { markdown?: string }).markdown ?? "";

  const handleComplete = () => {
    startTransition(async () => {
      await markLessonCompleteAction(lesson.id, lesson.course.id);
      setCompleted(true);
    });
  };

  return (
    <div>
      {/* Article content */}
      <div className="prose prose-sm max-w-none rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 sm:p-8 soft-shadow prose-headings:text-on-surface prose-p:text-on-surface-variant prose-strong:text-on-surface prose-li:text-on-surface-variant prose-a:text-primary">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>

      {/* Mark complete */}
      <div className="mt-6 flex justify-center">
        {completed ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
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
