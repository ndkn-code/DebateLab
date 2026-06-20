"use client";

import { useTranslations } from "next-intl";
import {
  parsePromptSegments,
  DEFAULT_BLANK_ID,
} from "@/lib/ielts/question-types";
import type { IeltsImageHotspot } from "@/lib/ielts/question-types";
import { Text } from "@/components/ui/typography";
import type { IeltsRendererProps } from "./types";
import { BlankControl } from "./BlankControl";
import type { ChoiceState } from "./ChoiceTile";
import { QuestionShell } from "./QuestionShell";

/**
 * diagram_label / map_plan_label. With an image visual, each hotspot is a
 * numbered pin on the figure plus a labelled input below; without one, falls
 * back to inline `__BLANK__` markers or a single input. Blanks become dropdowns
 * when the question carries an option bank (label-from-a-box), matching the grader.
 */
export function LabelingRenderer({
  question,
  value,
  onChange,
  disabled,
  verdict,
}: IeltsRendererProps) {
  const t = useTranslations("ielts.player");
  const locked = disabled || verdict != null;
  const bank = question.options.length > 0 ? question.options : undefined;

  const blankState = (blankId: string): ChoiceState => {
    const blank = verdict?.blanks[blankId];
    if (!blank) return "idle";
    return blank.correct ? "correct" : "incorrect";
  };

  const renderBlank = (blankId: string, ariaLabel: string, layout: "inline" | "block") => (
    <BlankControl
      blankId={blankId}
      value={value}
      onChange={onChange}
      options={bank}
      disabled={locked}
      state={blankState(blankId)}
      ariaLabel={ariaLabel}
      placeholder={t("blankPlaceholder")}
      layout={layout}
    />
  );

  if (question.visual?.kind === "image") {
    const { url, alt, hotspots } = question.visual;
    return (
      <QuestionShell
        instructions={question.groupInstructions}
        prompt={question.prompt}
        wordLimit={question.wordLimit}
      >
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- authored diagrams are arbitrary remote assets */}
          <img src={url} alt={alt ?? ""} className="w-full rounded-2xl border border-outline-variant" />
          {hotspots.map((hotspot: IeltsImageHotspot, index) => (
            <span
              key={hotspot.id}
              style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
              className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary"
            >
              {hotspot.label ?? index + 1}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {hotspots.map((hotspot, index) => (
            <div key={hotspot.id} className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-container text-sm font-bold text-on-surface-variant">
                {hotspot.label ?? index + 1}
              </span>
              {renderBlank(hotspot.id, hotspot.label ?? `${index + 1}`, "block")}
            </div>
          ))}
        </div>
      </QuestionShell>
    );
  }

  // Fallback: inline-blank prompt or a single input.
  const segments = parsePromptSegments(question.prompt);
  const hasBlanks = segments.some((segment) => segment.type === "blank");

  return (
    <QuestionShell instructions={question.groupInstructions} wordLimit={question.wordLimit}>
      {hasBlanks ? (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-2.5">
          {segments.map((segment, index) =>
            segment.type === "text" ? (
              <span key={index} className="type-body text-on-surface">
                {segment.text}
              </span>
            ) : (
              <span key={index}>{renderBlank(segment.id, t("blankLabel", { id: segment.id }), "inline")}</span>
            ),
          )}
        </p>
      ) : (
        <>
          <Text variant="body-lg" className="font-semibold text-on-surface">
            {question.prompt}
          </Text>
          {renderBlank(DEFAULT_BLANK_ID, question.prompt, "block")}
        </>
      )}
    </QuestionShell>
  );
}
