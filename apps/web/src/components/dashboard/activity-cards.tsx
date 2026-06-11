"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  BookOpen,
  ChevronRight,
  MessageSquareText,
  Mic,
  Scale,
  Sparkles,
  Target,
  Users2,
} from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { DashboardTodayPlanItem } from "@/lib/api/dashboard";
import type { DashboardRecentItem } from "@thinkfy/shared/dashboard";
import { getPlanReason, getPlanTitle, getPlanTrackLabel } from "./plan-copy";

const TASK_ICONS = {
  "continue-course": BookOpen,
  "weakest-skill": Target,
  "underused-track": Users2,
  "review-feedback": MessageSquareText,
  "start-speaking": Mic,
  "start-debate": Scale,
  "coach-check": Sparkles,
} as const;

function CardShell({
  title,
  icon,
  action,
  children,
  testId,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="flex min-w-0 flex-col rounded-[2rem] border border-outline-variant bg-surface p-5 shadow-token-card dark:border-outline-variant/70 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-[1.02rem] font-extrabold text-on-surface">
          <span className="text-primary">{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-2.5">{children}</div>
    </section>
  );
}

export function NextMovesCard({ items }: { items: DashboardTodayPlanItem[] }) {
  const t = useTranslations("dashboard.home");

  return (
    <CardShell
      title={t("next_move")}
      icon={<Sparkles className="h-[18px] w-[18px]" />}
      testId="dashboard-next-move"
    >
      {items.map((item) => {
        const Icon = TASK_ICONS[item.key];
        const context =
          item.context ??
          (item.track
            ? getPlanTrackLabel(item.track, t)
            : t("recommended_context_fallback"));

        return (
          <Link key={item.id} href={item.href} data-testid="dashboard-next-move-row">
            <div className="group flex items-center gap-3 rounded-[1.25rem] border border-outline-variant bg-surface-container-low px-3.5 py-3 transition-all hover:-translate-y-0.5 hover:border-primary-fixed hover:shadow-token-card dark:border-outline-variant/60 dark:bg-surface-container-low">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-extrabold uppercase tracking-wide text-primary">
                  {getPlanReason(item, t)}
                </span>
                <span className="mt-0.5 block truncate text-[14px] font-extrabold text-on-surface">
                  {getPlanTitle(item, t)}
                </span>
                <span className="block truncate text-[12px] font-semibold text-on-surface-variant">
                  {t("next_move_meta", { duration: item.durationMinutes, context })}
                </span>
              </span>
              <ChevronRight className="h-[18px] w-[18px] shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
          </Link>
        );
      })}
    </CardShell>
  );
}

function scoreTone(score: number | null | undefined) {
  if (score == null) return "bg-surface-container text-on-surface-variant";
  if (score >= 70) return "bg-success-container text-success-dim";
  if (score >= 60) return "bg-warning-container text-on-warning-container";
  return "bg-error-container text-error-dim";
}

export function RecentActivityCard({
  items,
}: {
  items: DashboardRecentItem[];
}) {
  const t = useTranslations("dashboard.home");
  const locale = useLocale();

  return (
    <CardShell
      title={t("recent_practice")}
      icon={<MessageSquareText className="h-[18px] w-[18px]" />}
      action={
        <Link
          href="/history"
          className="text-[13px] font-extrabold text-primary transition-colors hover:text-primary-dim"
        >
          {t("view_all")}
        </Link>
      }
      testId="dashboard-recent-activity"
    >
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
          <Image
            src="/brand/thinkfy/thinkfy-mascot-wave.png"
            alt=""
            aria-hidden="true"
            width={400}
            height={500}
            className="h-auto w-20 object-contain opacity-90"
            sizes="80px"
          />
          <p className="text-[14px] font-extrabold text-on-surface">{t("first_debate")}</p>
          <p className="max-w-[24ch] text-[13px] text-on-surface-variant">
            {t("practice_get_feedback")}
          </p>
          <Link
            href="/practice"
            className="btn-3d-primary mt-1 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-[13.5px] font-extrabold text-on-primary hover:bg-primary-dim"
          >
            {t("start_new_practice")}
          </Link>
        </div>
      ) : (
        items.slice(0, 3).map((item) => {
          const date = new Date(item.createdAt).toLocaleDateString(locale, {
            month: "short",
            day: "numeric",
          });
          const row = (
            <div className="group flex items-center gap-3 rounded-[1.25rem] border border-outline-variant bg-surface-container-low px-3.5 py-3 transition-all hover:-translate-y-0.5 hover:border-primary-fixed hover:shadow-token-card dark:border-outline-variant/60">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold",
                  scoreTone(item.scoreOutOf100)
                )}
              >
                {item.scoreOutOf100 != null ? Math.round(item.scoreOutOf100) : "—"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-extrabold text-on-surface">
                  {item.title}
                </span>
                <span className="block truncate text-[12px] font-semibold text-on-surface-variant">
                  {date} · {item.subtitle}
                </span>
              </span>
              {item.href ? (
                <ChevronRight className="h-[18px] w-[18px] shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              ) : null}
            </div>
          );

          return item.href ? (
            <Link key={item.id} href={item.href}>
              {row}
            </Link>
          ) : (
            <div key={item.id}>{row}</div>
          );
        })
      )}
    </CardShell>
  );
}
