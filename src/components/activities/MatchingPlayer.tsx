"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import type { MatchingContent, ActivityContent } from "@/lib/types/admin";
import { getElapsedSecondsSince } from "@/lib/time";

const PAIR_COLORS = [
  { bg: "bg-blue-50", border: "border-blue-400", text: "text-blue-700" },
  { bg: "bg-purple-50", border: "border-purple-400", text: "text-purple-700" },
  { bg: "bg-teal-50", border: "border-teal-400", text: "text-teal-700" },
  { bg: "bg-amber-50", border: "border-amber-400", text: "text-amber-700" },
  { bg: "bg-pink-50", border: "border-pink-400", text: "text-pink-700" },
  { bg: "bg-emerald-50", border: "border-emerald-400", text: "text-emerald-700" },
];

interface Props {
  content: ActivityContent;
  onComplete: (score: number, maxScore: number, responses: Record<string, unknown>) => void;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function MatchingPlayer({ content, onComplete }: Props) {
  const t = useTranslations("courses.player");
  const c = content as MatchingContent;
  const pairs = useMemo(() => c.pairs ?? [], [c.pairs]);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = Date.now();
  }, []);

  const shuffledRight = useMemo(
    () =>
      [...pairs].sort(
        (left, right) =>
          hashString(`${left.id}:${left.right}`) - hashString(`${right.id}:${right.right}`)
      ),
    [pairs]
  );

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  const handleLeftClick = (id: string) => {
    if (checked) return;
    if (matches[id]) {
      setMatches((prev) => { const n = { ...prev }; delete n[id]; return n; });
      return;
    }
    setSelectedLeft(id);
    if (selectedRight) {
      setMatches((prev) => ({ ...prev, [id]: selectedRight }));
      setSelectedLeft(null);
      setSelectedRight(null);
    }
  };

  const handleRightClick = (id: string) => {
    if (checked) return;
    const matchedLeft = Object.entries(matches).find(([, v]) => v === id)?.[0];
    if (matchedLeft) {
      setMatches((prev) => { const n = { ...prev }; delete n[matchedLeft]; return n; });
      return;
    }
    setSelectedRight(id);
    if (selectedLeft) {
      setMatches((prev) => ({ ...prev, [selectedLeft]: id }));
      setSelectedLeft(null);
      setSelectedRight(null);
    }
  };

  const handleCheck = () => {
    setChecked(true);
    const score = pairs.filter((p) => matches[p.id] === p.id).length;
    const elapsed = getElapsedSecondsSince(startTime.current);
    onComplete(score, pairs.length, { matches, timeSpentSeconds: elapsed });
  };

  // Build color mapping by insertion order
  const colorMap = useMemo(() => {
    const map: Record<string, number> = {};
    let idx = 0;
    for (const key of Object.keys(matches)) {
      map[key] = idx++;
    }
    return map;
  }, [matches]);

  const getColor = (leftId: string) => PAIR_COLORS[colorMap[leftId] % PAIR_COLORS.length];
  const getRightLeftId = (rightId: string) => Object.entries(matches).find(([, v]) => v === rightId)?.[0];

  return (
    <div className="flex flex-col items-center w-full max-w-3xl mx-auto px-4">
      <p className="text-base font-medium text-on-surface-variant mb-2 text-center">{t("matchTerms")}</p>
      <p className="text-sm text-on-surface-variant mb-6">
        {t("matched", { count: Object.keys(matches).length, total: pairs.length })}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Terms</p>
          {pairs.map((pair) => {
            const matched = !!matches[pair.id];
            const color = matched ? getColor(pair.id) : null;
            const isSelected = selectedLeft === pair.id;
            const correctAfterCheck = checked && matches[pair.id] === pair.id;
            const wrongAfterCheck = checked && matches[pair.id] && matches[pair.id] !== pair.id;

            return (
              <motion.button
                key={pair.id}
                onClick={() => handleLeftClick(pair.id)}
                className={`w-full text-left rounded-2xl border-2 p-4 text-sm font-semibold transition-all ${
                  checked
                    ? correctAfterCheck ? "border-green-500 bg-green-50" : wrongAfterCheck ? "border-red-500 bg-red-50" : "border-gray-200"
                    : matched && color ? `${color.border} ${color.bg} ${color.text}` : isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-gray-200 hover:border-primary/40"
                }`}
                whileTap={{ scale: 0.97 }}
                layout
              >
                <span className="flex items-center gap-2">
                  <span className="flex-1">{pair.left}</span>
                  {checked && correctAfterCheck && <Check className="h-4 w-4 text-green-600" />}
                  {checked && wrongAfterCheck && <X className="h-4 w-4 text-red-600" />}
                </span>
              </motion.button>
            );
          })}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Definitions</p>
          {shuffledRight.map((pair) => {
            const leftId = getRightLeftId(pair.id);
            const matched = !!leftId;
            const color = matched ? getColor(leftId!) : null;
            const isSelected = selectedRight === pair.id;

            return (
              <motion.button
                key={pair.id}
                onClick={() => handleRightClick(pair.id)}
                className={`w-full text-left rounded-2xl border-2 p-4 text-sm transition-all ${
                  checked ? "border-gray-200 bg-gray-50/50"
                    : matched && color ? `${color.border} ${color.bg} ${color.text}` : isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-gray-200 hover:border-primary/40"
                }`}
                whileTap={{ scale: 0.97 }}
                layout
              >
                {pair.right}
              </motion.button>
            );
          })}
        </div>
      </div>

      {!checked && (
        <motion.button
          onClick={handleCheck}
          disabled={Object.keys(matches).length < pairs.length}
          className="mt-8 rounded-2xl bg-primary px-8 py-3.5 text-base font-semibold text-on-primary transition-all disabled:opacity-40 hover:bg-primary/90 min-w-[200px]"
          whileTap={{ scale: 0.97 }}
        >
          {t("checkMatches")}
        </motion.button>
      )}

      <AnimatePresence>
        {checked && (
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-xl font-bold text-on-surface">
            {t("results", { score: pairs.filter((p) => matches[p.id] === p.id).length, total: pairs.length })}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
