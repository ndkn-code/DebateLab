"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ProductIcon, type ProductIconName } from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";

const GUIDE_ITEMS: Array<{
  key: "highlight" | "eliminate" | "flag" | "navigator" | "review" | "pause" | "timer";
  icon: ProductIconName;
}> = [
  {
    key: "highlight",
    icon: "highlighter",
  },
  {
    key: "eliminate",
    icon: "eraser",
  },
  {
    key: "flag",
    icon: "bookmark",
  },
  {
    key: "navigator",
    icon: "grid",
  },
  {
    key: "review",
    icon: "listChecks",
  },
  {
    key: "pause",
    icon: "pause",
  },
  {
    key: "timer",
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
  const t = useTranslations("ielts.player.exam");
  const reducedMotion = useReducedMotion();

  return (
    <section
      aria-label={showHeading ? undefined : t("guideLabel")}
      className={cn(
        "w-full rounded-2xl border border-outline-variant bg-surface-container-low p-3 text-left shadow-token-card sm:p-4",
        className,
      )}
      data-ielts-exam="guide"
    >
      {showHeading ? (
        <h2 className="text-sm font-bold text-on-surface sm:text-base">
          {t("guideLabel")}
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
            key={item.key}
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
                {t(`guide.${item.key}Title`)}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-on-surface-variant">
                {t(`guide.${item.key}Body`)}
              </span>
            </span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
