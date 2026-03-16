"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import welcomeAnimation from "../../../public/lottie/welcome.json";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <LottieAnimation
          animationData={welcomeAnimation}
          className="w-72 h-72 md:w-96 md:h-96 mx-auto"
          loop={false}
        />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        className="text-4xl md:text-5xl font-bold text-gray-900 text-center"
      >
        Welcome to DebateLab
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.0, duration: 0.5 }}
        className="text-lg text-gray-400 text-center mt-3"
      >
        Master the art of debate
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.5, duration: 0.4 }}
      >
        <Button
          onClick={onNext}
          size="lg"
          className="mt-8 px-10 py-3 text-lg rounded-xl bg-primary text-white font-semibold"
        >
          Get Started
        </Button>
      </motion.div>
    </div>
  );
}
