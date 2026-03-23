"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import { Check } from "lucide-react";
import type { LessonContent, ActivityContent } from "@/lib/types/admin";

interface Props {
  content: ActivityContent;
  onComplete: () => void;
}

export function LessonPlayer({ content, onComplete }: Props) {
  const t = useTranslations("courses.player");
  const c = content as LessonContent;
  const [completed, setCompleted] = useState(false);

  const handleComplete = () => {
    setCompleted(true);
    onComplete();
  };

  return (
    <div className="space-y-6">
      {c.type === "article" ? (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{c.body ?? ""}</ReactMarkdown>
        </div>
      ) : (
        <>
          {c.video_url && (
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              <iframe
                src={c.video_url.includes("youtube.com") || c.video_url.includes("youtu.be")
                  ? `https://www.youtube-nocookie.com/embed/${extractYouTubeId(c.video_url)}`
                  : c.video_url}
                className="w-full h-full"
                allowFullScreen
              />
            </div>
          )}
        </>
      )}

      <div className="flex justify-center">
        <button
          onClick={handleComplete}
          disabled={completed}
          className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium transition-colors ${
            completed
              ? "bg-green-100 text-green-700"
              : "bg-primary text-on-primary hover:bg-primary/90"
          }`}
        >
          {completed ? <Check className="h-4 w-4" /> : null}
          {completed ? t("completed") : t("markComplete")}
        </button>
      </div>
    </div>
  );
}

function extractYouTubeId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?#]+)/);
  return match?.[1] ?? "";
}
