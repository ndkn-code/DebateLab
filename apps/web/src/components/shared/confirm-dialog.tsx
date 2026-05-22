"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/30 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="mx-4 w-full max-w-sm rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6"
          >
            <h3 className="text-lg font-semibold text-on-surface">{title}</h3>
            <p className="mt-2 text-sm text-on-surface-variant">{description}</p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                onClick={onCancel}
                variant="outline"
                className="border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high"
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
