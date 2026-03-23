"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, RotateCcw } from "lucide-react";
import type { FlashcardContent, ActivityContent } from "@/lib/types/admin";

interface Props {
  content: ActivityContent;
  onComplete: (score: number, maxScore: number, responses: Record<string, unknown>) => void;
}

export function FlashcardPlayer({ content, onComplete }: Props) {
  const t = useTranslations("courses.player");
  const c = content as FlashcardContent;
  const cards = c.cards ?? [];
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [gotIt, setGotIt] = useState<Set<string>>(new Set());
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  // Build active cards: not yet "got it"
  const activeCards = cards.filter((card) => !gotIt.has(card.id));
  const reviewCards = cards.filter((card) => reviewQueue.includes(card.id) && !gotIt.has(card.id));
  const allActiveCards = [...activeCards, ...reviewCards];

  const card = activeCards[currentIdx] ?? reviewCards[0];

  if (!card || done) {
    return (
      <div className="text-center space-y-4 py-8">
        <p className="text-2xl font-bold text-on-surface">{t("completed")}</p>
        <p className="text-sm text-on-surface-variant">
          {t("results", { score: gotIt.size, total: cards.length })}
        </p>
      </div>
    );
  }

  const handleGotIt = () => {
    const next = new Set(gotIt);
    next.add(card.id);
    setGotIt(next);
    setFlipped(false);

    if (next.size === cards.length) {
      setDone(true);
      onComplete(cards.length, cards.length, { gotOnFirst: gotIt.size });
    } else {
      setCurrentIdx((prev) => {
        const remaining = activeCards.filter((c) => !next.has(c.id));
        return remaining.length > 0 ? Math.min(prev, remaining.length - 1) : 0;
      });
    }
  };

  const handleReview = () => {
    setReviewQueue((prev) => [...prev, card.id]);
    setFlipped(false);
    setCurrentIdx((prev) => {
      if (prev < activeCards.length - 1) return prev + 1;
      return 0;
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center text-xs text-on-surface-variant">
        Card {gotIt.size + 1} of {cards.length}
      </div>

      {/* Card */}
      <button
        onClick={() => setFlipped(!flipped)}
        className="w-full min-h-[200px] rounded-2xl border-2 border-outline-variant/20 p-8 text-center transition-all hover:shadow-md cursor-pointer"
        style={{ perspective: "1000px" }}
      >
        <div className={`transition-transform duration-300 ${flipped ? "[transform:rotateY(180deg)]" : ""}`}>
          <p className={`text-xl font-semibold text-on-surface ${flipped ? "[transform:rotateY(180deg)]" : ""}`}>
            {flipped ? card.back : card.front}
          </p>
          <p className="text-xs text-on-surface-variant mt-4">
            {flipped ? "" : "Tap to flip"}
          </p>
        </div>
      </button>

      {/* Actions (show after flip) */}
      {flipped && (
        <div className="flex justify-center gap-4">
          <button
            onClick={handleReview}
            className="flex items-center gap-2 rounded-xl border-2 border-outline-variant/20 px-5 py-3 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            {t("reviewAgain")}
          </button>
          <button
            onClick={handleGotIt}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            <Check className="h-4 w-4" />
            {t("gotIt")}
          </button>
        </div>
      )}
    </div>
  );
}
