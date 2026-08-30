"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  MessageSquareText,
  Sparkles,
} from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { DashboardTodayPlanItem } from "@/lib/api/dashboard";
import type { DashboardRecentItem } from "@thinkfy/shared/dashboard";
import { getPlanTitle, getPlanTrackLabel } from "./plan-copy";

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
      className="flex min-w-0 flex-col rounded-xl border border-outline-variant bg-surface p-4 shadow-none dark:border-outline-variant/70 xl:min-h-[280px]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-title inline-flex items-center gap-2 font-semibold text-on-surface">
          <span className="text-primary">{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-3 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

export function NextMovesCard({ items }: { items: DashboardTodayPlanItem[] }) {
  const t = useTranslations("dashboard.home");
  const nextItems = items.slice(0, 2);

  return (
    <CardShell
      title={t("coming_up")}
      icon={<Sparkles className="h-[18px] w-[18px]" />}
      testId="dashboard-next-move"
    >
      <div role="list" className="relative divide-y divide-outline-variant/70">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-8 left-3 top-8 border-l border-dashed border-outline-variant"
        />
        {nextItems.map((item, index) => {
          const context =
            item.context ??
            (item.track
              ? getPlanTrackLabel(item.track, t)
              : t("recommended_context_fallback"));

          return (
            <Link
              key={item.id}
              href={item.href}
              data-testid="dashboard-next-move-row"
              role="listitem"
              aria-posinset={index + 1}
              aria-setsize={nextItems.length}
            >
              <div className="group flex min-h-[62px] items-center gap-3 py-2 transition-colors hover:bg-surface-container-low">
                <span
                  aria-hidden="true"
                  className="type-caption relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary-container bg-primary-container font-semibold tabular-nums text-primary"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="type-body-sm block truncate font-semibold text-on-surface">
                    {getPlanTitle(item, t)}
                  </span>
                  <span className="type-caption mt-0.5 block truncate text-on-surface-variant">
                    {t("next_move_meta", {
                      duration: item.durationMinutes,
                      context,
                    })}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </Link>
          );
        })}
      </div>
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
  return (
    <CardShell
      title={t("recent_practice")}
      icon={<MessageSquareText className="h-[18px] w-[18px]" />}
      action={
        <Link
          href="/history"
          className="type-label font-extrabold text-primary transition-colors hover:text-primary-dim"
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
          <p className="type-body-sm font-extrabold text-on-surface">
            {t("first_debate")}
          </p>
          <p className="type-caption max-w-[24ch] text-on-surface-variant">
            {t("practice_get_feedback")}
          </p>
          <Link
            href="/practice"
            className="btn-3d-primary type-body-sm mt-1 inline-flex h-11 items-center rounded-xl bg-primary px-5 font-extrabold text-on-primary hover:bg-primary-dim"
          >
            {t("start_new_practice")}
          </Link>
        </div>
      ) : (
        <div
          role="list"
          className="overflow-hidden rounded-lg border border-outline-variant dark:border-outline-variant/60"
        >
          {items.slice(0, 5).map((item, index) => {
            const row = (
              <div
                className={cn(
                  "group flex min-h-10 items-center gap-3 px-3 py-1.5 transition-colors hover:bg-surface-container-low",
                  index < Math.min(items.length, 5) - 1 &&
                    "border-b border-outline-variant dark:border-outline-variant/60",
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="type-body-sm block truncate font-medium text-on-surface">
                    {item.title}
                  </span>
                </span>
                <span
                  className={cn(
                    "type-caption flex h-6 min-w-8 shrink-0 items-center justify-center rounded-[6px] px-2 font-semibold tabular-nums",
                    scoreTone(item.scoreOutOf100),
                  )}
                >
                  {item.scoreOutOf100 != null
                    ? Math.round(item.scoreOutOf100)
                    : "—"}
                </span>
                {item.href ? (
                  <span className="inline-flex shrink-0 items-center gap-1 type-caption font-medium text-on-surface-variant group-hover:text-primary">
                    {t("review")}
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                ) : null}
              </div>
            );

            return item.href ? (
              <Link key={item.id} href={item.href} role="listitem">
                {row}
              </Link>
            ) : (
              <div key={item.id} role="listitem">
                {row}
              </div>
            );
          })}
        </div>
      )}
    </CardShell>
  );
}
