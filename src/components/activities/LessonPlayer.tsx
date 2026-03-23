"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Check, BookOpen, Play } from "lucide-react";
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
    if (completed) return;
    setCompleted(true);
    onComplete();
  };

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto px-4">
      {c.type === "article" ? (
        <div className="w-full">
          {/* Article icon */}
          <div className="flex items-center gap-2 mb-6 text-on-surface-variant">
            <BookOpen className="h-5 w-5" />
            <span className="text-sm font-medium">Reading</span>
          </div>

          {/* Article body */}
          <article className="prose prose-lg max-w-none prose-headings:text-on-surface prose-p:text-on-surface/80 prose-p:leading-relaxed prose-a:text-primary prose-strong:text-on-surface prose-li:text-on-surface/80">
            <ReactMarkdown>{c.body ?? ""}</ReactMarkdown>
          </article>
        </div>
      ) : (
        <div className="w-full">
          {/* Video icon */}
          <div className="flex items-center gap-2 mb-6 text-on-surface-variant">
            <Play className="h-5 w-5" />
            <span className="text-sm font-medium">Video</span>
          </div>

          {c.video_url && (
            <div className="aspect-video rounded-2xl overflow-hidden bg-black shadow-lg">
              <iframe
                src={
                  c.video_url.includes("youtube.com") || c.video_url.includes("youtu.be")
                    ? `https://www.youtube-nocookie.com/embed/${extractYouTubeId(c.video_url)}`
                    : c.video_url
                }
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="w-full border-t border-gray-100 mt-10 mb-6" />

      {/* Complete button */}
      <motion.button
        onClick={handleComplete}
        disabled={completed}
        className={`flex items-center justify-center gap-2 rounded-2xl px-8 py-3.5 text-base font-semibold transition-all min-w-[260px] ${
          completed
            ? "bg-green-100 text-green-700 cursor-default"
            : "bg-primary text-on-primary hover:bg-primary/90"
        }`}
        whileTap={completed ? undefined : { scale: 0.97 }}
      >
        {completed && <Check className="h-5 w-5" />}
        {completed
          ? t("completed")
          : c.type === "article"
          ? t("readAndContinue")
          : t("watchAndContinue")}
      </motion.button>
    </div>
  );
}

function extractYouTubeId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?#]+)/);
  return match?.[1] ?? "";
}
