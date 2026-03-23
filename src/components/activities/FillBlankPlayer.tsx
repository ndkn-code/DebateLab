"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import type { FillBlankContent, ActivityContent } from "@/lib/types/admin";

interface Props {
  content: ActivityContent;
  onComplete: (score: number, maxScore: number, responses: Record<string, unknown>) => void;
}

export function FillBlankPlayer({ content, onComplete }: Props) {
  const t = useTranslations("courses.player");
  const c = content as FillBlankContent;
  const passages = c.passages ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const startTime = useRef(Date.now());

  const allBlanks = passages.flatMap((p) => p.blanks);
  const allFilled = allBlanks.every((b) => (answers[b.id] ?? "").trim().length > 0);

  const isBlankCorrect = (blank: FillBlankContent["passages"][0]["blanks"][0]) => {
    const ua = (answers[blank.id] ?? "").trim();
    if (!ua) return false;
    const eq = (a: string, b: string, cs: boolean) => cs ? a === b : a.toLowerCase() === b.toLowerCase();
    return eq(ua, blank.answer, blank.caseSensitive) || (blank.acceptedAnswers ?? []).some((alt) => eq(ua, alt, blank.caseSensitive));
  };

  const handleCheck = () => {
    setChecked(true);
    const score = allBlanks.filter((b) => isBlankCorrect(b)).length;
    const elapsed = Math.round((Date.now() - startTime.current) / 1000);
    onComplete(score, allBlanks.length, { answers, timeSpentSeconds: elapsed });
  };

  const renderPassage = (passage: FillBlankContent["passages"][0]) => {
    const parts = passage.text.split(/(__BLANK_\d+__)/g);
    return parts.map((part, i) => {
      const match = part.match(/__BLANK_(\d+)__/);
      if (!match) return <span key={i}>{part}</span>;
      const num = parseInt(match[1]);
      const blank = passage.blanks[num - 1] ?? passage.blanks.find((b) => b.id === `blank-${num}` || b.id === `blank_${num}`);
      if (!blank) return <span key={i} className="text-red-400">[?]</span>;
      const correct = checked ? isBlankCorrect(blank) : undefined;

      return (
        <span key={i} className="inline-flex items-center mx-1 align-baseline">
          <span className="relative inline-block">
            <input
              value={answers[blank.id] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [blank.id]: e.target.value }))}
              disabled={checked}
              placeholder="..."
              className={`inline-block min-w-[100px] max-w-[200px] border-b-2 bg-transparent px-2 py-1 text-center text-base font-medium focus:outline-none transition-colors ${
                checked ? correct ? "border-green-500 text-green-700" : "border-red-500 text-red-700 line-through" : "border-primary/40 focus:border-primary text-on-surface"
              }`}
              style={{ width: `${Math.max(100, (answers[blank.id]?.length ?? 3) * 12)}px` }}
            />
            {checked && correct && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-6 top-1/2 -translate-y-1/2">
                <Check className="h-4 w-4 text-green-500" />
              </motion.span>
            )}
            {checked && !correct && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="block text-xs text-green-600 font-semibold mt-0.5 text-center">
                → {blank.answer}
              </motion.span>
            )}
          </span>
        </span>
      );
    });
  };

  const score = checked ? allBlanks.filter((b) => isBlankCorrect(b)).length : 0;

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto px-4">
      <p className="text-base font-medium text-on-surface-variant mb-6 text-center">{t("completePassage")}</p>

      <div className="space-y-6 w-full">
        {passages.map((passage) => (
          <div key={passage.id} className="text-lg leading-[2.5] text-on-surface rounded-2xl bg-white border border-gray-100 p-6 shadow-sm">
            {renderPassage(passage)}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {checked && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className={`mt-6 w-full rounded-2xl p-4 text-center font-bold text-lg ${
              score === allBlanks.length ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            {t("results", { score, total: allBlanks.length })}
          </motion.div>
        )}
      </AnimatePresence>

      {!checked && (
        <motion.button onClick={handleCheck} disabled={!allFilled}
          className="mt-8 rounded-2xl bg-primary px-8 py-3.5 text-base font-semibold text-on-primary transition-all disabled:opacity-40 hover:bg-primary/90 min-w-[200px]"
          whileTap={{ scale: 0.97 }}
        >
          {t("checkAnswers")}
        </motion.button>
      )}
    </div>
  );
}
