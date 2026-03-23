"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markLessonCompleteAction } from "@/app/actions/enrollment";
import type { LessonWithContext } from "@/lib/api/courses";

interface VideoRendererProps {
  lesson: LessonWithContext;
  courseSlug: string;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match?.[1] ?? null;
}

export function VideoRenderer({ lesson }: VideoRendererProps) {
  const [isPending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(
    lesson.progress?.status === "completed"
  );

  const videoUrl = lesson.video_url;
  const youtubeId = videoUrl ? getYouTubeId(videoUrl) : null;

  const handleComplete = () => {
    startTransition(async () => {
      await markLessonCompleteAction(lesson.id, lesson.course.id);
      setCompleted(true);
    });
  };

  return (
    <div>
      {/* Video embed */}
      <div className="overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-lowest soft-shadow">
        {youtubeId ? (
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title={lesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-on-surface-variant">
            <p>Video will be available soon</p>
          </div>
        )}
      </div>

      {/* Description */}
      {(lesson.content as { description?: string }).description && (
        <p className="mt-4 text-sm text-on-surface-variant">
          {(lesson.content as { description?: string }).description}
        </p>
      )}

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
