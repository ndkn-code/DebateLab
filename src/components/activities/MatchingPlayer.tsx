"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { MatchingContent, ActivityContent } from "@/lib/types/admin";

interface Props {
  content: ActivityContent;
  onComplete: (score: number, maxScore: number, responses: Record<string, unknown>) => void;
}

export function MatchingPlayer({ content, onComplete }: Props) {
  const t = useTranslations("courses.player");
  const c = content as MatchingContent;
  const pairs = c.pairs ?? [];
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  // Shuffle right side once
  const shuffledRight = useMemo(
    () => [...pairs].sort(() => Math.random() - 0.5),
    [pairs]
  );

  const handleSelect = (leftId: string, rightId: string) => {
    if (checked) return;
    setSelections((prev) => ({ ...prev, [leftId]: rightId }));
  };

  const handleCheck = () => {
    setChecked(true);
    const score = pairs.filter(
      (p) => selections[p.id] === p.id
    ).length;
    onComplete(score, pairs.length, selections);
  };

  // For matching, we store leftId -> which right pair they selected
  // The correct match is when they select the right item that has the same id
  const isCorrect = (leftId: string) => {
    const selectedRightId = selections[leftId];
    return selectedRightId === leftId;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-on-surface-variant">Match each term with its definition</p>

      <div className="space-y-3">
        {pairs.map((pair) => (
          <div key={pair.id} className="flex items-center gap-3">
            <div className={`flex-1 rounded-xl border-2 p-3 text-sm font-medium ${
              checked
                ? isCorrect(pair.id) ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
                : "border-outline-variant/20"
            }`}>
              {pair.left}
            </div>
            <span className="text-on-surface-variant">=</span>
            <select
              value={selections[pair.id] ?? ""}
              onChange={(e) => handleSelect(pair.id, e.target.value)}
              disabled={checked}
              className={`flex-1 rounded-xl border-2 p-3 text-sm ${
                checked
                  ? isCorrect(pair.id) ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
                  : "border-outline-variant/20"
              }`}
            >
              <option value="">Select...</option>
              {shuffledRight.map((r) => (
                <option key={r.id} value={r.id}>{r.right}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {checked && (
        <p className="text-center text-lg font-bold">
          {t("results", {
            score: pairs.filter((p) => isCorrect(p.id)).length,
            total: pairs.length,
          })}
        </p>
      )}

      {!checked && (
        <div className="flex justify-end">
          <button
            onClick={handleCheck}
            disabled={Object.keys(selections).length < pairs.length}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {t("checkAnswers")}
          </button>
        </div>
      )}
    </div>
  );
}
