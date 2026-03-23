"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";

interface Props {
  xp: number;
  trigger: boolean;
  position?: "top-right" | "center" | "inline";
}

export function XPAnimation({ xp, trigger, position = "center" }: Props) {
  const positionClasses = {
    "top-right": "absolute top-2 right-2",
    center: "flex justify-center",
    inline: "inline-flex",
  };

  return (
    <AnimatePresence>
      {trigger && xp > 0 && (
        <motion.div
          className={positionClasses[position]}
          initial={{ opacity: 0, y: 10, scale: 1.3 }}
          animate={{ opacity: 1, y: -20, scale: 1 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          <span className="flex items-center gap-1 text-lg font-bold text-amber-500 drop-shadow-sm">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            +{xp} XP
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
