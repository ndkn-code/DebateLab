"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Info, CheckCircle2 } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export type ToastType = "info" | "warning" | "error" | "success";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

let addToastFn: ((message: string, type?: ToastType) => void) | null = null;

export function showToast(message: string, type: ToastType = "info") {
  addToastFn?.(message, type);
}

const icons = {
  info: Info,
  warning: AlertTriangle,
  error: AlertTriangle,
  success: CheckCircle2,
};

const tones: Record<
  ToastType,
  {
    accent: string;
    surface: string;
  }
> = {
  info: {
    accent: "var(--color-primary)",
    surface: "var(--color-primary-container)",
  },
  warning: {
    accent: "var(--color-warning)",
    surface: "var(--color-warning-container)",
  },
  error: {
    accent: "var(--color-error)",
    surface: "var(--color-error-container)",
  },
  success: {
    accent: "var(--color-success)",
    surface: "var(--color-success-container)",
  },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          const tone = tones[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 text-on-surface shadow-lg backdrop-blur-xl"
              )}
              style={{
                backgroundColor: `color-mix(in srgb, ${tone.surface} 82%, var(--color-surface) 18%)`,
                borderColor: `color-mix(in srgb, ${tone.accent} 36%, var(--color-outline-variant))`,
              }}
            >
              <Icon
                className="h-4 w-4 shrink-0"
                style={{ color: tone.accent }}
              />
              <span className="text-sm">{toast.message}</span>
              <button
                onClick={() =>
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                }
                className="ml-2 shrink-0 text-on-surface-variant opacity-60 hover:text-on-surface hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
