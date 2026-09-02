"use client";

import { useTranslations } from "next-intl";
import type { GroupPartBlock } from "@/lib/ielts/question-groups";
import { blockNumberRange } from "./group-answers";
import type { GroupMode } from "./types";

interface Props {
  block: GroupPartBlock;
  selectMode: boolean;
  compact: boolean;
  mode: GroupMode;
  /** Multi-select sets: "Choose N letters". */
  selectCount: number | null;
  headingId: string;
}

export function GroupHeader({ block, selectMode, compact, mode, selectCount, headingId }: Props) {
  const t = useTranslations("ielts.player.groups");
  const { first, last } = blockNumberRange(block);
  const rangeLabel =
    first === last ? t("questionsOne", { number: first }) : t("questionsRange", { first, last });
  const hints: string[] = [];
  if (selectCount !== null) hints.push(t("chooseCount", { count: selectCount }));
  if (block.group.anyOrder) hints.push(t("anyOrder"));
  if (selectMode && block.group.bankReuse) hints.push(t("reuseNote"));

  return (
    <header className="flex flex-col gap-1">
      <h3 id={headingId} className="type-body font-semibold text-on-surface">
        {rangeLabel}
        {block.group.title ? (
          <span className="font-normal text-on-surface-variant"> · {block.group.title}</span>
        ) : null}
      </h3>
      {block.group.instructions ? (
        <p className="type-body-sm text-on-surface-variant">{block.group.instructions}</p>
      ) : null}
      {hints.length > 0 ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {hints.map((hint) => (
            <li key={hint} className="type-caption font-semibold uppercase tracking-wide text-on-surface-variant">
              {hint}
            </li>
          ))}
        </ul>
      ) : null}
      {selectMode && !compact && mode === "answer" ? (
        <p className="type-caption text-on-surface-variant">{t("dragHint")}</p>
      ) : null}
    </header>
  );
}
