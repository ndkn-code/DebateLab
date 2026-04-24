"use client";

import { useTranslations } from "next-intl";
import { ListChecks, PlayCircle } from "lucide-react";
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
  const t = useTranslations("dashboard.courses");
  const content = lesson.content as { description?: string; notes?: string };
  const videoUrl = lesson.video_url;
  const youtubeId = videoUrl ? getYouTubeId(videoUrl) : null;
  const notes = content.notes
    ?.split("\n")
    .map((note) => note.trim())
    .filter(Boolean) ?? [];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-white shadow-[0_26px_80px_-56px_rgba(22,39,91,0.42)]">
        <div className="border-b border-outline-variant/10 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-6 py-4 sm:px-8">
          <div className="flex items-center gap-3 text-sm text-on-surface-variant">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <PlayCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-on-surface">
                {t("reader.video_panel_title")}
              </p>
              <p>{t("reader.video_panel_description")}</p>
            </div>
          </div>
        </div>

        {youtubeId ? (
          <div className="relative w-full bg-slate-950" style={{ paddingBottom: "56.25%" }}>
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title={lesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center px-6 text-center text-on-surface-variant sm:px-8">
            <div>
              <p className="text-base font-semibold text-on-surface">
                {t("reader.video_missing_title")}
              </p>
              <p className="mt-2 text-sm">
                {t("reader.video_missing_description")}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-outline-variant/15 bg-white p-5 shadow-[0_18px_50px_-44px_rgba(22,39,91,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("reader.video_why_matters")}
          </p>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">
            {content.description ??
              t("reader.video_why_matters_fallback")}
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-outline-variant/15 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_18px_50px_-44px_rgba(77,134,247,0.35)]">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ListChecks className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {t("reader.video_watch_for")}
              </p>
              {notes.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {notes.map((note) => (
                    <li key={note} className="flex items-start gap-2 text-sm text-on-surface-variant">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{note.replace(/^\d+\.\s*/, "")}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                  {t("reader.video_watch_for_fallback")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
