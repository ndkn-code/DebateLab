"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingPreviewCard } from "./onboarding-primitives";

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
        strength: t("demo_feedback.fallback_strength"),
        improvement: t("demo_feedback.fallback_improvement"),
        encouragement: t("demo_feedback.fallback_encouragement"),
      };
      setFeedback(fallback);
      onFeedbackLoaded(fallback);
    } finally {
      setLoading(false);
    }
  }, [transcript, topic, position, onFeedbackLoaded, t]);

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
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-container"
        >
          <Sparkles className="h-10 w-10 text-primary" />
        </motion.div>
        <p className="text-xl font-semibold text-on-surface">
          {t("demo_feedback.analyzing")}
        </p>
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
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-3xl font-bold text-on-surface md:text-4xl"
      >
        {t("demo_feedback.headline")}
      </motion.h2>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <OnboardingPreviewCard className="mx-auto w-fit p-5">
          <div className="relative h-28 w-28">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="var(--color-outline-variant)"
                strokeWidth="6"
              />
              <motion.circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{
                  strokeDashoffset: circumference * (1 - scoreProgress),
                }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="text-3xl font-bold text-on-surface"
              >
                {feedback.score}
              </motion.span>
              <span className="text-xs text-on-surface-variant">/100</span>
            </div>
          </div>
        </OnboardingPreviewCard>
      </motion.div>

      <div className="mb-6 space-y-3 text-left">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="flex items-start gap-3 rounded-[1.25rem] border border-secondary/20 bg-secondary-container p-4"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-secondary-dim" />
          <div>
            <p className="text-sm font-semibold text-secondary-dim">
              {t("demo_feedback.strength")}
            </p>
            <p className="text-base text-on-surface">{feedback.strength}</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 }}
          className="flex items-start gap-3 rounded-[1.25rem] border border-tertiary/20 bg-tertiary-container p-4"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-tertiary-dim" />
          <div>
            <p className="text-sm font-semibold text-tertiary-dim">
              {t("demo_feedback.improvement")}
            </p>
            <p className="text-base text-on-surface">{feedback.improvement}</p>
          </div>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mb-8 text-base font-semibold text-primary"
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
          className="h-12 rounded-2xl bg-primary px-8 text-lg font-semibold text-on-primary hover:bg-primary-dim"
          size="lg"
        >
          {t("demo_feedback.cta")}
        </Button>
      </motion.div>
    </div>
  );
}
