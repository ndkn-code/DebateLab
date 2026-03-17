"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import { Button } from "@/components/ui/button";
import welcomeAnimation from "../../../public/lottie/welcome.json";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const t = useTranslations("onboarding");
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Replay the animation every 3 seconds
    intervalRef.current = setInterval(() => {
      lottieRef.current?.goToAndPlay(0);
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-dvh">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
      >
        <Lottie
          lottieRef={lottieRef}
          animationData={welcomeAnimation}
          loop={false}
          autoplay={true}
          className="w-80 h-80 md:w-[28rem] md:h-[28rem]"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
      >
        <Button
          onClick={onNext}
          size="lg"
          className="mt-6 px-12 py-3 text-lg rounded-xl bg-primary text-white font-semibold"
        >
          {t("welcome.cta")}
        </Button>
      </motion.div>
    </div>
  );
}
