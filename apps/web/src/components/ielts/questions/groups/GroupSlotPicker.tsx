"use client";

/**
 * The picker a filled bank slot opens: every bank option (used ones greyed
 * when the bank cannot be reused) plus Clear.
 */
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { X } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { canPlaceOption } from "./group-answers";
import { useGroupContext } from "./group-context";

export function GroupSlotPicker({
  questionId,
  current,
  ariaLabel,
  triggerClassName,
  children,
}: {
  questionId: string;
  current: string;
  ariaLabel: string;
  triggerClassName: string;
  children: ReactNode;
}) {
  const t = useTranslations("ielts.player.groups");
  const ctx = useGroupContext();
  const [open, setOpen] = useState(false);
  const pick = (optionId: string | null) => {
    ctx.fill(questionId, optionId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        data-exam-control
        aria-label={ariaLabel}
        title={ariaLabel}
        className={triggerClassName}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" showArrow={false} className="w-64 p-1.5">
        <ul
          className="flex max-h-72 flex-col gap-0.5 overflow-y-auto"
          role="listbox"
          aria-label={t("bankTitle")}
        >
          {ctx.group.bank.map((option) => {
            const placeable = canPlaceOption(ctx.group, ctx.responses, ctx.used, questionId, option.id);
            const selected = option.id === current;
            return (
              <li key={option.id}>
                <button
                  type="button"
                  data-exam-control
                  role="option"
                  aria-selected={selected}
                  disabled={!placeable}
                  title={placeable ? undefined : t("optionUsed", { option: option.label ?? option.text })}
                  onClick={() => pick(option.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left type-body-sm text-on-surface",
                    selected ? "bg-primary-container text-on-primary-container" : "hover:bg-surface-container",
                    !placeable && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span className="w-5 shrink-0 font-semibold">{option.label}</span>
                  <span className="min-w-0 flex-1 truncate">{option.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          data-exam-control
          onClick={() => pick(null)}
          className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-outline-variant px-2.5 py-1.5 type-body-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        >
          <X className="size-3.5" aria-hidden="true" />
          {t("clearSlot")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
