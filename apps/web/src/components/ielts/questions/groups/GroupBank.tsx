"use client";

/**
 * The shared option bank of a group. Desktop answer mode: draggable chips that
 * also fill the currently armed blank on click. Compact viewports and verdict
 * mode: a static legend. With `bankReuse` off, a placed option greys out.
 */
import type { KeyboardEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import type { IeltsOption } from "@/lib/ielts/question-types";
import { cn } from "@/lib/utils";
import { bankOptionFullLabel, canPlaceOption } from "./group-answers";
import { optionDragId, useGroupContext } from "./group-context";

const CHIP_CLASS =
  "inline-flex max-w-full items-center gap-1.5 rounded-lg border border-outline-variant bg-surface px-2.5 py-1 text-left type-body-sm text-on-surface";

function BankChip({ option }: { option: IeltsOption }) {
  const t = useTranslations("ielts.player.groups");
  const ctx = useGroupContext();
  const used = !ctx.group.bankReuse && ctx.used.has(option.id);
  const armed = ctx.armedQuestionId;
  const placeable =
    armed !== null && canPlaceOption(ctx.group, ctx.responses, ctx.used, armed, option.id);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: optionDragId(option.id),
    disabled: ctx.locked || used,
    data: { optionId: option.id },
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (armed !== null && placeable && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      ctx.fill(armed, option.id);
      return;
    }
    listeners?.onKeyDown?.(event);
  };

  return (
    <li className="max-w-full">
      <button
        ref={setNodeRef}
        type="button"
        data-exam-control
        {...attributes}
        {...listeners}
        onKeyDown={handleKeyDown}
        onClick={() => {
          if (armed !== null && placeable) ctx.fill(armed, option.id);
        }}
        aria-disabled={used || undefined}
        title={used ? t("optionUsed", { option: option.label ?? option.text }) : undefined}
        style={{ transform: CSS.Translate.toString(transform) }}
        className={cn(
          CHIP_CLASS,
          "touch-none select-none",
          used ? "cursor-not-allowed opacity-50" : "cursor-grab",
          isDragging && "relative z-10 cursor-grabbing border-primary shadow-md",
          !used && armed !== null && placeable && "hover:border-primary hover:bg-primary-container",
        )}
      >
        {option.label ? <span className="font-semibold">{option.label}</span> : null}
        <span className="min-w-0 break-words">{option.text}</span>
      </button>
    </li>
  );
}

export function GroupBank({ className }: { className?: string }) {
  const t = useTranslations("ielts.player.groups");
  const ctx = useGroupContext();
  const interactive = !ctx.compact && !ctx.locked;

  return (
    <div className={cn("rounded-lg bg-surface-container-low p-3", className)}>
      <p className="mb-2 type-caption font-semibold uppercase tracking-wide text-on-surface-variant">
        {t("bankTitle")}
      </p>
      <ul className="flex flex-wrap gap-2" aria-label={t("bankTitle")}>
        {ctx.group.bank.map((option) =>
          interactive ? (
            <BankChip key={option.id} option={option} />
          ) : (
            <li
              key={option.id}
              className={cn(
                CHIP_CLASS,
                !ctx.group.bankReuse && ctx.used.has(option.id) && "opacity-50",
              )}
            >
              {bankOptionFullLabel(option)}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
