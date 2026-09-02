"use client";

/**
 * A numbered blank inside a group stimulus: number badge, flag toggle, and the
 * answer control (bank slot in select mode, text input otherwise). Carries the
 * `mock-q-<id>` anchor the navigator scrolls to.
 */
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { groupSlotValue } from "@/lib/ielts/question-groups";
import type { QuestionNumber } from "@/lib/ielts/question-groups";
import { cn } from "@/lib/utils";
import type { ChoiceState } from "../ChoiceTile";
import { FlagToggle } from "../FlagToggle";
import { slotVerdictState } from "./group-answers";
import { useGroupContext } from "./group-context";
import { GroupSlot } from "./GroupSlot";

const TEXT_MAX_LENGTH = 120;

export function NumberBadge({ label, size = "sm" }: { label: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary px-1.5 font-bold text-on-primary",
        size === "sm" ? "h-6 min-w-6 type-caption" : "h-7 min-w-7 type-body-sm",
      )}
    >
      {label}
    </span>
  );
}

function textStateClass(state: ChoiceState): string {
  if (state === "correct") return "border-success bg-success-container text-on-success-container";
  if (state === "incorrect") return "border-error bg-error-container text-on-error-container";
  return "";
}

/** Just the control — used by row layouts that draw their own number cell. */
export function SlotControl({
  questionId,
  number,
  layout,
  wordLimit,
}: {
  questionId: string;
  number: QuestionNumber;
  layout: "inline" | "block";
  wordLimit: number | null;
}) {
  const t = useTranslations("ielts.player.groups");
  const tp = useTranslations("ielts.player");
  const ctx = useGroupContext();

  if (ctx.selectMode) {
    return <GroupSlot questionId={questionId} number={number} layout={layout} />;
  }

  const state = slotVerdictState(ctx.verdicts, questionId);
  const hint = wordLimit !== null ? tp("wordLimitHint", { count: wordLimit }) : undefined;
  return (
    <Input
      type="text"
      autoComplete="off"
      spellCheck={false}
      maxLength={TEXT_MAX_LENGTH}
      value={groupSlotValue(ctx.responses, questionId) ?? ""}
      disabled={ctx.locked}
      placeholder={t("textPlaceholder")}
      aria-label={t("slotEmpty", { number: number.label })}
      title={hint}
      onChange={(event) => ctx.setText(questionId, event.target.value)}
      className={cn(
        "h-8 align-middle type-body-sm",
        layout === "inline" ? "w-36 px-2" : "w-full",
        textStateClass(state),
      )}
    />
  );
}

/** Inert blank for a stimulus slot no member question fills. */
export function MissingBlank({ layout = "inline" }: { layout?: "inline" | "block" }) {
  const t = useTranslations("ielts.player.groups");
  return (
    <span
      role="img"
      aria-label={t("missingSlot")}
      title={t("missingSlot")}
      className={cn(
        "inline-block h-8 rounded-lg border-2 border-dashed border-outline-variant align-middle",
        layout === "inline" ? "w-14" : "w-full",
      )}
    />
  );
}

export function NumberedBlank({
  questionId,
  layout = "inline",
}: {
  questionId: string;
  layout?: "inline" | "block";
}) {
  const ctx = useGroupContext();
  const ref = ctx.slotList.find((entry) => entry.questionId === questionId);
  if (!ref) return <MissingBlank layout={layout} />;
  return (
    <span
      id={`mock-q-${questionId}`}
      className={cn(
        "scroll-mt-24 inline-flex items-center gap-1 align-middle",
        layout === "block" && "w-full",
      )}
    >
      <NumberBadge label={ref.number.label} />
      {ctx.mode === "answer" ? <FlagToggle questionId={questionId} size="sm" /> : null}
      <SlotControl
        questionId={questionId}
        number={ref.number}
        layout={layout}
        wordLimit={ref.wordLimit}
      />
    </span>
  );
}
