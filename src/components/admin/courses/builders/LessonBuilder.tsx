"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import type { LessonContent, ActivityContent } from "@/lib/types/admin";

interface Props {
  content: ActivityContent;
  onChange: (content: ActivityContent) => void;
}

export function LessonBuilder({ content, onChange }: Props) {
  const t = useTranslations("admin.courses.builders.lesson");
  const c = content as LessonContent;
  const [tab, setTab] = useState<"write" | "preview">("write");

  const update = (changes: Partial<LessonContent>) =>
    onChange({ ...c, ...changes } as ActivityContent);

  return (
    <div className="space-y-3">
      {/* Type toggle */}
      <div className="flex gap-2">
        {(["article", "video"] as const).map((type) => (
          <button
            key={type}
            onClick={() => update({ type, body: c.body, video_url: c.video_url })}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              c.type === type ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {t(type)}
          </button>
        ))}
      </div>

      {c.type === "article" ? (
        <>
          <div className="flex gap-1 border-b border-outline-variant/10 pb-1">
            <button
              onClick={() => setTab("write")}
              className={`px-2 py-1 text-xs rounded-t-lg ${tab === "write" ? "bg-surface-container font-medium" : "text-on-surface-variant"}`}
            >
              {t("writeTab")}
            </button>
            <button
              onClick={() => setTab("preview")}
              className={`px-2 py-1 text-xs rounded-t-lg ${tab === "preview" ? "bg-surface-container font-medium" : "text-on-surface-variant"}`}
            >
              {t("previewTab")}
            </button>
          </div>
          {tab === "write" ? (
            <textarea
              value={c.body ?? ""}
              onChange={(e) => update({ body: e.target.value })}
              placeholder={t("bodyPlaceholder")}
              rows={12}
              className="w-full rounded-xl border border-outline-variant/20 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
            />
          ) : (
            <div className="rounded-xl border border-outline-variant/20 px-4 py-3 prose prose-sm max-w-none min-h-[200px]">
              <ReactMarkdown>{c.body ?? ""}</ReactMarkdown>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <input
            value={c.video_url ?? ""}
            onChange={(e) => update({ video_url: e.target.value })}
            placeholder={t("videoUrlPlaceholder")}
            className="w-full rounded-xl border border-outline-variant/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
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
          <div className="flex items-center gap-2">
            <label className="text-xs text-on-surface-variant">{t("videoDuration")}</label>
            <input
              type="number"
              value={c.video_duration_seconds ?? 0}
              onChange={(e) => update({ video_duration_seconds: Number(e.target.value) })}
              className="w-20 rounded-lg border border-outline-variant/20 px-2 py-1 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function extractYouTubeId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?#]+)/);
  return match?.[1] ?? "";
}
