"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ArrowRight, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DemoFeedback {
  score: number;
  strength: string;
  improvement: string;
  encouragement: string;
}

interface DemoFeedbackStepProps {
  transcript: string | null;
  topic: string;
  position: "FOR" | "AGAINST";
  existingFeedback: DemoFeedback | null;
  onFeedbackLoaded: (feedback: DemoFeedback) => void;
  onNext: () => void;
}

export function DemoFeedbackStep({
  transcript,
  topic,
  position,
  existingFeedback,
  onFeedbackLoaded,
  onNext,
}: DemoFeedbackStepProps) {
  const t = useTranslations("onboarding");
  const [loading, setLoading] = useState(!existingFeedback);
  const [feedback, setFeedback] = useState<DemoFeedback | null>(
    existingFeedback
  );

  const fetchFeedback = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcript ?? "", topic, position }),
      });
      const data = await res.json();
      setFeedback(data);
      onFeedbackLoaded(data);
    } catch {
      const fallback = {
        score: 70,
        strength: "You took the initiative to practice!",
        improvement: "Try adding specific examples next time.",
        encouragement: "Every champion started as a beginner!",
      };
      setFeedback(fallback);
      onFeedbackLoaded(fallback);
    } finally {
      setLoading(false);
    }
  }, [transcript, topic, position, onFeedbackLoaded]);

  useEffect(() => {
    if (!existingFeedback) {
      fetchFeedback();
    }
  }, [existingFeedback, fetchFeedback]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10"
        >
          <Sparkles className="h-10 w-10 text-primary" />
        </motion.div>
        <p className="text-lg font-semibold text-on-surface">
          {t("demo_feedback.analyzing")}
        </p>
        <p className="mt-1 text-sm text-gray-500">{t("demo_feedback.analyzing")}</p>
      </div>
    );
  }

  if (!feedback) return null;

  // Score ring
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const scoreProgress = feedback.score / 100;

  return (
    <div className="text-center">
      {/* Score */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mx-auto mb-6 h-28 w-28"
      >
        <div className="relative h-full w-full">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="6"
            />
            <motion.circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#2f4fdd"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{
                strokeDashoffset: circumference * (1 - scoreProgress),
              }}
              transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-2xl font-bold text-on-surface"
            >
              {feedback.score}
            </motion.span>
            <span className="text-[10px] text-gray-400">/100</span>
          </div>
        </div>
      </motion.div>

      {/* Feedback cards */}
      <div className="mb-6 space-y-3 text-left">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <div>
            <p className="text-xs font-semibold text-emerald-600">{t("demo_feedback.strength")}</p>
            <p className="text-sm text-gray-600">{feedback.strength}</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
          className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-xs font-semibold text-amber-600">{t("demo_feedback.improvement")}</p>
            <p className="text-sm text-gray-600">{feedback.improvement}</p>
          </div>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mb-8 text-sm font-medium text-primary"
      >
        {feedback.encouragement}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      >
        <Button
          onClick={onNext}
          className="gap-2 rounded-xl bg-primary px-8 py-3 text-lg font-semibold text-white"
          size="lg"
        >
          {t("demo_feedback.cta")}
          <ArrowRight className="h-5 w-5" />
        </Button>
      </motion.div>
    </div>
  );
}
