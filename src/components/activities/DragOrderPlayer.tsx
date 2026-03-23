"use client";

import { useState, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { GripVertical, ChevronUp, ChevronDown, Check, X } from "lucide-react";
import type { DragOrderContent, ActivityContent } from "@/lib/types/admin";

interface Props {
  content: ActivityContent;
  onComplete: (score: number, maxScore: number, responses: Record<string, unknown>) => void;
}

export function DragOrderPlayer({ content, onComplete }: Props) {
  const t = useTranslations("courses.player");
  const c = content as DragOrderContent;
  const startTime = useRef(Date.now());

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
    const elapsed = Math.round((Date.now() - startTime.current) / 1000);
    onComplete(score, items.length, { order: items.map((i) => i.id), timeSpentSeconds: elapsed });
  };

  const score = items.filter((item, i) => item.correctOrder === i + 1).length;

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto px-4">
      <p className="text-base font-medium text-on-surface-variant mb-6 text-center">
        {c.instruction ?? t("arrangeOrder")}
      </p>

      <div className="space-y-3 w-full">
        {items.map((item, i) => {
          const isCorrect = checked ? item.correctOrder === i + 1 : undefined;

          return (
            <motion.div
              key={item.id}
              layout
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`flex items-center gap-3 rounded-2xl border-2 p-4 transition-all ${
                checked
                  ? isCorrect
                    ? "border-green-500 bg-green-50"
                    : "border-red-500 bg-red-50"
                  : "border-gray-200 bg-white hover:shadow-sm"
              }`}
            >
              {/* Position number */}
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                checked
                  ? isCorrect ? "bg-green-500 text-white" : "bg-red-500 text-white"
                  : "bg-gray-100 text-on-surface-variant"
              }`}>
                {checked ? (isCorrect ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />) : i + 1}
              </div>

              {/* Drag handle */}
              {!checked && <GripVertical className="h-5 w-5 text-gray-300 shrink-0" />}

              {/* Text */}
              <span className="flex-1 text-base font-medium text-on-surface">{item.text}</span>

              {/* Correction hint */}
              {checked && !isCorrect && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-red-600 shrink-0"
                >
                  #{item.correctOrder}
                </motion.span>
              )}

              {/* Move buttons */}
              {!checked && (
                <div className="flex flex-col shrink-0 gap-0.5">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="p-1 rounded-lg disabled:opacity-20 hover:bg-gray-100 hover:text-primary transition-colors"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                    className="p-1 rounded-lg disabled:opacity-20 hover:bg-gray-100 hover:text-primary transition-colors"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {checked && (
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-xl font-bold text-on-surface">
            {t("results", { score, total: items.length })}
          </motion.p>
        )}
      </AnimatePresence>

      {!checked && (
        <motion.button
          onClick={handleCheck}
          className="mt-8 rounded-2xl bg-primary px-8 py-3.5 text-base font-semibold text-on-primary hover:bg-primary/90 min-w-[200px]"
          whileTap={{ scale: 0.97 }}
        >
          {t("checkOrder")}
        </motion.button>
      )}
    </div>
  );
}
