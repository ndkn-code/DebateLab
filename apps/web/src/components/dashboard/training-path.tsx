"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  ChartColumnBig,
  GitBranch,
  Mic,
  Scale,
  ShieldCheck,
  Target,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_SKILL_ORDER,
  type DashboardGoalSummary,
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

/** Node coordinates in the 1000x230 path viewBox, matched to PATH_D below. */
const NODE_POINTS: Record<DashboardSkillKey, { x: number; y: number }> = {
  clarity: { x: 110, y: 140 },
  logic: { x: 310, y: 86 },
  rebuttal: { x: 505, y: 132 },
  evidence: { x: 700, y: 80 },
  delivery: { x: 895, y: 124 },
};

const PATH_D =
  "M 30 152 C 70 150, 80 142, 110 140 C 180 135, 240 90, 310 86 C 380 82, 435 128, 505 132 C 575 136, 630 84, 700 80 C 770 76, 825 120, 895 124 C 925 126, 950 120, 975 116";

type NodeState = "empty" | "strong" | "mid" | "weak";

function getNodeState(metric: DashboardSkillMetric | null): NodeState {
  if (!metric || metric.coverage <= 0) return "empty";
  if (metric.value >= 70) return "strong";
  if (metric.value >= 60) return "mid";
  return "weak";
}

const NODE_STYLES: Record<NodeState, { circle: string; icon: string; chip: string }> = {
  empty: {
    circle: "border-2 border-dashed border-outline-variant bg-surface text-on-surface-variant/70",
    icon: "",
    chip: "bg-surface-container text-on-surface-variant",
  },
  strong: {
    circle: "border-b-4 border-[#0AA3C2] bg-primary text-white shadow-token-primary",
    icon: "",
    chip: "bg-primary-container text-primary-dim",
  },
  mid: {
    circle: "border-b-4 border-[#E3A700] bg-reward text-white",
    icon: "",
    chip: "bg-warning-container text-on-warning-container",
  },
  weak: {
    circle: "border-b-4 border-error-dim bg-error text-white",
    icon: "",
    chip: "bg-error-container text-error-dim",
  },
};

function formatScore(metric: DashboardSkillMetric | null) {
  if (!metric || metric.coverage <= 0) return "—";
  return `${Math.round(metric.value)}`;
}

function GoalRing({ goal }: { goal: DashboardGoalSummary }) {
  const t = useTranslations("dashboard.home");
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference - (Math.min(goal.progressPercent, 100) / 100) * circumference;

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative h-16 w-16"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal.goalMinutes}
        aria-valuenow={goal.practicedMinutes}
        aria-label={t("weekly_goal")}
      >
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="#E5F8FC" strokeWidth="8" />
          <motion.circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke="#00B8D9"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            whileInView={{ strokeDashoffset: offset }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          />
        </svg>
        <span className="type-label absolute inset-0 flex items-center justify-center font-extrabold text-on-surface">
          {Math.round(Math.min(goal.progressPercent, 100))}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-on-surface">{t("weekly_goal")}</p>
        <p className="type-label text-on-surface-variant">
          {t("weekly_goal_progress", {
            practiced: goal.practicedMinutes,
            goal: goal.goalMinutes,
          })}
        </p>
      </div>
    </div>
  );
}

export function TrainingPath({
  weeklyGoal,
  metrics,
  checkpoint,
}: {
  weeklyGoal: DashboardGoalSummary;
  metrics: DashboardSkillMetric[];
  checkpoint: DashboardSkillKey | null;
}) {
  const t = useTranslations("dashboard.home");
  const metricsByKey = useMemo(
    () => new Map(metrics.map((metric) => [metric.key, metric])),
    [metrics]
  );

  return (
    <section
      data-testid="dashboard-training-map"
      aria-labelledby="dashboard-training-map-heading"
      className="rounded-[2rem] border border-outline-variant bg-surface p-5 shadow-token-card dark:border-outline-variant/70 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2
            id="dashboard-training-map-heading"
            className="type-title inline-flex items-center gap-2 font-extrabold text-on-surface"
          >
            <GitBranch className="h-[18px] w-[18px] text-primary" />
            {t("training_map")}
          </h2>
          <p className="type-caption mt-0.5 text-on-surface-variant">
            {t("training_map_subtitle")}
          </p>
        </div>
        <GoalRing goal={weeklyGoal} />
      </div>

      {/* Desktop: winding path */}
      <div className="relative mt-2 hidden h-[225px] md:block">
        <svg
          viewBox="0 0 1000 230"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <path
            d={PATH_D}
            fill="none"
            stroke="#CDECF3"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray="0.1 18"
            className="dark:opacity-30"
          />
          <motion.path
            d={PATH_D}
            fill="none"
            stroke="#00B8D9"
            strokeWidth="10"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            initial={{ strokeDashoffset: 1, opacity: 0.9 }}
            whileInView={{ strokeDashoffset: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="opacity-25"
          />
        </svg>

        {DASHBOARD_SKILL_ORDER.map((key, index) => {
          const metric = metricsByKey.get(key) ?? null;
          const Icon = SCORE_ICONS[key];
          const state = getNodeState(metric);
          const styles = NODE_STYLES[state];
          const highlighted = checkpoint === key;
          const point = NODE_POINTS[key];

          return (
            <motion.div
              key={key}
              data-testid={`dashboard-training-map-${key}`}
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{
                type: "spring",
                stiffness: 280,
                damping: 18,
                delay: 0.25 + index * 0.1,
              }}
              className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{
                left: `${(point.x / 1000) * 100}%`,
                top: `${(point.y / 230) * 100}%`,
              }}
            >
              {highlighted ? (
                <motion.span
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  className="type-eyebrow absolute -top-[44px] whitespace-nowrap rounded-full bg-reward px-3.5 py-1 text-on-reward shadow-token-card after:absolute after:left-1/2 after:top-full after:-translate-x-1/2 after:border-x-[6px] after:border-t-[7px] after:border-x-transparent after:border-t-reward"
                >
                  {t("next_checkpoint")}
                </motion.span>
              ) : null}

              <div
                className={cn(
                  "flex h-[60px] w-[60px] items-center justify-center rounded-full transition-transform hover:scale-105",
                  styles.circle,
                  highlighted && "ring-4 ring-reward/40"
                )}
              >
                <Icon className="h-6 w-6" />
              </div>

              <p className="type-label mt-2 font-extrabold text-on-surface">
                {t(`skill_labels.${key}`)}
              </p>
              <span
                className={cn(
                  "type-caption mt-1 rounded-full px-2.5 py-0.5 font-extrabold",
                  styles.chip
                )}
              >
                {formatScore(metric)}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Mobile: skill grid */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:hidden">
        {DASHBOARD_SKILL_ORDER.map((key) => {
          const metric = metricsByKey.get(key) ?? null;
          const Icon = SCORE_ICONS[key];
          const state = getNodeState(metric);
          const styles = NODE_STYLES[state];
          const highlighted = checkpoint === key;

          return (
            <div
              key={key}
              data-testid={`dashboard-mobile-training-map-${key}`}
              className={cn(
                "flex items-center gap-3 rounded-[1.25rem] border border-outline-variant bg-surface p-3 dark:border-outline-variant/70",
                highlighted && "border-reward bg-warning-container/40"
              )}
            >
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                  styles.circle
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="type-label truncate font-extrabold text-on-surface">
                  {t(`skill_labels.${key}`)}
                </p>
                <p className="type-caption font-bold text-on-surface-variant">
                  {formatScore(metric)} / 100
                </p>
                {highlighted ? (
                  <p className="type-caption font-extrabold text-reward-dim">
                    {t("next_checkpoint")}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
