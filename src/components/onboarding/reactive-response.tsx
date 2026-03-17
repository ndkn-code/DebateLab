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
          className="text-center mt-6 px-4"
        >
          <p className="text-lg md:text-xl font-semibold bg-gradient-to-r from-[#2f4fdd] to-[#7c3aed] bg-clip-text text-transparent">
            {text}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
