"use client";

import { ArrowRight, Clock3, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RecentSession } from "@/lib/api/dashboard";

interface RecentPracticePanelProps {
  recentSessions: RecentSession[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDuration(seconds: number, minutesLabel: string) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} ${minutesLabel}`;
}

export function RecentPracticePanel({
  recentSessions,
}: RecentPracticePanelProps) {
  const t = useTranslations("dashboard.home");
  const tHistory = useTranslations("dashboard.history");
  const sessions = recentSessions.slice(0, 2);

  return (
    <section className="rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest p-5 soft-shadow">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-on-surface">
            {t("recent_practice")}
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            {t("recent_practice_subtitle")}
          </p>
        </div>

        <Link
          href="/history"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t("view_all")}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {sessions.length === 0 ? (
        <Link href="/practice">
          <div className="rounded-[1.4rem] border border-dashed border-outline-variant/30 bg-surface-container-low p-4 transition-colors hover:border-primary/30 hover:bg-primary-container/5">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <p className="font-medium text-on-surface">{t("first_debate")}</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {t("practice_get_feedback")}
            </p>
          </div>
        </Link>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/history/${session.id}`}
              className="block rounded-[1.4rem] border border-outline-variant/10 bg-surface-container-low p-4 transition-all hover:border-primary/20"
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    session.total_score != null && session.total_score >= 75
                      ? "bg-emerald-500/10 text-emerald-600"
                      : session.total_score != null && session.total_score >= 40
                        ? "bg-amber-500/10 text-amber-600"
                        : session.total_score != null
                          ? "bg-red-500/10 text-red-500"
                          : "bg-surface-container-high text-on-surface-variant"
                  )}
                >
                  {session.total_score ?? "—"}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-on-surface">
                    {session.topic_title}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      {session.practice_track === "speaking"
                        ? tHistory("speaking")
                        : tHistory("debate")}
                    </Badge>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      {session.practice_track === "speaking"
                        ? tHistory("single_speech")
                        : session.mode === "full"
                          ? tHistory("full")
                          : tHistory("quick")}
                    </Badge>
                    {session.overall_band ? (
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {session.overall_band}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span>{formatDate(session.created_at)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3 w-3" />
                      {formatDuration(session.duration_seconds, t("min"))}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}

          <Link
            href="/practice"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {t("start_new_practice")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </section>
  );
}
