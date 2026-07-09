"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ProductIcon, type ProductIconName } from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";

const GUIDE_ITEMS: Array<{
  title: string;
  description: string;
  icon: ProductIconName;
}> = [
  {
    title: "Highlight",
    description: "Mark useful evidence in passages while you read.",
    icon: "highlighter",
  },
  {
    title: "Eliminate",
    description: "Cross out answer choices you know are wrong.",
    icon: "eraser",
  },
  {
    title: "Flag",
    description: "Save uncertain questions for another look.",
    icon: "bookmark",
  },
  {
    title: "Navigator",
    description: "Jump across questions and see answered, open, and flagged items.",
    icon: "grid",
  },
  {
    title: "Review",
    description: "Check the whole section before you confirm submit.",
    icon: "listChecks",
  },
  {
    title: "Pause",
    description: "Freeze the section clock, then resume when ready.",
    icon: "pause",
  },
  {
    title: "Timer",
    description: "Each section runs on its own server clock.",
    icon: "timer",
  },
];

export function MockPreTestGuide({
  className,
  showHeading = true,
}: {
  className?: string;
  showHeading?: boolean;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <section
      aria-label={showHeading ? undefined : "How this mock works"}
      className={cn(
        "w-full rounded-2xl border border-outline-variant bg-surface-container-low p-3 text-left shadow-token-card sm:p-4",
        className,
      )}
    >
      {showHeading ? (
        <h2 className="text-sm font-bold text-on-surface sm:text-base">
          How this mock works
        </h2>
      ) : null}
      <motion.div
        initial={reducedMotion ? undefined : "hidden"}
        animate="open"
        variants={{
          open: {
            transition: { staggerChildren: reducedMotion ? 0 : 0.035 },
          },
        }}
        className={cn("grid gap-2", showHeading && "mt-3")}
      >
        {GUIDE_ITEMS.map((item) => (
          <motion.div
            key={item.title}
            variants={
              reducedMotion
                ? undefined
                : {
                    hidden: { opacity: 0, y: 8 },
                    open: { opacity: 1, y: 0 },
                  }
            }
            className="flex min-h-14 items-center gap-3 rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-on-surface"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-primary">
              <ProductIcon name={item.icon} size="sm" weight="duotone" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-on-surface">
                {item.title}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-on-surface-variant">
                {item.description}
              </span>
            </span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
