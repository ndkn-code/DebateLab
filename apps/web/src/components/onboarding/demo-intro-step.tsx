"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { OnboardingPreviewCard } from "./onboarding-primitives";

interface DemoIntroStepProps {
  topic: string;
  position: "FOR" | "AGAINST";
  onNext: () => void;
}

export function DemoIntroStep({
  topic,
  position,
  onNext,
}: DemoIntroStepProps) {
  const t = useTranslations("onboarding");

  return (
    <div className="text-center">
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 text-3xl font-bold text-on-surface md:text-4xl"
      >
        {t("demo_intro.headline")}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8 text-base text-on-surface-variant md:text-lg"
      >
        {t("demo_intro.subheadline")}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <OnboardingPreviewCard>
          <p className="mb-4 text-xl font-semibold leading-8 text-on-surface md:text-2xl">
            {topic}
          </p>
          <span
            className={`inline-flex rounded-full px-4 py-1.5 text-sm font-bold ${
              position === "FOR"
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-error-container text-on-error-container"
            }`}
          >
            {position === "FOR" ? t("demo_intro.for") : t("demo_intro.against")}
          </span>
        </OnboardingPreviewCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Button
          onClick={onNext}
          className="h-12 rounded-2xl bg-primary px-8 text-lg font-semibold text-on-primary hover:bg-primary-dim"
          size="lg"
        >
          {t("demo_intro.cta")}
        </Button>
      </motion.div>
    </div>
  );
}
