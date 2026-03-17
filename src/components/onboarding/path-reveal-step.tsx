"use client";

import { useState, useEffect, useTransition } from "react";
import posthog from "posthog-js";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { BookOpen, Mic, Star } from "lucide-react";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { Button } from "@/components/ui/button";
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

  function getRecommendations(
    goalVal: string | null,
    experience: string | null
  ): { title: string; desc: string; icon: typeof BookOpen }[] {
    const recs = [];

    if (experience !== "experienced") {
      recs.push({
        title: t("path_reveal.course_foundations"),
        desc: t("path_reveal.course_foundations_desc"),
        icon: BookOpen,
      });
    }

    if (
      goalVal === "english" ||
      goalVal === "interview" ||
      experience === "experienced"
    ) {
      recs.push({
        title: t("path_reveal.course_speaking"),
        desc: t("path_reveal.course_speaking_desc"),
        icon: Mic,
      });
    }

    recs.push({
      title: t("path_reveal.course_daily"),
      desc: t("path_reveal.course_daily_desc"),
      icon: Star,
    });

    return recs.slice(0, 3);
  }

  const recommendations = getRecommendations(goal, experienceLevel);

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
        console.error("Onboarding error:", result.error);
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
            className="mb-2 text-3xl md:text-4xl font-bold text-on-surface"
          >
            {t("path_reveal.headline")}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-8 text-base md:text-lg text-gray-500"
          >
            {t("path_reveal.recommended")}
          </motion.p>

          {/* Recommendation cards */}
          <div className="mb-8 space-y-3">
            {recommendations.map((rec, i) => {
              const Icon = rec.icon;
              return (
                <motion.div
                  key={rec.title}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.2 }}
                  className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base md:text-lg font-semibold text-on-surface">
                      {rec.title}
                    </p>
                    <p className="text-sm text-gray-500">{rec.desc}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {t("path_reveal.recommended")}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {error && (
            <p className="mb-4 text-sm text-red-500">Error: {error}</p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <Button
              onClick={handleFinish}
              disabled={isPending}
              className="rounded-xl bg-primary px-8 py-3 text-lg font-semibold text-white"
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
            className="fixed inset-0 z-[200] bg-[#fbf8ff] flex flex-col items-center justify-center"
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
                  className="w-64 h-64 md:w-80 md:h-80"
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
              className="text-2xl md:text-3xl font-bold mt-4 bg-gradient-to-r from-[#2f4fdd] to-[#7c3aed] bg-clip-text text-transparent"
            >
              {t("path_reveal.lets_go")}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
