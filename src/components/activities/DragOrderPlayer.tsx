"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import type { DragOrderContent, ActivityContent } from "@/lib/types/admin";

interface Props {
  content: ActivityContent;
  onComplete: (score: number, maxScore: number, responses: Record<string, unknown>) => void;
}

export function DragOrderPlayer({ content, onComplete }: Props) {
  const t = useTranslations("courses.player");
  const c = content as DragOrderContent;

  // Shuffle items once
  const shuffled = useMemo(
    () => [...(c.items ?? [])].sort(() => Math.random() - 0.5),
    [c.items]
  );

  const [items, setItems] = useState(shuffled);
  const [checked, setChecked] = useState(false);

  const move = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const updated = [...items];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setItems(updated);
  };

  const handleCheck = () => {
    setChecked(true);
    const score = items.filter((item, i) => item.correctOrder === i + 1).length;
    onComplete(score, items.length, { order: items.map((i) => i.id) });
  };

  return (
    <div className="space-y-4">
      {c.instruction && (
        <p className="text-sm text-on-surface-variant">{c.instruction}</p>
      )}

      <div className="space-y-2">
        {items.map((item, i) => {
          const isCorrect = checked ? item.correctOrder === i + 1 : undefined;
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${
                checked
                  ? isCorrect ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"
                  : "border-outline-variant/20"
              }`}
            >
              <GripVertical className="h-4 w-4 text-on-surface-variant/40 shrink-0" />
              <span className="flex-1 text-sm text-on-surface">{item.text}</span>
              {!checked && (
                <div className="flex flex-col shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 disabled:opacity-20 hover:text-primary">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="p-0.5 disabled:opacity-20 hover:text-primary">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {checked && (
        <p className="text-center text-lg font-bold">
          {t("results", {
            score: items.filter((item, i) => item.correctOrder === i + 1).length,
            total: items.length,
          })}
        </p>
      )}

      {!checked && (
        <div className="flex justify-end">
          <button
            onClick={handleCheck}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            {t("checkAnswers")}
          </button>
        </div>
      )}
    </div>
  );
}
