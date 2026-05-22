"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import { Button } from "@/components/ui/button";
import { OnboardingPreviewCard } from "./onboarding-primitives";
import welcomeAnimation from "../../../public/lottie/welcome.json";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const t = useTranslations("onboarding");
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // When the animation completes, wait 1.5s then replay
    const lottie = lottieRef.current;
    if (!lottie) return;

    const onComplete = () => {
      intervalRef.current = setTimeout(() => {
        lottie.goToAndPlay(0);
      }, 1500);
    };

    // lottie-react exposes the animation instance on the ref
    lottie.animationItem?.addEventListener("complete", onComplete);

    return () => {
      lottie.animationItem?.removeEventListener("complete", onComplete);
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <OnboardingPreviewCard className="mx-auto flex w-full max-w-[27rem] flex-col items-center p-5 sm:p-7">
          <div className="rounded-[2rem] bg-primary-container p-3">
            <Lottie
              lottieRef={lottieRef}
              animationData={welcomeAnimation}
              loop={false}
              autoplay={true}
              className="h-72 w-72 md:h-[24rem] md:w-[24rem]"
            />
          </div>
          <div className="mt-5 grid w-full grid-cols-3 gap-2">
            <div className="h-2 rounded-full bg-primary" />
            <div className="h-2 rounded-full bg-secondary" />
            <div className="h-2 rounded-full bg-tertiary" />
          </div>
        </OnboardingPreviewCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.24, ease: "easeOut" }}
      >
        <Button
          onClick={onNext}
          size="lg"
          className="mt-6 h-12 rounded-2xl bg-primary px-12 text-lg font-semibold text-on-primary shadow-[0_18px_34px_-24px_rgba(77,134,247,0.9)] hover:bg-primary-dim"
        >
          {t("welcome.cta")}
        </Button>
      </motion.div>
    </div>
  );
}
