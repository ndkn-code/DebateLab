"use client";

/**
 * One bank-driven blank. Desktop: a drop target that arms on click (then a
 * bank chip fills it) and, once filled, opens a picker popover. Compact
 * viewports swap the target for a `Select`. Verdict mode renders a static,
 * colour-coded value.
 */
import { useDroppable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import { Check, X } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { groupSlotValue } from "@/lib/ielts/question-groups";
import type { QuestionNumber } from "@/lib/ielts/question-groups";
import type { IeltsOption } from "@/lib/ielts/question-types";
import { cn } from "@/lib/utils";
import type { ChoiceState } from "../ChoiceTile";
import {
  bankOptionFullLabel,
  bankOptionLabel,
  canPlaceOption,
  findBankOption,
  slotVerdictState,
} from "./group-answers";
import { slotDropId, useGroupContext } from "./group-context";
import { GroupSlotPicker } from "./GroupSlotPicker";
import type { SlotLayout } from "./types";

interface Props {
  questionId: string;
  number: QuestionNumber;
  layout: SlotLayout;
}

const LAYOUT_CLASS: Record<SlotLayout, string> = {
  inline: "h-8 min-w-14 rounded-lg px-2 type-body-sm",
  block: "h-9 w-full min-w-0 justify-start rounded-lg px-3 type-body-sm",
  pin: "size-7 rounded-full type-caption shadow-sm ring-2 ring-surface",
};

function stateClass(state: ChoiceState, filled: boolean, armed: boolean, over: boolean): string {
  if (state === "correct") return "border-success bg-success-container text-on-success-container";
  if (state === "incorrect") return "border-error bg-error-container text-on-error-container";
  if (over) return "border-primary bg-primary-container text-on-primary-container";
  const base = filled
    ? "border-outline-variant bg-surface-container font-semibold text-on-surface"
    : "border-dashed border-outline bg-surface text-on-surface-variant";
  return cn(base, armed && "border-primary ring-2 ring-primary");
}

/** What the slot prints: the option's label (block layout adds its text). */
function slotDisplay(
  bank: readonly IeltsOption[],
  current: string | null,
  layout: SlotLayout,
): string {
  if (current === null) return "";
  const option = findBankOption(bank, current);
  if (layout === "block" && option) return bankOptionFullLabel(option);
  return bankOptionLabel(bank, current);
}

function CompactSlotSelect({ questionId, number, layout, current, state }: Props & {
  current: string | null;
  state: ChoiceState;
}) {
  const t = useTranslations("ielts.player.groups");
  const ctx = useGroupContext();
  return (
    <Select
      aria-label={t("pickForSlot", { number: number.label })}
      disabled={ctx.locked}
      value={current ?? ""}
      onChange={(event) => ctx.fill(questionId, event.target.value || null)}
      className={cn(
        "h-9",
        layout === "inline" ? "w-32" : "w-full",
        stateClass(state, current !== null, false, false),
      )}
    >
      <option value="">{number.label}</option>
      {ctx.group.bank.map((option) => (
        <option
          key={option.id}
          value={option.id}
          disabled={!canPlaceOption(ctx.group, ctx.responses, ctx.used, questionId, option.id)}
        >
          {bankOptionFullLabel(option)}
        </option>
      ))}
    </Select>
  );
}

export function GroupSlot({ questionId, number, layout }: Props) {
  const t = useTranslations("ielts.player.groups");
  const tp = useTranslations("ielts.player");
  const ctx = useGroupContext();
  const current = groupSlotValue(ctx.responses, questionId);
  const filled = current !== null;
  const state = slotVerdictState(ctx.verdicts, questionId);
  const armed = ctx.armedQuestionId === questionId;
  const { setNodeRef, isOver } = useDroppable({
    id: slotDropId(questionId),
    disabled: ctx.locked || ctx.compact,
  });
  const shortLabel = bankOptionLabel(ctx.group.bank, current);
  const ariaLabel = filled
    ? t("slotFilled", { number: number.label, option: shortLabel })
    : t("slotEmpty", { number: number.label });
  const shape = cn(
    "inline-flex items-center justify-center gap-1 border-2 align-middle transition-colors",
    LAYOUT_CLASS[layout],
    stateClass(state, filled, armed, isOver),
  );
  const text = filled
    ? slotDisplay(ctx.group.bank, current, layout)
    : layout === "block"
      ? tp("matchSelect")
      : number.label;

  if (ctx.compact && ctx.mode === "answer") {
    return (
      <CompactSlotSelect
        questionId={questionId}
        number={number}
        layout={layout}
        current={current}
        state={state}
      />
    );
  }

  if (ctx.locked) {
    return (
      <span className={shape} aria-label={ariaLabel} title={ariaLabel}>
        <span className="truncate">{text}</span>
        {state === "correct" ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
        {state === "incorrect" ? <X className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      </span>
    );
  }

  const wrapper = cn("inline-flex align-middle", layout === "block" && "w-full");
  const interactive = cn(shape, "cursor-pointer hover:border-primary");

  return (
    <span ref={setNodeRef} className={wrapper}>
      {filled ? (
        <GroupSlotPicker
          questionId={questionId}
          current={current}
          ariaLabel={ariaLabel}
          triggerClassName={interactive}
        >
          <span className="truncate">{text}</span>
        </GroupSlotPicker>
      ) : (
        <button
          type="button"
          data-exam-control
          aria-pressed={armed}
          aria-label={ariaLabel}
          onClick={() => ctx.arm(armed ? null : questionId)}
          className={interactive}
        >
          <span className="truncate">{text}</span>
        </button>
      )}
    </span>
  );
}
