"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Lightbulb } from "lucide-react";
import type { QuizContent, ActivityContent } from "@/lib/types/admin";

interface Props {
  content: ActivityContent;
  onComplete: (score: number, maxScore: number, responses: Record<string, unknown>) => void;
}

export function QuizPlayer({ content, onComplete }: Props) {
  const t = useTranslations("courses.player");
  const c = content as QuizContent;
  const questions = c.questions ?? [];
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"answering" | "feedback">("answering");
  const [results, setResults] = useState<{ questionId: string; selectedOptionId: string; isCorrect: boolean }[]>([]);
  const startTime = useRef(Date.now());

  const q = questions[currentIdx];
  if (!q || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
        <p className="text-lg">No questions available</p>
      </div>
    );
  }

  const isCorrect = selectedId === q.correctAnswer;

  const handleCheck = () => {
    if (!selectedId) return;
    setPhase("feedback");
    setResults((prev) => [...prev, { questionId: q.id, selectedOptionId: selectedId, isCorrect }]);
  };

  const handleContinue = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
      setSelectedId(null);
      setPhase("answering");
    } else {
      const score = results.filter((r) => r.isCorrect).length;
      const elapsed = Math.round((Date.now() - startTime.current) / 1000);
      onComplete(score, questions.length, { answers: results, timeSpentSeconds: elapsed });
    }
  };

  const options = q.type === "true_false"
    ? [{ id: "true", text: "True" }, { id: "false", text: "False" }]
    : q.options;

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto px-4">
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-8">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              i < currentIdx
                ? "w-2.5 bg-green-500"
                : i === currentIdx
                ? "w-8 bg-primary"
                : "w-2.5 bg-gray-200"
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="w-full space-y-6"
        >
          {/* Question counter */}
          <p className="text-sm font-medium text-on-surface-variant text-center">
            {t("questionOf", { current: currentIdx + 1, total: questions.length })}
          </p>

          {/* Question text */}
          <h2 className="text-xl font-bold text-on-surface text-center leading-relaxed">
            {q.question}
          </h2>

          {/* Options */}
          <div className={q.type === "true_false" ? "flex gap-4" : "space-y-3"}>
            {options.map((opt) => {
              const isSelected = selectedId === opt.id;
              const isCorrectOpt = opt.id === q.correctAnswer;

              let cls = "w-full text-left rounded-2xl border-2 p-4 text-base transition-all duration-200";
              if (phase === "feedback") {
                if (isCorrectOpt) cls += " border-green-500 bg-green-50";
                else if (isSelected) cls += " border-red-500 bg-red-50";
                else cls += " border-gray-100 bg-gray-50/50 opacity-50";
              } else if (isSelected) {
                cls += " border-primary bg-primary/5 shadow-sm shadow-primary/10";
              } else {
                cls += " border-gray-200 hover:border-primary/40 hover:bg-primary/[0.02]";
              }

              return (
                <motion.button
                  key={opt.id}
                  onClick={() => phase === "answering" && setSelectedId(opt.id)}
                  className={cls}
                  whileTap={phase === "answering" ? { scale: 0.98 } : undefined}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex-1 font-medium">{opt.text}</span>
                    {phase === "feedback" && isCorrectOpt && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white">
                        <Check className="h-4 w-4" />
                      </motion.span>
                    )}
                    {phase === "feedback" && isSelected && !isCorrectOpt && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white">
                        <X className="h-4 w-4" />
                      </motion.span>
                    )}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Feedback */}
          <AnimatePresence>
            {phase === "feedback" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
              >
                <div className={`flex items-center gap-3 rounded-2xl p-4 mb-4 ${
                  isCorrect ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                }`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    isCorrect ? "bg-green-500" : "bg-red-500"
                  } text-white`}>
                    {isCorrect ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${isCorrect ? "text-green-700" : "text-red-700"}`}>
                      {isCorrect ? t("correct") : t("incorrect")}
                    </p>
                    {isCorrect && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-semibold text-amber-600">
                        +15 XP ⭐
                      </motion.p>
                    )}
                  </div>
                </div>

                {q.explanation && (
                  <div className="flex gap-3 rounded-2xl bg-blue-50 border border-blue-200 p-4">
                    <Lightbulb className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-700 mb-1">{t("whyCorrect")}</p>
                      <p className="text-sm text-blue-800 leading-relaxed">{q.explanation}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action button */}
          <div className="flex justify-center pt-2">
            {phase === "answering" ? (
              <motion.button
                onClick={handleCheck}
                disabled={!selectedId}
                className="rounded-2xl bg-primary px-8 py-3.5 text-base font-semibold text-on-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 min-w-[200px]"
                whileTap={{ scale: 0.97 }}
              >
                {t("checkAnswer")}
              </motion.button>
            ) : (
              <motion.button
                onClick={handleContinue}
                className="rounded-2xl bg-primary px-8 py-3.5 text-base font-semibold text-on-primary hover:bg-primary/90 min-w-[200px]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.97 }}
              >
                {t("continue")} →
              </motion.button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
