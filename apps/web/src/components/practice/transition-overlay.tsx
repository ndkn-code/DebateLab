"use client";

import { motion } from "framer-motion";

interface TransitionOverlayProps {
  message: string;
  subMessage?: string;
}

export function TransitionOverlay({
  message,
  subMessage,
}: TransitionOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary backdrop-blur-sm"
    >
      <motion.h2
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", bounce: 0.3 }}
        className="text-4xl font-bold text-on-primary sm:text-5xl"
      >
        {message}
      </motion.h2>
      {subMessage && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-4 text-lg text-primary-container"
        >
          {subMessage}
        </motion.p>
      )}
    </motion.div>
  );
}
