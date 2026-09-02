"use client";

/**
 * Armed-slot state for click-to-place: the learner taps a blank (arms it),
 * then taps a bank chip to fill it. Also owns the polite live-region message
 * so every placement/clear is announced in the active locale.
 */
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { setGroupSlotValue } from "@/lib/ielts/question-groups";
import type { IeltsQuestionGroupView } from "@/lib/ielts/question-types";
import { bankOptionLabel } from "./group-answers";
import type { SlotRef } from "./types";

interface Args {
  group: IeltsQuestionGroupView;
  slotList: readonly SlotRef[];
  locked: boolean;
  onAnswer: (questionId: string, value: unknown) => void;
}

export interface SlotSelection {
  armedQuestionId: string | null;
  arm: (questionId: string | null) => void;
  fill: (questionId: string, optionId: string | null) => void;
  setText: (questionId: string, text: string) => void;
  /** Latest screen-reader announcement (rendered in an `aria-live` region). */
  liveMessage: string;
  announce: (message: string) => void;
}

export function useSlotSelection({ group, slotList, locked, onAnswer }: Args): SlotSelection {
  const t = useTranslations("ielts.player.groups");
  const [armedQuestionId, setArmed] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  const numberFor = useCallback(
    (questionId: string) =>
      slotList.find((ref) => ref.questionId === questionId)?.number.label ?? "",
    [slotList],
  );

  const arm = useCallback(
    (questionId: string | null) => {
      if (locked) return;
      setArmed(questionId);
      if (questionId) setLiveMessage(t("pickForSlot", { number: numberFor(questionId) }));
    },
    [locked, numberFor, t],
  );

  const fill = useCallback(
    (questionId: string, optionId: string | null) => {
      if (locked) return;
      onAnswer(questionId, setGroupSlotValue(optionId));
      const number = numberFor(questionId);
      setLiveMessage(
        optionId === null
          ? t("removed", { number })
          : t("placed", { option: bankOptionLabel(group.bank, optionId), number }),
      );
      setArmed(null);
    },
    [group.bank, locked, numberFor, onAnswer, t],
  );

  const setText = useCallback(
    (questionId: string, text: string) => {
      if (locked) return;
      onAnswer(questionId, setGroupSlotValue(text));
    },
    [locked, onAnswer],
  );

  return { armedQuestionId, arm, fill, setText, liveMessage, announce: setLiveMessage };
}
