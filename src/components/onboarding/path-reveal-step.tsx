"use client";

import { useState, useEffect, useTransition } from "react";
import posthog from "posthog-js";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Mic, Sparkles } from "lucide-react";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { Button } from "@/components/ui/button";
import { OnboardingPreviewCard } from "./onboarding-primitives";
import { completeOnboarding } from "@/app/[locale]/onboarding/actions";

interface PathRevealStepProps {
  goal: string | null;
  experienceLevel: string | null;
  englishConfidence: string | null;
  dailyGoalMinutes: number | null;
}

export function PathRevealStep({
  goal,
  experienceLevel,
  englishConfidence,
  dailyGoalMinutes,
}: PathRevealStepProps) {
  const t = useTranslations("onboarding");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [rocketAnimation, setRocketAnimation] = useState<object | null>(null);

  // Lazy-load rocket animation only when needed
  useEffect(() => {
    import("../../../public/lottie/rocket.json").then((mod) => {
      setRocketAnimation(mod.default);
    });
  }, []);

  const handleFinish = () => {
    setIsLaunching(true);

    // Save onboarding data in parallel while animation plays
    startTransition(async () => {
      const result = await completeOnboarding({
        goal,
        experience_level: experienceLevel,
        english_confidence: englishConfidence,
        daily_goal_minutes: dailyGoalMinutes,
      });

      if (result.error) {
        setError(result.error);
        setIsLaunching(false);
        return;
      }

      posthog.capture("onboarding_completed", {
        goal,
        experience_level: experienceLevel,
        english_confidence: englishConfidence,
        daily_goal_minutes: dailyGoalMinutes,
      });
    });

    // Start fade-out after rocket plays, then navigate
    setTimeout(() => {
      setIsFadingOut(true);
    }, 3200);

    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 4000);
  };

  return (
    <>
      {/* Normal path reveal content */}
      {!isLaunching && (
        <div className="text-center">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6 text-3xl font-bold text-on-surface md:text-4xl"
          >
            {t("path_reveal.headline")}
          </motion.h2>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-5"
          >
            <OnboardingPreviewCard icon={Mic}>
              <p className="text-base font-medium leading-7 text-on-surface md:text-lg">
                {t("path_reveal.ready_to_practice")}
              </p>
            </OnboardingPreviewCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mb-6"
          >
            <OnboardingPreviewCard
              icon={Sparkles}
              iconClassName="bg-tertiary-container text-tertiary"
              className="text-left"
            >
              <div>
                <p className="text-sm font-medium text-on-surface">
                  You start with 1,250 free Credits
                </p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  Speaking practice costs 100 Credits. Debate practice costs 200 Credits.
                </p>
              </div>
            </OnboardingPreviewCard>
          </motion.div>

          {error && (
            <p className="mb-4 text-sm font-medium text-error">Error: {error}</p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <Button
              onClick={handleFinish}
              disabled={isPending}
              className="h-12 rounded-2xl bg-primary px-8 text-lg font-semibold text-on-primary hover:bg-primary-dim"
              size="lg"
            >
              {t("path_reveal.cta")}
            </Button>
          </motion.div>
        </div>
      )}

      {/* Fullscreen rocket overlay */}
      <AnimatePresence>
        {isLaunching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isFadingOut ? 0 : 1 }}
            transition={{ duration: isFadingOut ? 0.8 : 0.4, ease: "easeInOut" }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{
                scale: isFadingOut ? 1.2 : 1,
                opacity: isFadingOut ? 0 : 1,
                y: isFadingOut ? -40 : 0,
              }}
              transition={
                isFadingOut
                  ? { duration: 0.8, ease: "easeInOut" }
                  : { type: "spring", damping: 15, stiffness: 200 }
              }
            >
              {rocketAnimation && (
                <LottieAnimation
                  animationData={rocketAnimation}
                  className="h-64 w-64 md:h-80 md:w-80"
                  loop={false}
                />
              )}
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: isFadingOut ? 0 : 1,
                y: isFadingOut ? -20 : 0,
              }}
              transition={
                isFadingOut
                  ? { duration: 0.6, ease: "easeInOut" }
                  : { delay: 0.5, duration: 0.5 }
              }
              className="mt-4 text-2xl font-bold text-primary md:text-3xl"
            >
              {t("path_reveal.lets_go")}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
