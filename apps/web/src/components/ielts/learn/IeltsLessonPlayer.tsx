"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Clock3 } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { PageContainer, ProductPageShell } from "@/components/shared/product-layout";
import { showToast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import { getElapsedSecondsSince } from "@/lib/time";
import { completeActivity } from "@/app/actions/activities";
import { loadIeltsSubskillMasterySnapshot } from "@/app/actions/ielts-learn";
import { diffMastery, type MasteryDelta, type SubskillMastery } from "@/lib/ielts/learner/learn-path";
import type { IeltsTextActivityFeedback } from "@/lib/ielts/learn/text-activities";
import { getActivityPlayerDefinition } from "@/components/activities/player-registry";
import { LessonCompletionScreen } from "./LessonCompletionScreen";

export interface IeltsLessonPlayerProps {
  activityId: string;
  courseId: string;
  activityTitle: string;
  activityType: string;
  content: unknown;
  estimatedMinutes: number;
  unitTitle: string;
  pathHref: string;
  unitHref: string;
  nextLessonHref: string | null;
  subskillKeys: string[];
  beforeMastery: SubskillMastery[];
}

interface CompletionResult {
  xpEarned: number;
  score: number;
  maxScore: number;
  feedback?: IeltsTextActivityFeedback;
  masteryDelta: MasteryDelta[];
  saveError: boolean;
}

/**
 * Lesson player wrapper (WS-6.2.3 / WS-D.6). Renders the registered IELTS micro-
 * activity player from the shared registry and drives completion through the
 * EXISTING `completeActivity` server action — which already re-scores, writes the
 * adaptive evidence + refreshes `ielts_skill_states`, and awards XP/streak
 * (`lesson_completed`). We do not re-award; we only read the updated mastery back
 * for the completion screen's before→after delta.
 */
export function IeltsLessonPlayer(props: IeltsLessonPlayerProps) {
  const t = useTranslations("dashboard.ielts.learn");
  const [result, setResult] = useState<CompletionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const startedAt = useRef<number | null>(null);

  // Stamp the start time on mount (impure during render); elapsed handles null.
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const definition = getActivityPlayerDefinition(props.activityType);
  const Player = definition?.Player;

  const handleComplete = async (
    score?: number,
    maxScore?: number,
    responses?: Record<string, unknown>,
  ) => {
    if (saving || result) return;
    setSaving(true);
    const elapsed = getElapsedSecondsSince(startedAt.current);

    let completion: CompletionResult = {
      xpEarned: 0,
      score: score ?? 0,
      maxScore: maxScore ?? 0,
      masteryDelta: [],
      saveError: false,
    };

    try {
      const saved = await completeActivity(
        props.activityId,
        props.courseId,
        score ?? 0,
        maxScore ?? 0,
        responses ?? {},
        0,
        elapsed,
      );
      completion = {
        xpEarned: saved.xpEarned,
        score: saved.score,
        maxScore: saved.maxScore,
        feedback: saved.feedback,
        masteryDelta: [],
        saveError: false,
      };
      showToast(t("toast_completed"), "success");
      // `completeActivity` has already refreshed skill states — read them back.
      try {
        const after = await loadIeltsSubskillMasterySnapshot(props.subskillKeys);
        completion.masteryDelta = diffMastery(props.subskillKeys, props.beforeMastery, after);
      } catch {
        completion.masteryDelta = [];
      }
    } catch {
      completion.saveError = true;
      showToast(t("save_error"), "error");
    }

    setResult(completion);
    setSaving(false);
  };

  if (result) {
    return (
      <LessonCompletionScreen
        lessonTitle={props.activityTitle}
        unitTitle={props.unitTitle}
        result={result}
        nextLessonHref={props.nextLessonHref}
        unitHref={props.unitHref}
        pathHref={props.pathHref}
      />
    );
  }

  return (
    <ProductPageShell>
      <PageContainer size="focused" className="flex flex-col gap-6 py-6 lg:py-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={props.unitHref}
            className="inline-flex items-center gap-1.5 type-body-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            <ArrowLeft className="size-4" />
            {props.unitTitle}
          </Link>
          <span className="inline-flex items-center gap-1 type-caption font-semibold text-on-surface-variant">
            <Clock3 className="size-3.5" />
            {t("minutes", { count: props.estimatedMinutes })}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <p className="type-eyebrow font-semibold uppercase text-primary">{t("lesson_eyebrow")}</p>
          <h1 className="type-heading-lg font-bold text-on-surface">{props.activityTitle}</h1>
        </div>

        <div
          aria-busy={saving}
          className="rounded-3xl border border-outline-variant bg-surface-container p-5 sm:p-6"
        >
          {Player ? (
            <Player content={props.content} onComplete={handleComplete} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <h2 className="type-title font-semibold text-on-surface">
                {t("player_unavailable_title")}
              </h2>
              <p className="max-w-sm type-body-sm text-on-surface-variant">
                {t("player_unavailable_body")}
              </p>
              <Link
                href={props.unitHref}
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
              >
                {t("finish_cta")}
              </Link>
            </div>
          )}
        </div>

        {saving ? (
          <p className="text-center type-body-sm text-on-surface-variant">{t("completing")}</p>
        ) : null}
      </PageContainer>
    </ProductPageShell>
  );
}
