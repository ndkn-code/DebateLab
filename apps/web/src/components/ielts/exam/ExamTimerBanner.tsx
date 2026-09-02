"use client";

/**
 * "10 minutes remaining" strip between the exam header and the panes. The
 * live region stays mounted so screen readers announce every threshold; the
 * visible banner is dismissable and returns when the next threshold fires.
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ProductIcon } from "@/components/ui/product-icon";
import { warningMinutes } from "@/lib/ielts/timer-warnings";
import { transitions } from "@/lib/motion/variants";
import { ExamButton } from "./ExamButton";

export interface ExamTimerBannerProps {
  /** Threshold (seconds) currently being shown, or `null` when hidden. */
  threshold: number | null;
  onDismiss: () => void;
}

export function ExamTimerBanner({ threshold, onDismiss }: ExamTimerBannerProps) {
  const t = useTranslations("ielts.player.exam");
  const reducedMotion = useReducedMotion();
  const minutes = threshold === null ? 0 : warningMinutes(threshold);
  const title =
    minutes <= 1 ? t("timerWarningOne") : t("timerWarning", { minutes });

  return (
    <div role="status" aria-live="assertive" className="shrink-0">
      <AnimatePresence initial={false}>
        {threshold !== null ? (
          <motion.div
            key={threshold}
            initial={reducedMotion ? undefined : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={transitions.base}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-warning bg-warning-container px-3 py-2 text-on-warning-container sm:px-5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-warning">
                <ProductIcon name="timer" size="sm" weight="bold" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="type-label font-bold">{title}</p>
                <p className="type-caption">{t("timerWarningBody")}</p>
              </div>
              <ExamButton
                data-exam-control
                onClick={onDismiss}
                aria-label={t("dismiss")}
                className="size-9 px-0"
              >
                <ProductIcon name="x" size="sm" weight="bold" aria-hidden="true" />
              </ExamButton>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
