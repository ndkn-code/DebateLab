"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import welcomeAnimation from "../../../public/lottie/welcome.json";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const t = useTranslations("onboarding");

  return (
    <div className="flex flex-col items-center justify-center h-dvh">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
      >
        <LottieAnimation
          animationData={welcomeAnimation}
          className="w-80 h-80 md:w-[28rem] md:h-[28rem]"
          loop={false}
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
