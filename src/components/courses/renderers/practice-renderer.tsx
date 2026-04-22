"use client";

import { useMemo, useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Mic2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildPracticeHref, type PracticeMode, type PracticeSide } from "@/lib/practice-prefill";
import { cn } from "@/lib/utils";
import { markLessonCompleteAction } from "@/app/actions/enrollment";
import type { LessonWithContext } from "@/lib/api/courses";
import type { AiDifficulty, PracticeTrack } from "@/types";

interface PracticeRendererProps {
  lesson: LessonWithContext;
  courseSlug: string;
}

interface NormalizedPracticeConfig {
  topicTitle: string;
  topicCategory?: string;
  description?: string;
  mode: PracticeMode;
  difficulty: AiDifficulty;
  side: PracticeSide;
  practiceTrack: PracticeTrack;
}

interface LegacyPracticeContent {
  topic?: string;
  description?: string;
  mode?: string;
  difficulty?: AiDifficulty;
  side?: string;
  practice_track?: PracticeTrack;
  practice_config?: {
    topic_title?: string;
    topic_category?: string;
    description?: string;
    suggested_mode?: PracticeMode;
    suggested_difficulty?: AiDifficulty;
    suggested_side?: PracticeSide;
    practice_track?: PracticeTrack;
  };
}

const DIFFICULTY_COLORS = {
  easy: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  hard: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

export function PracticeRenderer({ lesson, courseSlug }: PracticeRendererProps) {
  const t = useTranslations("dashboard.courses");
  const tPractice = useTranslations("dashboard.practice");
  const [isPending, startTransition] = useTransition();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [completed, setCompleted] = useState(
    lesson.progress?.status === "completed"
  );

  const config = useMemo(
    () => normalizePracticeConfig(lesson),
    [lesson]
  );
  const practiceHref = useMemo(
    () =>
      buildPracticeHref({
        topicTitle: config.topicTitle,
        topicCategory: config.topicCategory,
        topicDescription: config.description,
        practiceTrack: config.practiceTrack,
        mode: config.mode,
        aiDifficulty: config.difficulty,
        side: config.side,
      }),
    [config]
  );
  const coachPrompt =
    config.practiceTrack === "speaking"
      ? `Help me turn the topic "${config.topicTitle}" into a clear speaking outline with an opening, two main points, and a strong closing.`
      : `Help me prepare for the motion "${config.topicTitle}". Give me a stance, two strong arguments, the weighing, and the most likely rebuttal I need to answer.`;
  const coachHref = `/chat?message=${encodeURIComponent(
    coachPrompt
  )}&context=course&contextId=${lesson.course.id}`;

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
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 sm:p-8 soft-shadow">
      {/* Practice config */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container/30">
          <Mic2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-on-surface">
            {config.topicTitle || t("practice.title_fallback")}
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
        <Badge variant="outline" className="text-xs px-2.5 py-0.5">
          {config.practiceTrack === "speaking"
            ? tPractice("speaking_practice")
            : tPractice("debate_practice")}
        </Badge>
        <Badge variant="outline" className="text-xs px-2.5 py-0.5">
          {getModeLabel(config.practiceTrack, config.mode, tPractice)}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            "text-xs px-2.5 py-0.5",
            DIFFICULTY_COLORS[config.difficulty]
          )}
        >
          {tPractice(config.difficulty)}
        </Badge>
        <Badge variant="outline" className="text-xs px-2.5 py-0.5">
          {getSideLabel(config.side, tPractice)}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-4">
        <Link href={practiceHref}>
          <Button size="lg" className="gap-2 bg-primary text-on-primary">
            <Mic2 className="h-4 w-4" />
            {t("practice.start_now")}
          </Button>
        </Link>

        <Button
          variant="outline"
          onClick={() => setSummaryOpen(true)}
          className="border-outline-variant/20 text-on-surface"
        >
          {t("practice.preview_brief")}
        </Button>

        {completed ? (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">{t("practice.completed")}</span>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={handleComplete}
            disabled={isPending}
            className="border-outline-variant/20 text-on-surface-variant"
          >
            {isPending ? t("practice.saving") : t("practice.mark_complete")}
          </Button>
        )}
      </div>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("practice.summary_title")}</DialogTitle>
            <DialogDescription>
              {t("practice.summary_description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                {t("practice.focus_area")}
              </p>
              <h4 className="mt-2 text-lg font-semibold text-on-surface">
                {config.topicTitle}
              </h4>
              {config.description ? (
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  {config.description}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryStat
                label={tPractice("practice_track")}
                value={
                  config.practiceTrack === "speaking"
                    ? tPractice("speaking_practice")
                    : tPractice("debate_practice")
                }
              />
              <SummaryStat
                label={tPractice("mode")}
                value={getModeLabel(config.practiceTrack, config.mode, tPractice)}
              />
              <SummaryStat
                label={tPractice("ai_difficulty")}
                value={tPractice(config.difficulty)}
              />
              <SummaryStat
                label={tPractice("your_side")}
                value={getSideLabel(config.side, tPractice)}
              />
            </div>

            <p className="text-sm text-on-surface-variant">
              {t("practice.launch_note")}
            </p>
          </div>

          <DialogFooter>
            <Link href={coachHref}>
              <Button variant="outline" className="w-full sm:w-auto">
                {t("practice.coach_prep")}
              </Button>
            </Link>
            <Link href={practiceHref}>
              <Button className="w-full bg-primary text-on-primary sm:w-auto">
                {t("practice.start_now")}
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function normalizePracticeConfig(lesson: LessonWithContext): NormalizedPracticeConfig {
  const content = lesson.content as LegacyPracticeContent;
  const nestedConfig = content.practice_config;
  const practiceTrack =
    nestedConfig?.practice_track ??
    content.practice_track ??
    (lesson.course.category === "public-speaking" ? "speaking" : "debate");

  return {
    topicTitle:
      nestedConfig?.topic_title ?? content.topic ?? lesson.title,
    topicCategory: nestedConfig?.topic_category,
    description: nestedConfig?.description ?? content.description,
    mode: nestedConfig?.suggested_mode ?? toMode(content.mode),
    difficulty:
      nestedConfig?.suggested_difficulty ?? toDifficulty(content.difficulty),
    side: nestedConfig?.suggested_side ?? toSide(content.side),
    practiceTrack,
  };
}

function toMode(mode?: string): PracticeMode {
  return mode === "full" ? "full" : "quick";
}

function toDifficulty(difficulty?: AiDifficulty): AiDifficulty {
  return difficulty === "easy" || difficulty === "hard" ? difficulty : "medium";
}

function toSide(side?: string): PracticeSide {
  return side === "proposition" || side === "opposition" ? side : "random";
}

function getModeLabel(
  practiceTrack: PracticeTrack,
  mode: PracticeMode,
  tPractice: ReturnType<typeof useTranslations>
) {
  if (practiceTrack === "speaking") {
    return tPractice("single_speech");
  }

  return mode === "full"
    ? tPractice("full_round")
    : tPractice("quick_practice");
}

function getSideLabel(
  side: PracticeSide,
  tPractice: ReturnType<typeof useTranslations>
) {
  if (side === "proposition") return tPractice("for");
  if (side === "opposition") return tPractice("against");
  return tPractice("random");
}

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-on-surface-variant">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-on-surface">{value}</p>
    </div>
  );
}
