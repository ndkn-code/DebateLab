"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Check, RotateCcw } from "lucide-react";
import type { FlashcardContent, ActivityContent } from "@/lib/types/admin";
import { getElapsedSecondsSince } from "@/lib/time";

interface Props {
  content: ActivityContent;
  onComplete: (score: number, maxScore: number, responses: Record<string, unknown>) => void;
}

export function FlashcardPlayer({ content, onComplete }: Props) {
  const t = useTranslations("courses.player");
  const c = content as FlashcardContent;
  const allCards = c.cards ?? [];
  const startTime = useRef<number | null>(null);

  const [deck, setDeck] = useState(() => [...allCards]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [gotItSet, setGotItSet] = useState<Set<string>>(new Set());
  const [reviewPile, setReviewPile] = useState<string[]>([]);
  const [triesMap, setTriesMap] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const [exitDir, setExitDir] = useState(0);
  const [completionScore, setCompletionScore] = useState(0);

  useEffect(() => {
    startTime.current = Date.now();
  }, []);

  const card = deck[currentIdx];
  const gotItCount = gotItSet.size;
  const remaining = allCards.length - gotItCount;

  if (done || !card) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-6xl">🎉</motion.div>
        <p className="text-2xl font-bold text-on-surface">{t("completed")}</p>
        <p className="text-on-surface-variant">
          {t("results", { score: completionScore, total: allCards.length })}
        </p>
      </div>
    );
  }

  const advance = (dir: number) => {
    setExitDir(dir);
    setFlipped(false);
    setTimeout(() => {
      if (currentIdx < deck.length - 1) {
        setCurrentIdx((i) => i + 1);
      } else {
        const reviewCards = allCards.filter(
          (currentCard) =>
            reviewPile.includes(currentCard.id) && !gotItSet.has(currentCard.id)
        );
        if (reviewCards.length > 0) {
          setDeck(reviewCards);
          setCurrentIdx(0);
          setReviewPile([]);
          setFlipped(false);
        } else {
          const firstTryCount = allCards.filter(
            (currentCard) =>
              (triesMap[currentCard.id] ?? 1) === 1 && gotItSet.has(currentCard.id)
          ).length;
          const elapsed = getElapsedSecondsSince(startTime.current);
          setCompletionScore(firstTryCount);
          onComplete(firstTryCount, allCards.length, {
            triesMap,
            gotOnFirst: firstTryCount,
            timeSpentSeconds: elapsed,
          });
          setDone(true);
        }
      }
      setExitDir(0);
    }, 200);
  };

  const handleGotIt = () => {
    const newGotIt = new Set(gotItSet);
    newGotIt.add(card.id);
    setGotItSet(newGotIt);
    setTriesMap((prev) => ({ ...prev, [card.id]: (prev[card.id] ?? 0) + 1 }));
    advance(1);
  };

  const handleReview = () => {
    setReviewPile((prev) => [...prev, card.id]);
    setTriesMap((prev) => ({ ...prev, [card.id]: (prev[card.id] ?? 0) + 1 }));
    advance(-1);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto px-4">
      {/* Card counter + piles */}
      <div className="flex items-center justify-between w-full mb-6">
        <span className="text-sm font-medium text-on-surface-variant">
          {t("cardOf", { current: gotItCount + 1, total: allCards.length })}
        </span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-600 font-medium">✓ {gotItCount}</span>
          <span className="text-amber-600 font-medium">↺ {remaining - (deck.length - currentIdx)}</span>
        </div>
      </div>

      {/* Card stack effect */}
      <div className="relative w-full" style={{ perspective: "1200px" }}>
        {/* Background cards (stack effect) */}
        {deck.length - currentIdx > 1 && (
          <div className="absolute inset-0 translate-y-2 scale-[0.96] rounded-3xl bg-gray-100 border border-gray-200" />
        )}
        {deck.length - currentIdx > 2 && (
          <div className="absolute inset-0 translate-y-4 scale-[0.92] rounded-3xl bg-gray-50 border border-gray-100" />
        )}

        {/* Main card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id + currentIdx}
            initial={{ opacity: 0, x: exitDir * 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: exitDir * -200, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <button
              onClick={() => setFlipped(!flipped)}
              className="w-full cursor-pointer focus:outline-none"
              style={{ perspective: "1200px" }}
            >
              <div
                className="relative w-full min-h-[280px] transition-transform duration-500"
                style={{
                  transformStyle: "preserve-3d",
                  transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* Front */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-gray-200 bg-gradient-to-b from-primary/5 to-white p-8 shadow-lg"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <p className="text-2xl font-bold text-on-surface text-center">{card.front}</p>
                  <p className="text-sm text-on-surface-variant mt-6">{t("tapToFlip")} 🔄</p>
                </div>

                {/* Back */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-primary/20 bg-white p-8 shadow-lg"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  <p className="text-lg text-on-surface text-center leading-relaxed">{card.back}</p>
                </div>
              </div>
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Action buttons - always visible */}
      <AnimatePresence>
        {flipped && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center justify-center gap-4 mt-8 w-full"
          >
            <motion.button
              onClick={handleReview}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-3.5 text-base font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
              whileTap={{ scale: 0.97 }}
            >
              <RotateCcw className="h-5 w-5" />
              {t("reviewAgain")}
            </motion.button>
            <motion.button
              onClick={handleGotIt}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-5 py-3.5 text-base font-semibold text-white hover:bg-green-700 transition-colors"
              whileTap={{ scale: 0.97 }}
            >
              <Check className="h-5 w-5" />
              {t("gotIt")}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {!flipped && (
        <p className="text-sm text-on-surface-variant mt-8 text-center">
          Tap the card to reveal the answer
        </p>
      )}
    </div>
  );
}
