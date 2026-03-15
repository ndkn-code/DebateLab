"use client";

import { motion } from "framer-motion";
import { MessageSquare, Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Animated illustration */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative mb-8"
      >
        <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-primary/10">
          <MessageSquare className="h-14 w-14 text-primary" />
        </div>
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-md"
        >
          <Mic className="h-5 w-5 text-white" />
        </motion.div>
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          className="absolute -bottom-2 -left-3 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400 shadow-md"
        >
          <Sparkles className="h-4 w-4 text-white" />
        </motion.div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-3 text-3xl font-bold text-on-surface"
      >
        Welcome to DebateLab
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-10 text-gray-500"
      >
        Master the art of debate — one argument at a time
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Button
          onClick={onNext}
          className="rounded-xl bg-primary px-8 py-3 text-lg font-semibold text-white"
          size="lg"
        >
          Get Started
        </Button>
      </motion.div>
    </div>
  );
}
