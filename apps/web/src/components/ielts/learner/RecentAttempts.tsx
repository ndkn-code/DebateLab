"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronRight } from "@/components/ui/icons";
import {
  formatBand,
  isAttemptComplete,
  type IeltsAttemptSummary,
} from "@/lib/ielts/learner/summary";
import { cn } from "@/lib/utils";

function formatWhen(iso: string | null, locale: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Job-board list of a learner's recent sittings (WS-5.1), each linking to the
 * existing results surface. Bands come from the pure summary mapper.
 */
export function RecentAttempts({ items }: { items: IeltsAttemptSummary[] }) {
  const t = useTranslations("dashboard.ielts");
  const locale = useLocale();

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const complete = isAttemptComplete(item.status);
        const when = formatWhen(item.submittedAt ?? item.startedAt, locale);
        const scored = complete && item.overallBand !== null;

        return (
          <li key={item.attemptId}>
            <Link
              href={item.resultsHref}
              className="group flex items-center gap-4 rounded-2xl border border-outline-variant bg-surface-container px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-token-card"
            >
              <div className="min-w-0 flex-1">
                <p className="type-body-sm font-semibold text-on-surface line-clamp-1">
                  {item.testTitle}
                </p>
                <p className="type-caption text-on-surface-variant">
                  {t(`module_${item.module}`)}
                  {when ? ` · ${when}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <p className="type-caption uppercase tracking-wide text-on-surface-variant">
                    {t("overall_band")}
                  </p>
                  <p
                    className={cn(
                      "type-title font-bold tabular-nums",
                      scored ? "text-primary" : "text-on-surface-variant",
                    )}
                  >
                    {complete ? formatBand(item.overallBand) : t("status_in_progress")}
                  </p>
                </div>
                <ChevronRight className="size-5 text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
