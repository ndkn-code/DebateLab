"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ChartColumnBig,
  Mic,
  Scale,
  ShieldCheck,
  Target,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_SKILL_ORDER,
  type DashboardSkillKey,
  type DashboardSkillMetric,
} from "@thinkfy/shared/dashboard";

const SCORE_ICONS = {
  clarity: Target,
  logic: Scale,
  rebuttal: ShieldCheck,
  evidence: ChartColumnBig,
  delivery: Mic,
} as const;

type NodeState = "empty" | "strong" | "mid" | "weak";

function getNodeState(metric: DashboardSkillMetric | null): NodeState {
  if (!metric || metric.coverage <= 0) return "empty";
  if (metric.value >= 70) return "strong";
  if (metric.value >= 60) return "mid";
  return "weak";
}

const NODE_STYLES: Record<NodeState, { circle: string; chip: string }> = {
  empty: {
    circle:
      "border border-outline-variant bg-surface-container-low text-on-surface-variant/70",
    chip: "bg-surface-container text-on-surface-variant",
  },
  strong: {
    circle: "border-2 border-success bg-success text-on-success",
    chip: "bg-success-container text-success-dim",
  },
  mid: {
    circle: "border-2 border-primary bg-surface text-primary",
    chip: "bg-primary-container text-primary",
  },
  weak: {
    circle:
      "border-2 border-warning bg-warning-container text-on-warning-container",
    chip: "bg-error-container text-error-dim",
  },
};

function formatScore(metric: DashboardSkillMetric | null) {
  if (!metric || metric.coverage <= 0) return "—";
  return `${Math.round(metric.value)}`;
}

function getSkillHref(key: DashboardSkillKey) {
  return key === "delivery"
    ? "/practice?track=speaking"
    : "/practice?track=debate";
}

export function TrainingPath({
  metrics,
  checkpoint,
}: {
  metrics: DashboardSkillMetric[];
  checkpoint: DashboardSkillKey | null;
}) {
  const t = useTranslations("dashboard.home");
  const reduceMotion = useReducedMotion();
  const metricsByKey = useMemo(
    () => new Map(metrics.map((metric) => [metric.key, metric])),
    [metrics],
  );

  return (
    <section
      data-testid="dashboard-training-map"
      aria-labelledby="dashboard-training-map-heading"
      className="rounded-xl border border-outline-variant bg-surface px-4 py-3 shadow-none dark:border-outline-variant/70"
    >
      <div className="flex items-center justify-between">
        <h2
          id="dashboard-training-map-heading"
          className="type-title font-semibold text-on-surface"
        >
          {t("practice_path")}
        </h2>
      </div>

      <div className="relative mt-4 overflow-hidden pb-1">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[10%] right-[10%] top-7 border-t border-outline-variant"
        />
        <ol
          aria-label={t("training_map")}
          className="relative grid grid-cols-5 items-start gap-0 px-1"
        >
          {DASHBOARD_SKILL_ORDER.map((key, index) => {
            const metric = metricsByKey.get(key) ?? null;
            const Icon = SCORE_ICONS[key];
            const state = getNodeState(metric);
            const styles = NODE_STYLES[state];
            const highlighted = checkpoint === key;
            const skillLabel = t(`skill_labels.${key}`);
            const score = formatScore(metric);

            return (
              <motion.li
                key={key}
                data-testid={`dashboard-training-map-${key}`}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-20px" }}
                transition={
                  reduceMotion
                    ? undefined
                    : {
                        duration: 0.35,
                        ease: [0.16, 1, 0.3, 1],
                        delay: index * 0.06,
                      }
                }
                className="relative z-10 flex min-w-0 justify-center"
              >
                <Link
                  href={getSkillHref(key)}
                  aria-current={highlighted ? "step" : undefined}
                  aria-label={`${skillLabel}: ${score}`}
                  className="group flex min-w-0 max-w-full flex-col items-center rounded-lg p-1 text-center outline-none transition-colors hover:bg-primary-container/40 focus-visible:ring-3 focus-visible:ring-primary/40"
                >
                  <span
                    className={cn(
                      "relative flex h-14 w-14 items-center justify-center rounded-full p-[4px] transition-transform group-hover:scale-105",
                      state === "empty"
                        ? "bg-surface-container-high text-on-surface-variant"
                        : state === "strong"
                          ? "bg-success text-success"
                          : state === "mid"
                            ? "bg-primary text-primary"
                            : "bg-warning text-warning",
                      highlighted && "ring-4 ring-primary/15",
                    )}
                    style={
                      metric && metric.coverage > 0
                        ? {
                            background: `conic-gradient(currentColor ${Math.max(8, Math.min(100, metric.value))}%, var(--color-surface-container-high) 0)`,
                          }
                        : undefined
                    }
                  >
                    <span className="flex h-full w-full items-center justify-center rounded-full bg-surface">
                      <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                    </span>
                  </span>
                  <span className="type-caption mt-1 max-w-full truncate font-semibold text-on-surface">
                    {skillLabel}
                  </span>
                  <span
                    className={cn(
                      "type-caption mt-0.5 font-semibold tabular-nums",
                      styles.chip,
                    )}
                  >
                    {score}
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
