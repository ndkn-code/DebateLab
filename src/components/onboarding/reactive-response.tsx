"use client";

import { motion, AnimatePresence } from "framer-motion";

interface ReactiveResponseProps {
  text: string | null;
}

export function ReactiveResponse({ text }: ReactiveResponseProps) {
  return (
    <AnimatePresence mode="wait">
      {text && (
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mt-6 rounded-2xl border border-primary/15 bg-primary-container px-4 py-3 text-center shadow-[0_16px_34px_-28px_rgba(77,134,247,0.6)]"
        >
          <p className="text-base font-semibold text-primary md:text-lg">
            {text}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
